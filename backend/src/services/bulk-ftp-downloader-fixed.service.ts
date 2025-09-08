import { logger } from '../config/logger';
import * as ftp from 'basic-ftp';
import { env } from '../config/environment';
import { Writable } from 'stream';
import { sql } from 'drizzle-orm';
import { db } from '../db/connection';
import { cruises, ships } from '../db/schema';
import { getWebhookLineId } from '../config/cruise-line-mapping';

export interface BulkDownloadResult {
  lineId: number;
  totalFiles: number;
  successfulDownloads: number;
  failedDownloads: number;
  downloadedData: Map<string, any>;
  errors: string[];
  duration: number;
  connectionFailures: number;
  fileNotFoundErrors: number;
  parseErrors: number;
  corruptedFiles: number;
  skippedFiles: number;
}

export interface CruiseInfo {
  id: string;
  cruiseCode: string;
  shipId?: string;
  shipName: string;
  sailingDate: Date;
}

/**
 * Production-ready bulk FTP downloader service with enhanced error handling
 * Features:
 * - Robust JSON validation and error recovery
 * - Connection pooling with persistent connections
 * - Intelligent retry logic for corrupted files
 * - Circuit breaker pattern for FTP failures
 * - Memory-efficient streaming downloads
 * - Comprehensive error tracking and reporting
 */
export class BulkFtpDownloaderServiceFixed {
  private static instance: BulkFtpDownloaderServiceFixed;
  private connectionPool: ftp.Client[] = [];
  private readonly MAX_CONNECTIONS = 3;
  private readonly MAX_RETRIES = 3;
  private readonly CHUNK_SIZE = 500;
  private readonly CONNECTION_TIMEOUT = 30000;
  private readonly DOWNLOAD_TIMEOUT = 45000;
  private readonly MEGA_BATCH_SIZE = 500;

  // Circuit breaker state
  private circuitBreakerState = {
    failureCount: 0,
    lastFailureTime: 0,
    isOpen: false,
  };
  private readonly CIRCUIT_FAILURE_THRESHOLD = 5;
  private readonly CIRCUIT_RESET_TIMEOUT = 60000;

  private constructor() {}

  static getInstance(): BulkFtpDownloaderServiceFixed {
    if (!this.instance) {
      this.instance = new BulkFtpDownloaderServiceFixed();
    }
    return this.instance;
  }

