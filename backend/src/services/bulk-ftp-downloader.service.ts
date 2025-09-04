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
}

export interface CruiseInfo {
  id: string;
  cruiseCode: string;
  shipId?: string;
  shipName: string;
  sailingDate: Date;
}

/**
 * Production-ready bulk FTP downloader service
 * Optimized for downloading thousands of cruise files efficiently
 * Features:
 * - Connection pooling with persistent connections
 * - Intelligent batching and grouping by ship
 * - Circuit breaker pattern for FTP failures
 * - Memory-efficient streaming downloads
 * - Comprehensive error tracking and reporting
 */
export class BulkFtpDownloaderService {
  private static instance: BulkFtpDownloaderService;
  private connectionPool: ftp.Client[] = [];
  private readonly MAX_CONNECTIONS = 3; // Optimized for stability
  private readonly MAX_RETRIES = 3;
  private readonly CHUNK_SIZE = 500; // Mega-batch size for bulk processing
  private readonly CONNECTION_TIMEOUT = 30000;
  private readonly DOWNLOAD_TIMEOUT = 45000;
  private readonly MEGA_BATCH_SIZE = 500; // Max cruises per bulk download operation
  
  // Circuit breaker state
  private circuitBreakerState = {
    failureCount: 0,
    lastFailureTime: 0,
    isOpen: false
  };
  private readonly CIRCUIT_FAILURE_THRESHOLD = 5;
  private readonly CIRCUIT_RESET_TIMEOUT = 60000; // 1 minute
  
  private constructor() {}
  
  static getInstance(): BulkFtpDownloaderService {
    if (!this.instance) {
      this.instance = new BulkFtpDownloaderService();
    }
    return this.instance;
  }
  