  /**
   * Validate and clean JSON string before parsing
   * Attempts to fix common JSON corruption issues
   */
  private validateAndCleanJson(
    data: string,
    cruiseId: string
  ): { isValid: boolean; cleanedData?: string; error?: string } {
    try {
      // Basic validation
      if (!data || typeof data !== 'string') {
        return { isValid: false, error: 'Empty or invalid data' };
      }

      // Trim whitespace and BOM
      let cleanedData = data.trim();
      if (cleanedData.charCodeAt(0) === 0xfeff) {
        cleanedData = cleanedData.slice(1);
      }

      // Check for HTML error pages (common FTP issue)
      if (cleanedData.startsWith('<!DOCTYPE') || cleanedData.startsWith('<html')) {
        return { isValid: false, error: 'Received HTML instead of JSON (likely error page)' };
      }

      // Check basic JSON structure
      if (!cleanedData.startsWith('{') || !cleanedData.endsWith('}')) {
        // Try to find JSON content within the data
        const jsonStart = cleanedData.indexOf('{');
        const jsonEnd = cleanedData.lastIndexOf('}');

        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          cleanedData = cleanedData.substring(jsonStart, jsonEnd + 1);
          logger.warn(`Extracted JSON from corrupted file for cruise ${cruiseId}`, {
            originalLength: data.length,
            extractedLength: cleanedData.length,
          });
        } else {
          return { isValid: false, error: 'Invalid JSON structure - missing brackets' };
        }
      }

      // Check for common corruption patterns
      if (cleanedData.includes('\x00') || cleanedData.includes('\ufffd')) {
        // Remove null bytes and replacement characters
        cleanedData = cleanedData.replace(/[\x00\ufffd]/g, '');
        logger.warn(`Removed null/invalid characters from cruise ${cruiseId} JSON`);
      }

      // Check for truncated JSON (common with network issues)
      const openBraces = (cleanedData.match(/{/g) || []).length;
      const closeBraces = (cleanedData.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        return {
          isValid: false,
          error: `Unbalanced braces: ${openBraces} open, ${closeBraces} close - likely truncated`,
        };
      }

      // Try to parse to validate
      try {
        JSON.parse(cleanedData);
        return { isValid: true, cleanedData };
      } catch (parseError) {
        // Attempt to fix common JSON syntax errors
        const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown error';

        // Handle specific error patterns from logs
        if (errorMsg.includes('Unexpected non-whitespace character after JSON')) {
          // Multiple JSON objects concatenated
          const match = cleanedData.match(/^({.*?})(.+)$/s);
          if (match) {
            try {
              JSON.parse(match[1]);
              logger.warn(`Found multiple JSON objects for cruise ${cruiseId}, using first one`);
              return { isValid: true, cleanedData: match[1] };
            } catch {
              // Continue to next fix attempt
            }
          }
        }

        // Handle malformed property names/values
        if (errorMsg.includes('Unexpected token') || errorMsg.includes('Expected')) {
          // Try to fix common issues like unescaped quotes, missing commas
          let fixedData = cleanedData
            // Fix missing commas between properties
            .replace(/(["}])\s*(["{])/g, '$1,$2')
            // Fix unescaped quotes in values (basic attempt)
            .replace(/:\s*"([^"]*)"([^,}])/g, (match, value, after) => {
              if (after === '"') {
                return `: "${value.replace(/"/g, '\\"')}"${after}`;
              }
              return match;
            });

          try {
            JSON.parse(fixedData);
            logger.warn(`Applied JSON fixes for cruise ${cruiseId}`);
            return { isValid: true, cleanedData: fixedData };
          } catch {
            return { isValid: false, error: `JSON parse error: ${errorMsg}` };
          }
        }

        return { isValid: false, error: `JSON parse error: ${errorMsg}` };
      }
    } catch (error) {
      return {
        isValid: false,
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Download all cruise files for a specific line with enhanced error handling
   */
  async downloadLineUpdates(
    lineId: number,
    cruiseInfos: CruiseInfo[]
  ): Promise<BulkDownloadResult> {
    const downloadStartTime = new Date().toISOString();
    logger.info('🔧 [BULK-FTP-START] Starting enhanced bulk FTP download', {
      lineId,
      cruiseInfosCount: cruiseInfos.length,
      sampleCruiseIds: cruiseInfos.slice(0, 3).map(c => c.id),
      stage: 'BULK_DOWNLOAD_START',
      downloadStartTime,
      megaBatchLimit: this.MEGA_BATCH_SIZE,
    });

    // Enforce mega-batch size limit
    if (cruiseInfos.length > this.MEGA_BATCH_SIZE) {
      logger.warn(
        `⚠️ Limiting to ${this.MEGA_BATCH_SIZE} cruises to prevent overload (total: ${cruiseInfos.length})`,
        { lineId, totalCruises: cruiseInfos.length, processingCount: this.MEGA_BATCH_SIZE }
      );
      cruiseInfos = cruiseInfos.slice(0, this.MEGA_BATCH_SIZE);
    }

    if (this.circuitBreakerState.isOpen) {
      const timeSinceFailure = Date.now() - this.circuitBreakerState.lastFailureTime;
      if (timeSinceFailure < this.CIRCUIT_RESET_TIMEOUT) {
        throw new Error(
          `Circuit breaker OPEN. Retry in ${Math.round((this.CIRCUIT_RESET_TIMEOUT - timeSinceFailure) / 1000)}s`
        );
      } else {
        this.circuitBreakerState.isOpen = false;
        this.circuitBreakerState.failureCount = 0;
        logger.info('🔄 Circuit breaker reset');
      }
    }

    const startTime = Date.now();
    const result: BulkDownloadResult = {
      lineId,
      totalFiles: cruiseInfos.length,
      successfulDownloads: 0,
      failedDownloads: 0,
      downloadedData: new Map(),
      errors: [],
      duration: 0,
      connectionFailures: 0,
      fileNotFoundErrors: 0,
      parseErrors: 0,
      corruptedFiles: 0,
      skippedFiles: 0,
    };

    let client: ftp.Client | null = null;

    try {
      // Get or create FTP connection
      logger.info('📡 [FTP-CONNECTION] Establishing connection', {
        lineId,
        stage: 'FTP_CONNECTION_ATTEMPT',
        host: env.TRAVELTEK_FTP_HOST ? env.TRAVELTEK_FTP_HOST.substring(0, 10) + '***' : 'MISSING',
      });

      client = await this.getConnection();

      logger.info('✅ [FTP-CONNECTION] Connected successfully', {
        lineId,
        connectionDuration: Date.now() - startTime,
      });

      // Group cruises by ship for efficient downloading
      const cruisesByShip = new Map<string, CruiseInfo[]>();
      for (const cruise of cruiseInfos) {
        const shipKey = cruise.shipId || cruise.shipName;
        if (!cruisesByShip.has(shipKey)) {
          cruisesByShip.set(shipKey, []);
        }
        cruisesByShip.get(shipKey)!.push(cruise);
      }

      const shipNames = Array.from(cruisesByShip.keys());
      logger.info(`📦 Processing ${shipNames.length} ships`, {
        lineId,
        shipCount: shipNames.length,
        sampleShips: shipNames.slice(0, 5),
      });

      // Process each ship's cruises
      for (const shipKey of shipNames) {
        const cruises = cruisesByShip.get(shipKey)!;
        await this.downloadShipFiles(client, lineId, shipKey, cruises, result);

        // Small delay between ships
        if (shipNames.indexOf(shipKey) < shipNames.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Check circuit breaker state
      const errorRate = result.failedDownloads / result.totalFiles;
      if (errorRate > 0.5 && result.totalFiles > 10) {
        this.circuitBreakerState.failureCount++;
        if (this.circuitBreakerState.failureCount >= this.CIRCUIT_FAILURE_THRESHOLD) {
          this.circuitBreakerState.isOpen = true;
          this.circuitBreakerState.lastFailureTime = Date.now();
          logger.error('🔴 Circuit breaker opened due to high failure rate', {
            errorRate,
            failureCount: this.circuitBreakerState.failureCount,
          });
        }
      } else {
        this.circuitBreakerState.failureCount = 0;
      }
    } catch (error) {
      logger.error('Fatal error in bulk FTP download:', error);
      throw error;
    } finally {
      if (client) {
        await this.releaseConnection(client);
      }
      result.duration = Date.now() - startTime;
    }

    logger.info('📊 [BULK-FTP-COMPLETE] Download operation finished', {
      lineId,
      successful: result.successfulDownloads,
      failed: result.failedDownloads,
      corrupted: result.corruptedFiles,
      skipped: result.skippedFiles,
      parseErrors: result.parseErrors,
      duration: `${(result.duration / 1000).toFixed(2)}s`,
      successRate:
        result.totalFiles > 0
          ? `${Math.round((result.successfulDownloads / result.totalFiles) * 100)}%`
          : '0%',
    });

    return result;
  }

  /**
   * Download all files for a specific ship
   */
  private async downloadShipFiles(
    client: ftp.Client,
    lineId: number,
    shipKey: string,
    cruises: CruiseInfo[],
    result: BulkDownloadResult
  ): Promise<void> {
    logger.info(`🚢 Processing ship ${shipKey}`, {
      lineId,
      shipKey,
      cruiseCount: cruises.length,
    });

    const webhookLineId = getWebhookLineId(lineId);
    let shipSuccessful = 0;
    let shipFailed = 0;
    let shipCorrupted = 0;

    for (let i = 0; i < cruises.length; i++) {
      const cruise = cruises[i];

      if (i % 10 === 0 || i === cruises.length - 1) {
        logger.info(`📥 Progress: ${i + 1}/${cruises.length} for ship ${shipKey}`, {
          cruiseId: cruise.id,
          overallProgress: `${result.successfulDownloads}/${result.totalFiles}`,
        });
      }

      const downloadResult = await this.downloadSingleCruiseFileWithRetry(
        client,
        lineId,
        cruise,
        result
      );

      if (downloadResult === 'success') {
        shipSuccessful++;
      } else if (downloadResult === 'corrupted') {
        shipCorrupted++;
      } else {
        shipFailed++;
      }

      // Minimal delay
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    logger.info(`✅ Completed ship ${shipKey}`, {
      successful: shipSuccessful,
      failed: shipFailed,
      corrupted: shipCorrupted,
      successRate:
        cruises.length > 0 ? `${Math.round((shipSuccessful / cruises.length) * 100)}%` : '0%',
    });
  }

  /**
   * Download a single cruise file with retry logic for corrupted files
   */
  private async downloadSingleCruiseFileWithRetry(
    client: ftp.Client,
    lineId: number,
    cruise: CruiseInfo,
    result: BulkDownloadResult
  ): Promise<'success' | 'failed' | 'corrupted'> {
    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        const downloadResult = await this.downloadSingleCruiseFile(
          client,
          lineId,
          cruise,
          result,
          retries > 0
        );

        if (downloadResult === 'success') {
          return 'success';
        } else if (downloadResult === 'corrupted' && retries < maxRetries) {
          logger.warn(
            `🔄 Retrying corrupted file download for cruise ${cruise.id} (attempt ${retries + 2})`,
            {
              cruiseId: cruise.id,
              shipName: cruise.shipName,
            }
          );
          retries++;
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          return downloadResult;
        }
      } catch (error) {
        if (retries < maxRetries) {
          logger.warn(
            `🔄 Retrying failed download for cruise ${cruise.id} (attempt ${retries + 2})`,
            {
              cruiseId: cruise.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            }
          );
          retries++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          return 'failed';
        }
      }
    }

    return 'failed';
  }

  /**
   * Download a single cruise file with enhanced error handling and validation
   */
  private async downloadSingleCruiseFile(
    client: ftp.Client,
    lineId: number,
    cruise: CruiseInfo,
    result: BulkDownloadResult,
    isRetry: boolean = false
  ): Promise<'success' | 'failed' | 'corrupted'> {
    const sailingYear = cruise.sailingDate.getFullYear();
    const sailingMonth = String(cruise.sailingDate.getMonth() + 1).padStart(2, '0');
    const webhookLineId = getWebhookLineId(lineId);
    const fileName = `${cruise.id}.json`;

    // Construct possible FTP paths
    const possiblePaths: string[] = [];

    if (cruise.shipId) {
      possiblePaths.push(
        `/${sailingYear}/${sailingMonth}/${webhookLineId}/${cruise.shipId}/${fileName}`
      );
    }

    // Fallback paths
    const processedShipName = cruise.shipName
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase();

    possiblePaths.push(
      `/${sailingYear}/${sailingMonth}/${webhookLineId}/${processedShipName}/${fileName}`
    );

    if (cruise.cruiseCode && cruise.cruiseCode !== cruise.id) {
      const cruiseCodeFileName = `${cruise.cruiseCode}.json`;
      if (cruise.shipId) {
        possiblePaths.push(
          `/${sailingYear}/${sailingMonth}/${webhookLineId}/${cruise.shipId}/${cruiseCodeFileName}`
        );
      }
    }

    const uniquePaths = [...new Set(possiblePaths)];

    if (!isRetry) {
      logger.debug(`🔍 Attempting download for cruise ${cruise.id}`, {
        cruiseId: cruise.id,
        shipName: cruise.shipName,
        pathsToTry: uniquePaths.length,
      });
    }

    let rawData: string | null = null;
    let successfulPath = '';

    try {
      // Try each possible path
      for (const filePath of uniquePaths) {
        try {
          rawData = await this.downloadFileFromPath(client, filePath);
          if (rawData) {
            successfulPath = filePath;
            break;
          }
        } catch (pathError) {
          continue;
        }
      }

      if (!rawData) {
        throw new Error(`File not found in any of ${uniquePaths.length} paths`);
      }

      // Validate and clean JSON
      const validation = this.validateAndCleanJson(rawData, cruise.id);

      if (!validation.isValid) {
        logger.error(`❌ Invalid JSON for cruise ${cruise.id}`, {
          cruiseId: cruise.id,
          error: validation.error,
          dataLength: rawData.length,
          preview: rawData.substring(0, 200),
        });

        result.corruptedFiles++;
        result.parseErrors++;
        result.errors.push(`${cruise.id}: ${validation.error}`);

        return 'corrupted';
      }

      // Parse the cleaned JSON
      const jsonData = JSON.parse(validation.cleanedData!);

      // Validate essential fields
      if (!jsonData.cruiseid && !jsonData.codetocruiseid) {
        logger.warn(`⚠️ Missing cruise ID fields in JSON for ${cruise.id}`);
      }

      result.downloadedData.set(cruise.id, jsonData);
      result.successfulDownloads++;

      logger.debug(`✅ Successfully processed cruise ${cruise.id}`, {
        cruiseId: cruise.id,
        usedPath: successfulPath,
        dataWasCleaned: validation.cleanedData !== rawData,
      });

      return 'success';
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`❌ Failed to download cruise ${cruise.id}`, {
        cruiseId: cruise.id,
        shipName: cruise.shipName,
        error: errorMsg,
      });

      result.failedDownloads++;
      result.errors.push(`${cruise.id}: ${errorMsg}`);

      // Categorize errors
      if (errorMsg.includes('timeout') || errorMsg.includes('connection')) {
        result.connectionFailures++;
      } else if (errorMsg.includes('not found') || errorMsg.includes('No such file')) {
        result.fileNotFoundErrors++;
      }

      return 'failed';
    }
  }

  /**
   * Download file from FTP with proper error handling
   */
  private async downloadFileFromPath(client: ftp.Client, fullPath: string): Promise<string> {
    const chunks: Buffer[] = [];
    const memoryStream = new Writable({
      write(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
        chunks.push(chunk);
        callback();
      },
    });

    try {
      // Download with timeout
      const downloadPromise = client.downloadTo(memoryStream, fullPath);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Download timeout')), this.DOWNLOAD_TIMEOUT);
      });

      await Promise.race([downloadPromise, timeoutPromise]);

      const result = Buffer.concat(chunks).toString('utf-8');

      // Basic validation
      if (!result || result.length === 0) {
        throw new Error('Empty file downloaded');
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get a connection from pool or create new one
   */
  private async getConnection(): Promise<ftp.Client> {
    // Try to reuse existing connection
    for (const client of this.connectionPool) {
      if (!client.closed) {
        try {
          // Test connection with NOOP
          await client.send('NOOP');
          return client;
        } catch {
          // Connection dead, remove from pool
          const index = this.connectionPool.indexOf(client);
          if (index > -1) {
            this.connectionPool.splice(index, 1);
          }
        }
      }
    }

    // Create new connection
    const client = new ftp.Client();
    client.ftp.verbose = false;

    await client.access({
      host: env.TRAVELTEK_FTP_HOST,
      user: env.TRAVELTEK_FTP_USER,
      password: env.TRAVELTEK_FTP_PASSWORD,
      secure: false,
    });

    // Add to pool if not full
    if (this.connectionPool.length < this.MAX_CONNECTIONS) {
      this.connectionPool.push(client);
    }

    return client;
  }

  /**
   * Release connection back to pool
   */
  private async releaseConnection(client: ftp.Client): Promise<void> {
    try {
      if (!client.closed) {
        // Keep in pool for reuse
        return;
      }
    } catch {
      // Remove dead connection from pool
      const index = this.connectionPool.indexOf(client);
      if (index > -1) {
        this.connectionPool.splice(index, 1);
      }
    }
  }

  /**
   * Close all connections in pool
   */
  async closeAllConnections(): Promise<void> {
    for (const client of this.connectionPool) {
      try {
        client.close();
      } catch {
        // Ignore errors
      }
    }
    this.connectionPool = [];
  }
}

// Export singleton instance
export const bulkFtpDownloaderFixed = BulkFtpDownloaderServiceFixed.getInstance();