  /**
   * Download all cruise files for a specific line with mega-batch processing
   * This is the main entry point for bulk downloads - optimized for large cruise lines
   * Handles mega-batches of up to 500 cruises to prevent FTP overload
   */
  async downloadLineUpdates(
    lineId: number, 
    cruiseInfos: CruiseInfo[]
  ): Promise<BulkDownloadResult> {
    const downloadStartTime = new Date().toISOString();
    logger.info('🔧 [BULK-FTP-START] Starting bulk FTP download operation', {
      lineId,
      cruiseInfosCount: cruiseInfos.length,
      sampleCruiseIds: cruiseInfos.slice(0, 3).map(c => c.id),
      stage: 'BULK_DOWNLOAD_START',
      downloadStartTime,
      megaBatchLimit: this.MEGA_BATCH_SIZE,
      maxConnections: this.MAX_CONNECTIONS
    });
    
    // Enforce mega-batch size limit
    if (cruiseInfos.length > this.MEGA_BATCH_SIZE) {
      logger.warn(`⚠️ Cruise list too large (${cruiseInfos.length}). Processing first ${this.MEGA_BATCH_SIZE} cruises to prevent FTP overload`, {
        lineId,
        totalCruises: cruiseInfos.length,
        processingCount: this.MEGA_BATCH_SIZE
      });
      cruiseInfos = cruiseInfos.slice(0, this.MEGA_BATCH_SIZE);
    }
    if (this.circuitBreakerState.isOpen) {
      const timeSinceFailure = Date.now() - this.circuitBreakerState.lastFailureTime;
      if (timeSinceFailure < this.CIRCUIT_RESET_TIMEOUT) {
        throw new Error(`Circuit breaker is OPEN for FTP downloads. Retry in ${Math.round((this.CIRCUIT_RESET_TIMEOUT - timeSinceFailure) / 1000)}s`);
      } else {
        // Reset circuit breaker
        this.circuitBreakerState.isOpen = false;
        this.circuitBreakerState.failureCount = 0;
        logger.info('🔄 Circuit breaker reset for FTP bulk downloads');
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
      parseErrors: 0
    };
    
    let client: ftp.Client | null = null;
    
    try {
      // Get or create FTP connection
      logger.info('📡 [FTP-CONNECTION] Attempting FTP connection', { 
        lineId,
        stage: 'FTP_CONNECTION_ATTEMPT',
        connectionAttemptTime: new Date().toISOString(),
        host: env.TRAVELTEK_FTP_HOST ? env.TRAVELTEK_FTP_HOST.substring(0, 10) + '***' : 'MISSING',
        poolSize: this.connectionPool.length
      });
      
      client = await this.getConnection();
      
      logger.info('✅ [FTP-CONNECTION] FTP connection established successfully', { 
        lineId,
        stage: 'FTP_CONNECTION_SUCCESS',
        connectionTime: new Date().toISOString(),
        connectionDuration: Date.now() - startTime
      });
      
      logger.info(`🚀 [BULK-DOWNLOAD] Starting bulk download for line ${lineId}`, {
        totalFiles: cruiseInfos.length,
        ships: Array.from(new Set(cruiseInfos.map(c => c.shipName))).length,
        avgFilesPerShip: Math.round(cruiseInfos.length / Array.from(new Set(cruiseInfos.map(c => c.shipName))).length),
        webhookLineId: getWebhookLineId(lineId),
        stage: 'BULK_DOWNLOAD_CONFIG',
        downloadConfig: {
          megaBatchSize: this.MEGA_BATCH_SIZE,
          maxConnections: this.MAX_CONNECTIONS,
          chunkSize: this.CHUNK_SIZE,
          downloadTimeout: this.DOWNLOAD_TIMEOUT
        },
        sampleCruiseInfo: cruiseInfos.slice(0, 2).map(c => ({
          id: c.id,
          shipId: c.shipId,
          shipName: c.shipName,
          sailingYear: c.sailingDate.getFullYear(),
          sailingMonth: String(c.sailingDate.getMonth() + 1).padStart(2, '0')
        })),
        pathStructureNote: 'Using /YYYY/MM/LINEID/SHIPID/CRUISEID.json format'
      });
      
      // Group cruises by ship for optimal FTP directory navigation
      const cruisesByShip = this.groupCruisesByShip(cruiseInfos);
      const shipNames = Array.from(cruisesByShip.keys());
      
      logger.info(`📊 Organized ${cruiseInfos.length} cruises across ${shipNames.length} ships`, {
        shipsWithMostCruises: Array.from(cruisesByShip.entries())
          .sort(([,a], [,b]) => b.length - a.length)
          .slice(0, 3)
          .map(([ship, cruises]) => ({ ship, count: cruises.length }))
      });
      
      // Process ships in chunks optimized for mega-batches
      const shipsPerChunk = Math.max(1, Math.ceil(shipNames.length / this.MAX_CONNECTIONS));
      logger.info('🔄 [BULK-PROCESSING] Starting ship processing in chunks', {
        totalShips: shipNames.length,
        shipsPerChunk,
        totalChunks: Math.ceil(shipNames.length / shipsPerChunk),
        stage: 'SHIP_PROCESSING_START',
        processingStartTime: new Date().toISOString()
      });
      
      for (let i = 0; i < shipNames.length; i += shipsPerChunk) {
        const shipChunk = shipNames.slice(i, i + shipsPerChunk);
        const chunkNumber = Math.floor(i / shipsPerChunk) + 1;
        const totalChunks = Math.ceil(shipNames.length / shipsPerChunk);
        
        const chunkCruiseCount = shipChunk.reduce((sum, ship) => sum + cruisesByShip.get(ship)!.length, 0);
        logger.info(`🚢 [CHUNK-PROGRESS] Processing ship chunk ${chunkNumber}/${totalChunks}`, {
          ships: shipChunk,
          cruiseCount: chunkCruiseCount,
          stage: 'CHUNK_PROCESSING',
          chunkStartTime: new Date().toISOString(),
          progressBefore: `${result.successfulDownloads}/${cruiseInfos.length} files downloaded`
        });
        
        // Process ships in this chunk using shared connection
        await this.downloadShipChunk(client, lineId, shipChunk, cruisesByShip, result);
        
        const progressPercent = Math.round((result.successfulDownloads / cruiseInfos.length) * 100);
        logger.info(`✅ [CHUNK-COMPLETE] Completed ship chunk ${chunkNumber}/${totalChunks}`, {
          currentSuccessful: result.successfulDownloads,
          currentFailed: result.failedDownloads,
          downloadedDataSize: result.downloadedData.size,
          stage: 'CHUNK_COMPLETED',
          progress: `${result.successfulDownloads}/${cruiseInfos.length} files downloaded (${progressPercent}%)`,
          chunkCompletedTime: new Date().toISOString()
        });
        
        // Minimal delay between chunks for mega-batch efficiency
        if (i + shipsPerChunk < shipNames.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      result.duration = Date.now() - startTime;
      
      logger.info(`✅ Bulk download completed for line ${lineId} - FIXED PATH STRUCTURE`, {
        totalFiles: result.totalFiles,
        successful: result.successfulDownloads,
        failed: result.failedDownloads,
        duration: `${(result.duration / 1000).toFixed(2)}s`,
        successRate: `${Math.round((result.successfulDownloads / result.totalFiles) * 100)}%`,
        connectionFailures: result.connectionFailures,
        fileNotFoundErrors: result.fileNotFoundErrors,
        parseErrors: result.parseErrors,
        pathStructureNote: 'Now using correct /YYYY/MM/LINEID/SHIPID/CRUISEID.json format',
        improvementExpected: 'Success rate should be significantly higher than previous 4-24%'
      });
      
    } catch (error) {
      logger.error(`❌ Bulk download failed for line ${lineId}:`, error);
      result.errors.push(`Fatal error: ${error.message}`);
    } finally {
      // Return connection to pool for reuse
      if (client) {
        this.returnConnection(client);
      }
    }
    
    return result;
  }
  
  /**
   * Group cruises by ship for efficient FTP navigation
   * Uses shipId primarily, falls back to processed shipName
   */
  private groupCruisesByShip(cruiseInfos: CruiseInfo[]): Map<string, CruiseInfo[]> {
    const groups = new Map<string, CruiseInfo[]>();
    
    for (const cruise of cruiseInfos) {
      // Priority: use shipId if available, otherwise process shipName
      let shipKey: string;
      if (cruise.shipId) {
        shipKey = cruise.shipId;
      } else {
        // Process ship name: replace spaces with underscores, remove special characters
        shipKey = cruise.shipName
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .replace(/\s+/g, '_')
          .toLowerCase();
      }
      
      if (!groups.has(shipKey)) {
        groups.set(shipKey, []);
      }
      groups.get(shipKey)!.push(cruise);
    }
    
    logger.debug('🚢 BULK FTP DEBUG: Grouped cruises by ship', {
      totalCruises: cruiseInfos.length,
      uniqueShips: groups.size,
      shipKeys: Array.from(groups.keys()).slice(0, 5)
    });
    
    return groups;
  }
  
  /**
   * Download files for multiple ships using a shared connection
   */
  private async downloadShipChunk(
    client: ftp.Client,
    lineId: number,
    shipNames: string[],
    cruisesByShip: Map<string, CruiseInfo[]>,
    result: BulkDownloadResult
  ): Promise<void> {
    for (const shipKey of shipNames) {
      const cruises = cruisesByShip.get(shipKey)!;
      await this.downloadShipFiles(client, lineId, shipKey, cruises, result);
      
      // Small delay between ships to prevent overwhelming the server
      if (shipNames.indexOf(shipKey) < shipNames.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  
  /**
   * Download all files for a specific ship
   * FIXED: Now uses correct FTP path structure: /YYYY/MM/LINEID/SHIPID/CRUISEID.json
   */
  private async downloadShipFiles(
    client: ftp.Client,
    lineId: number,
    shipKey: string,
    cruises: CruiseInfo[],
    result: BulkDownloadResult
  ): Promise<void> {
    logger.info(`🚢 BULK FTP DEBUG: Starting ship ${shipKey}`, {
      lineId,
      shipKey,
      cruiseCount: cruises.length,
      cruiseIds: cruises.slice(0, 3).map(c => c.id),
      sampleSailingDates: cruises.slice(0, 3).map(c => c.sailingDate.toISOString().split('T')[0]),
      sampleShipIds: cruises.slice(0, 3).map(c => c.shipId)
    });
    
    // Get the webhook line ID for FTP path construction
    // FTP structure uses webhook line IDs, not database line IDs
    const webhookLineId = getWebhookLineId(lineId);
    
    logger.info(`📁 BULK FTP DEBUG: Using webhook line ID ${webhookLineId} for FTP paths (database line ID: ${lineId})`, {
      lineId,
      webhookLineId,
      shipKey
    });
    
    // Download all cruise files for this ship - each cruise has its own specific path
    let shipSuccessful = 0;
    let shipFailed = 0;
    
    for (let i = 0; i < cruises.length; i++) {
      const cruise = cruises[i];
      const beforeDownload = result.successfulDownloads;
      
      // Log individual cruise download progress every 10 files or for first/last files
      if (i % 10 === 0 || i === cruises.length - 1 || i === 0) {
        logger.info(`📥 [FILE-DOWNLOAD] Downloading cruise file ${i + 1}/${cruises.length} for ship ${shipKey}`, {
          cruiseId: cruise.id,
          shipKey,
          lineId,
          progress: `File ${i + 1}/${cruises.length}`,
          overallProgress: `${result.successfulDownloads}/${result.totalFiles} total files`,
          stage: 'INDIVIDUAL_FILE_DOWNLOAD'
        });
      }
      
      await this.downloadSingleCruiseFile(client, lineId, cruise, result);
      
      if (result.successfulDownloads > beforeDownload) {
        shipSuccessful++;
      } else {
        shipFailed++;
      }
      
      // Minimal delay for mega-batch efficiency - reduced from 100ms to 50ms
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    logger.info(`✅ BULK FTP DEBUG: Completed ship ${shipKey}`, {
      shipSuccessful,
      shipFailed,
      successRate: shipSuccessful > 0 ? `${Math.round((shipSuccessful / cruises.length) * 100)}%` : '0%',
      totalSuccessful: result.successfulDownloads,
      downloadedDataSize: result.downloadedData.size
    });
  }
  
  /**
   * Download a single cruise file with comprehensive error handling
   * FIXED: Now constructs correct FTP path: /YYYY/MM/LINEID/SHIPID/CRUISEID.json
   */
  private async downloadSingleCruiseFile(
    client: ftp.Client,
    lineId: number,
    cruise: CruiseInfo,
    result: BulkDownloadResult
  ): Promise<void> {
    const sailingYear = cruise.sailingDate.getFullYear();
    const sailingMonth = String(cruise.sailingDate.getMonth() + 1).padStart(2, '0');
    const webhookLineId = getWebhookLineId(lineId);
    const fileName = `${cruise.id}.json`;
    
    // Construct the correct FTP path: /YYYY/MM/LINEID/SHIPID/CRUISEID.json
    const possiblePaths: string[] = [];
    
    // Use numeric ship ID if available
    if (cruise.shipId) {
      possiblePaths.push(`/${sailingYear}/${sailingMonth}/${webhookLineId}/${cruise.shipId}/${fileName}`);
      possiblePaths.push(`/isell_json/${sailingYear}/${sailingMonth}/${webhookLineId}/${cruise.shipId}/${fileName}`);
    }
    
    // Fallback: try with processed ship name as ID (some systems might use this)
    const processedShipName = cruise.shipName
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase();
    possiblePaths.push(`/${sailingYear}/${sailingMonth}/${webhookLineId}/${processedShipName}/${fileName}`);
    possiblePaths.push(`/isell_json/${sailingYear}/${sailingMonth}/${webhookLineId}/${processedShipName}/${fileName}`);
    
    // Additional variations with cruise code as filename
    if (cruise.cruiseCode && cruise.cruiseCode !== cruise.id) {
      const cruiseCodeFileName = `${cruise.cruiseCode}.json`;
      if (cruise.shipId) {
        possiblePaths.push(`/${sailingYear}/${sailingMonth}/${webhookLineId}/${cruise.shipId}/${cruiseCodeFileName}`);
        possiblePaths.push(`/isell_json/${sailingYear}/${sailingMonth}/${webhookLineId}/${cruise.shipId}/${cruiseCodeFileName}`);
      }
      possiblePaths.push(`/${sailingYear}/${sailingMonth}/${webhookLineId}/${processedShipName}/${cruiseCodeFileName}`);
      possiblePaths.push(`/isell_json/${sailingYear}/${sailingMonth}/${webhookLineId}/${processedShipName}/${cruiseCodeFileName}`);
    }
    
    // Remove duplicates
    const uniquePaths = [...new Set(possiblePaths)];
    
    logger.debug(`📥 BULK FTP DEBUG: Attempting to download cruise file`, {
      cruiseId: cruise.id,
      cruiseCode: cruise.cruiseCode,
      shipName: cruise.shipName,
      shipId: cruise.shipId,
      sailingDate: cruise.sailingDate.toISOString().split('T')[0],
      sailingYearMonth: `${sailingYear}/${sailingMonth}`,
      webhookLineId,
      possiblePaths: uniquePaths.slice(0, 5),
      totalPathsToTry: uniquePaths.length
    });
    
    let data: string | null = null;
    let successfulPath = '';
    
    try {
      // Try each possible path until one works
      for (const filePath of uniquePaths) {
        try {
          logger.debug(`🔍 BULK FTP DEBUG: Trying path: ${filePath}`);
          
          // Download with timeout protection
          const downloadPromise = this.downloadFileFromPath(client, filePath);
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Download timeout')), this.DOWNLOAD_TIMEOUT);
          });
          
          data = await Promise.race([downloadPromise, timeoutPromise]);
          
          if (data) {
            successfulPath = filePath;
            logger.debug(`✅ BULK FTP DEBUG: Successfully downloaded from: ${filePath}`);
            break;
          }
        } catch (pathError) {
          const pathErrorMsg = pathError instanceof Error ? pathError.message : 'Unknown error';
          logger.debug(`❌ BULK FTP DEBUG: Failed path ${filePath}: ${pathErrorMsg}`);
          continue;
        }
      }
      
      if (!data) {
        throw new Error(`All ${uniquePaths.length} path variations failed. Paths tried: ${uniquePaths.slice(0, 3).join(', ')}${uniquePaths.length > 3 ? '...' : ''}`);
      }
      
      logger.debug(`📋 BULK FTP DEBUG: Data received for ${cruise.id}`, {
        dataLength: data.length,
        dataPreview: data.substring(0, 100),
        isValidJson: data.trim().startsWith('{') && data.trim().endsWith('}'),
        successfulPath
      });
      
      let jsonData;
      try {
        jsonData = JSON.parse(data);
      } catch (parseError) {
        throw new Error(`JSON parse failed: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`);
      }
      
      result.downloadedData.set(cruise.id, jsonData);
      result.successfulDownloads++;
      
      logger.debug(`✅ BULK FTP DEBUG: Successfully processed cruise ${cruise.id}`, {
        cruiseId: cruise.id,
        dataSize: data.length,
        totalDownloaded: result.successfulDownloads,
        usedPath: successfulPath
      });
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`🚨 BULK FTP DEBUG: Failed to download cruise ${cruise.id}`, {
        cruiseId: cruise.id,
        cruiseCode: cruise.cruiseCode,
        shipName: cruise.shipName,
        shipId: cruise.shipId,
        sailingDate: cruise.sailingDate.toISOString().split('T')[0],
        sailingYearMonth: `${sailingYear}/${sailingMonth}`,
        webhookLineId,
        pathsAttempted: uniquePaths.length,
        samplePaths: uniquePaths.slice(0, 3),
        error: errorMsg,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown'
      });
      
      result.failedDownloads++;
      result.errors.push(`${cruise.id} (${cruise.shipName}): ${errorMsg}`);
      
      // Categorize errors for better reporting
      if (errorMsg.includes('timeout') || errorMsg.includes('connection') || errorMsg.includes('ECONNRESET')) {
        result.connectionFailures++;
      } else if (errorMsg.includes('not found') || errorMsg.includes('No such file') || errorMsg.includes('path variations failed')) {
        result.fileNotFoundErrors++;
      } else if (errorMsg.includes('JSON') || errorMsg.includes('parse')) {
        result.parseErrors++;
      }
    }
  }
  
  /**
   * Download file from full FTP path using streaming approach
   * FIXED: Uses full path instead of relying on directory navigation
   */
  private async downloadFileFromPath(client: ftp.Client, fullPath: string): Promise<string> {
    logger.debug(`💾 BULK FTP DEBUG: downloadFileFromPath called for ${fullPath}`);
    
    const chunks: Buffer[] = [];
    
    const memoryStream = new Writable({
      write(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
        logger.debug(`💾 BULK FTP DEBUG: Received chunk for ${fullPath}`, {
          chunkSize: chunk.length,
          totalChunks: chunks.length + 1
        });
        chunks.push(chunk);
        callback();
      }
    });
    
    logger.debug(`💾 BULK FTP DEBUG: Starting client.downloadTo for ${fullPath}`);
    
    try {
      await client.downloadTo(memoryStream, fullPath);
      
      const result = Buffer.concat(chunks).toString('utf-8');
      
      logger.debug(`✅ BULK FTP DEBUG: downloadFileFromPath completed for ${fullPath}`, {
        totalChunks: chunks.length,
        totalSize: result.length,
        preview: result.substring(0, 100)
      });
      
      return result;
    } catch (error) {
      logger.error(`🚨 BULK FTP DEBUG: downloadFileFromPath failed for ${fullPath}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        chunksReceived: chunks.length
      });
      throw error;
    }
  }

  /**
   * Download file content to memory using streaming approach
   * DEPRECATED: Use downloadFileFromPath instead for correct path handling
   */
  private async downloadFileToMemory(client: ftp.Client, fileName: string): Promise<string> {
    logger.debug(`💾 BULK FTP DEBUG: downloadFileToMemory called for ${fileName}`);
    
    const chunks: Buffer[] = [];
    
    const memoryStream = new Writable({
      write(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
        logger.debug(`💾 BULK FTP DEBUG: Received chunk for ${fileName}`, {
          chunkSize: chunk.length,
          totalChunks: chunks.length + 1
        });
        chunks.push(chunk);
        callback();
      }
    });
    
    logger.debug(`💾 BULK FTP DEBUG: Starting client.downloadTo for ${fileName}`);
    
    try {
      await client.downloadTo(memoryStream, fileName);
      
      const result = Buffer.concat(chunks).toString('utf-8');
      
      logger.debug(`✅ BULK FTP DEBUG: downloadFileToMemory completed for ${fileName}`, {
        totalChunks: chunks.length,
        totalSize: result.length,
        preview: result.substring(0, 100)
      });
      
      return result;
    } catch (error) {
      logger.error(`🚨 BULK FTP DEBUG: downloadFileToMemory failed for ${fileName}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        chunksReceived: chunks.length
      });
      throw error;
    }
  }
  
  /**
   * Get a connection from the pool or create a new one with circuit breaker
   */
  private async getConnection(): Promise<ftp.Client> {
    logger.info('🔗 BULK FTP DEBUG: Getting FTP connection', {
      poolSize: this.connectionPool.length,
      circuitBreakerOpen: this.circuitBreakerState.isOpen,
      circuitFailureCount: this.circuitBreakerState.failureCount
    });
    
    // Try to reuse existing connection
    if (this.connectionPool.length > 0) {
      const client = this.connectionPool.pop()!;
      
      // Test if connection is still alive
      try {
        await client.pwd();
        logger.debug('♻️ Reusing existing FTP connection');
        return client;
      } catch (error) {
        logger.debug('💀 Pooled connection was dead, creating new one', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        try {
          await client.close();
        } catch {
          // Ignore close errors
        }
      }
    }
    
    // Create new connection with circuit breaker protection
    try {
      // Enhanced logging to diagnose credential loading issues
      const credentialStatus = {
        hostStatus: env.TRAVELTEK_FTP_HOST ? 'LOADED' : 'MISSING',
        hostPreview: env.TRAVELTEK_FTP_HOST ? env.TRAVELTEK_FTP_HOST.substring(0, 10) + '***' : 'MISSING',
        userStatus: env.TRAVELTEK_FTP_USER ? 'LOADED' : 'MISSING',
        userPreview: env.TRAVELTEK_FTP_USER ? env.TRAVELTEK_FTP_USER.substring(0, 3) + '***' : 'MISSING',
        passwordStatus: env.TRAVELTEK_FTP_PASSWORD ? 'LOADED' : 'MISSING',
        rawEnvCheck: {
          HOST_RAW: process.env.TRAVELTEK_FTP_HOST ? 'LOADED' : 'MISSING',
          USER_RAW: process.env.TRAVELTEK_FTP_USER ? 'LOADED' : 'MISSING',
          PASSWORD_RAW: process.env.TRAVELTEK_FTP_PASSWORD ? 'LOADED' : 'MISSING'
        }
      };
      
      logger.info('🔌 BULK FTP DEBUG: Creating new FTP connection with credential status check', {
        ...credentialStatus,
        timeout: this.CONNECTION_TIMEOUT,
        nodeEnv: process.env.NODE_ENV || 'UNDEFINED',
        stage: 'PRE_CONNECTION'
      });
      
      if (!env.TRAVELTEK_FTP_HOST || !env.TRAVELTEK_FTP_USER || !env.TRAVELTEK_FTP_PASSWORD) {
        throw new Error('Missing FTP credentials: TRAVELTEK_FTP_HOST, TRAVELTEK_FTP_USER, or TRAVELTEK_FTP_PASSWORD not configured');
      }
      
      const client = new ftp.Client();
      client.ftp.verbose = false;
      
      // Set connection timeout
      const connectPromise = client.access({
        host: env.TRAVELTEK_FTP_HOST,
        user: env.TRAVELTEK_FTP_USER,
        password: env.TRAVELTEK_FTP_PASSWORD,
        secure: false
      });
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), this.CONNECTION_TIMEOUT);
      });
      
      await Promise.race([connectPromise, timeoutPromise]);
      
      logger.info('📡 Established new FTP connection successfully');
      
      // Reset circuit breaker on successful connection
      if (this.circuitBreakerState.failureCount > 0) {
        this.circuitBreakerState.failureCount = 0;
        logger.info('✅ Circuit breaker reset after successful FTP connection');
      }
      
      return client;
      
    } catch (error) {
      // Update circuit breaker state
      this.circuitBreakerState.failureCount++;
      this.circuitBreakerState.lastFailureTime = Date.now();
      
      if (this.circuitBreakerState.failureCount >= this.CIRCUIT_FAILURE_THRESHOLD) {
        this.circuitBreakerState.isOpen = true;
        logger.error(`🚨 Circuit breaker OPENED after ${this.circuitBreakerState.failureCount} FTP connection failures`);
      }
      
      const errorMsg = error instanceof Error ? error.message : 'Unknown connection error';
      throw new Error(`FTP connection failed: ${errorMsg}`);
    }
  }
  
  /**
   * Return a connection to the pool for reuse
   */
  private returnConnection(client: ftp.Client): void {
    if (this.connectionPool.length < this.MAX_CONNECTIONS) {
      this.connectionPool.push(client);
      logger.debug(`📥 Returned connection to pool (pool size: ${this.connectionPool.length})`);
    } else {
      // Pool is full, close this connection
      try {
        client.close();
        logger.debug('🔒 Pool full, closed excess connection');
      } catch (error) {
        logger.debug('Error closing excess connection:', error);
      }
    }
  }
  
  /**
   * Get comprehensive stats for monitoring
   */
  getStats(): {
    connectionPoolSize: number;
    maxConnections: number;
    circuitBreakerState: {
      isOpen: boolean;
      failureCount: number;
      lastFailureTime: string | null;
    };
    chunkSize: number;
  } {
    return {
      connectionPoolSize: this.connectionPool.length,
      maxConnections: this.MAX_CONNECTIONS,
      circuitBreakerState: {
        isOpen: this.circuitBreakerState.isOpen,
        failureCount: this.circuitBreakerState.failureCount,
        lastFailureTime: this.circuitBreakerState.lastFailureTime ? 
          new Date(this.circuitBreakerState.lastFailureTime).toISOString() : null
      },
      chunkSize: this.CHUNK_SIZE
    };
  }
  
  /**
   * Reset circuit breaker manually (for admin recovery)
   */
  resetCircuitBreaker(): void {
    this.circuitBreakerState.failureCount = 0;
    this.circuitBreakerState.isOpen = false;
    this.circuitBreakerState.lastFailureTime = 0;
    logger.info('🔄 Manually reset bulk FTP downloader circuit breaker');
  }
  
  /**
   * Get cruise information for bulk download processing with mega-batch limit
   */
  async getCruiseInfoForLine(lineId: number, megaBatchSize?: number): Promise<CruiseInfo[]> {
    const limit = megaBatchSize || this.MEGA_BATCH_SIZE;
    
    logger.info('📦 BULK FTP DEBUG: Starting database query for cruise info', {
      lineId,
      limit
    });
    
    try {
      const cruiseData = await db
        .select({
          id: cruises.id,
          cruiseCode: cruises.cruiseId,
          shipId: cruises.shipId,
          shipName: sql<string>`COALESCE(ships.name, 'Unknown_Ship')`,
          sailingDate: cruises.sailingDate
        })
        .from(cruises)
        .leftJoin(ships, sql`${ships.id} = ${cruises.shipId}`)
        .where(
          sql`${cruises.cruiseLineId} = ${lineId} 
              AND ${cruises.sailingDate} >= CURRENT_DATE 
              AND ${cruises.sailingDate} <= CURRENT_DATE + INTERVAL '2 years'
              AND ${cruises.isActive} = true`
        )
        .orderBy(sql`${cruises.sailingDate} ASC`)
        .limit(limit);
        
      logger.info('✅ BULK FTP DEBUG: Database query completed successfully', {
        lineId,
        rowCount: cruiseData.length
      });

      const results = cruiseData.map(cruise => ({
        id: cruise.id,
        cruiseCode: cruise.cruiseCode,
        shipId: cruise.shipId,
        shipName: cruise.shipName || `Ship_${cruise.id}`,
        sailingDate: new Date(cruise.sailingDate)
      }));

      if (results.length === limit) {
        logger.warn(`📊 Limited cruise list to ${limit} cruises for line ${lineId} to prevent FTP overload`);
      }

      logger.info('✅ BULK FTP DEBUG: Cruise info processing completed', {
        lineId,
        resultCount: results.length,
        sampleCruiseIds: results.slice(0, 3).map(r => r.id)
      });

      return results;
      
    } catch (error) {
      logger.error('🚨 BULK FTP DEBUG: Database query failed', {
        lineId,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : 'No stack'
      });
      
      // Re-throw with more context
      throw new Error(`Failed to get cruise info for line ${lineId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process cruise updates from downloaded data
   * Updates database with all pricing information from the bulk download
   */
  async processCruiseUpdates(
    lineId: number,
    downloadResult: BulkDownloadResult
  ): Promise<{
    successful: number;
    failed: number;
    actuallyUpdated: number;
    errors: string[];
  }> {
    const result = {
      successful: 0,
      failed: 0,
      actuallyUpdated: 0,
      errors: []
    };

    const processingStartTime = new Date().toISOString();
    logger.info(`🔄 [DATABASE-PROCESSING] Starting cruise data processing`, {
      lineId,
      downloadedDataSize: downloadResult.downloadedData.size,
      totalFiles: downloadResult.totalFiles,
      successfulDownloads: downloadResult.successfulDownloads,
      failedDownloads: downloadResult.failedDownloads,
      stage: 'DATABASE_PROCESSING_START',
      processingStartTime,
      downloadedDataKeys: Array.from(downloadResult.downloadedData.keys()).slice(0, 5)
    });
    
    if (downloadResult.downloadedData.size === 0) {
      logger.error(`🚨 [DATABASE-PROCESSING] No data to process! downloadedData.size is 0`, {
        totalFiles: downloadResult.totalFiles,
        successfulDownloads: downloadResult.successfulDownloads,
        errors: downloadResult.errors.slice(0, 3),
        stage: 'NO_DATA_TO_PROCESS'
      });
      return result;
    }

    let processedCount = 0;
    const totalToProcess = downloadResult.downloadedData.size;

    for (const [cruiseId, cruiseData] of downloadResult.downloadedData) {
      processedCount++;
      
      // Log progress every 25 items or for first/last items
      if (processedCount % 25 === 0 || processedCount === totalToProcess || processedCount === 1) {
        logger.info(`💽 [DATABASE-UPDATE] Processing cruise ${processedCount}/${totalToProcess}`, {
          cruiseId,
          progress: `${processedCount}/${totalToProcess} cruises processed`,
          stage: 'DATABASE_UPDATING',
          hasData: !!cruiseData,
          dataKeys: cruiseData ? Object.keys(cruiseData).slice(0, 5) : []
        });
      }
      
      try {
        // Update pricing in database from cached data
        await this.updatePricingFromCachedData(cruiseId, cruiseData);
        result.successful++;
        result.actuallyUpdated++;
        
        if (processedCount % 50 === 0 || processedCount === totalToProcess) {
          logger.info(`✅ [DATABASE-UPDATE] Successfully updated cruise ${cruiseId}`, {
            successful: result.successful,
            actuallyUpdated: result.actuallyUpdated,
            progress: `${processedCount}/${totalToProcess} cruises processed`,
            stage: 'DATABASE_UPDATE_SUCCESS'
          });
        }
      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`${cruiseId}: ${errorMsg}`);
        
        logger.error(`🚨 [DATABASE-UPDATE] Failed to update cruise ${cruiseId}`, {
          error: errorMsg,
          failed: result.failed,
          progress: `${processedCount}/${totalToProcess} cruises processed`,
          stage: 'DATABASE_UPDATE_FAILED'
        });
      }
    }

    const processingCompletedTime = new Date().toISOString();
    logger.info(`✅ [DATABASE-PROCESSING] Completed processing cached cruise data`, {
      lineId,
      successful: result.successful,
      failed: result.failed,
      actuallyUpdated: result.actuallyUpdated,
      stage: 'DATABASE_PROCESSING_COMPLETE',
      processingStartTime,
      processingCompletedTime,
      totalProcessed: processedCount,
      successRate: `${Math.round((result.successful / totalToProcess) * 100)}%`
    });

    return result;
  }

  /**
   * Update pricing data from cached cruise data
   */
  private async updatePricingFromCachedData(cruiseId: string, data: any): Promise<void> {
    logger.debug(`💽 BULK FTP DEBUG: Starting database update for cruise ${cruiseId}`);
    
    try {
      // Delete existing pricing with timeout
      logger.debug(`🗑️ BULK FTP DEBUG: Deleting existing pricing for cruise ${cruiseId}`);
      await db.execute(sql`DELETE FROM pricing WHERE cruise_id = ${cruiseId}`);
      
      logger.debug(`✅ BULK FTP DEBUG: Existing pricing deleted for cruise ${cruiseId}`);

      // Process and insert new pricing data
      if (data.prices && typeof data.prices === 'object') {
        for (const [rateCode, cabins] of Object.entries(data.prices)) {
          if (typeof cabins !== 'object') continue;

          for (const [cabinCode, occupancies] of Object.entries(cabins as any)) {
            if (typeof occupancies !== 'object') continue;

            for (const [occupancyCode, pricingData] of Object.entries(occupancies as any)) {
              if (typeof pricingData !== 'object') continue;

              const pricing = pricingData as any;
            
              // Skip if no valid price
              if (!pricing.price && !pricing.adultprice) continue;

              const totalPrice = this.calculateTotalPrice(pricing);

              await db.execute(sql`
              INSERT INTO pricing (
                cruise_id, rate_code, cabin_code, occupancy_code, cabin_type,
                base_price, adult_price, child_price, infant_price, single_price,
                third_adult_price, fourth_adult_price, taxes, ncf, gratuity,
                fuel, non_comm, port_charges, government_fees, total_price,
                commission, is_available, inventory, waitlist, guarantee, currency
              ) VALUES (
                ${cruiseId}, ${this.truncateString(rateCode, 50)}, ${this.truncateString(cabinCode, 10)},
                ${this.truncateString(occupancyCode, 10)}, ${pricing.cabintype || null},
                ${this.parseDecimal(pricing.price)}, ${this.parseDecimal(pricing.adultprice)},
                ${this.parseDecimal(pricing.childprice)}, ${this.parseDecimal(pricing.infantprice)},
                ${this.parseDecimal(pricing.singleprice)}, ${this.parseDecimal(pricing.thirdadultprice)},
                ${this.parseDecimal(pricing.fourthadultprice)}, ${this.parseDecimal(pricing.taxes) || 0},
                ${this.parseDecimal(pricing.ncf) || 0}, ${this.parseDecimal(pricing.gratuity) || 0},
                ${this.parseDecimal(pricing.fuel) || 0}, ${this.parseDecimal(pricing.noncomm) || 0},
                ${this.parseDecimal(pricing.portcharges) || 0}, ${this.parseDecimal(pricing.governmentfees) || 0},
                ${totalPrice}, ${this.parseDecimal(pricing.commission)}, ${pricing.available !== false},
                ${this.parseInteger(pricing.inventory)}, ${pricing.waitlist === true},
                ${pricing.guarantee === true}, ${data.currency || 'USD'}
              )
              `);
            }
          }
        }
      }
      
      logger.debug(`✅ BULK FTP DEBUG: Database update completed for cruise ${cruiseId}`);
      
    } catch (error) {
      logger.error(`🚨 BULK FTP DEBUG: Database update failed for cruise ${cruiseId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        cruiseId
      });
      throw error;
    }
  }

  /**
   * Helper methods for processing cached data
   */
  private calculateTotalPrice(pricing: any): number {
    const base = this.parseDecimal(pricing.price || pricing.adultprice) || 0;
    const taxes = this.parseDecimal(pricing.taxes) || 0;
    const ncf = this.parseDecimal(pricing.ncf) || 0;
    const gratuity = this.parseDecimal(pricing.gratuity) || 0;
    const fuel = this.parseDecimal(pricing.fuel) || 0;
    const portCharges = this.parseDecimal(pricing.portcharges) || 0;
    const governmentFees = this.parseDecimal(pricing.governmentfees) || 0;
    
    return base + taxes + ncf + gratuity + fuel + portCharges + governmentFees;
  }

  private parseDecimal(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  private parseInteger(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = parseInt(value);
    return isNaN(num) ? null : num;
  }

  private truncateString(str: string, maxLength: number): string {
    if (!str) return '';
    return str.length > maxLength ? str.substring(0, maxLength) : str;
  }

  /**
   * Clean up all connections
   */
  async cleanup(): Promise<void> {
    for (const client of this.connectionPool) {
      try {
        await client.close();
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.connectionPool = [];
    logger.info('🧹 Cleaned up all FTP connections');
  }
}

// Export singleton instance
export const bulkFtpDownloader = BulkFtpDownloaderService.getInstance();