import * as ftp from 'basic-ftp';
import { Client as FTPClient } from 'basic-ftp';
import logger from '../config/logger';
import { db } from '../db/connection';
import { cruises } from '../db/schema';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import redisClient from '../cache/redis';
// Import FTP parsing function
const parseCruiseXML = require('./ftp.service').parseCruiseXML;

interface ProcessingResult {
  cruiseCode: string;
  status: 'success' | 'error' | 'skipped';
  message: string;
  details?: any;
}

class WebhookKeepaliveService {
  // Processing configuration
  private readonly BATCH_SIZE = 3; // Even smaller batches
  private readonly PROCESSING_DELAY = 2000; // 2 seconds between cruises
  private readonly FTP_OPERATION_TIMEOUT = 30000; // 30 seconds for individual operations
  private readonly FTP_KEEPALIVE_INTERVAL = 30000; // Send keepalive every 30 seconds
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY = 5000; // 5 seconds

  async processWebhook(lineId: string): Promise<void> {
    const lockKey = `webhook:processing:${lineId}`;
    const lockTTL = 1800; // 30 minutes

    try {
      // Try to acquire lock
      // Check if key already exists
      const lockExists = await redisClient.exists(lockKey);

      if (lockExists) {
        logger.warn(`[${lineId}] Another webhook process is already running`);
        return;
      }

      // Set the lock with TTL
      await redisClient.set(lockKey, '1', lockTTL);

      logger.info(`[${lineId}] Starting webhook processing with keep-alive`);

      // Process in background
      this.processLineAsync(lineId, lockKey).catch(error => {
        logger.error(`[${lineId}] Background processing failed:`, error);
      });
    } catch (error) {
      logger.error(`[${lineId}] Failed to start webhook processing:`, error);
      await redisClient.del(lockKey);
      throw error;
    }
  }

  private async processLineAsync(lineId: string, lockKey: string): Promise<void> {
    const startTime = Date.now();
    let processedCount = 0;
    let errorCount = 0;

    try {
      // Get all cruises for this line
      const cruisesData = await this.getCruisesForLine(lineId);

      if (!cruisesData || cruisesData.length === 0) {
        logger.warn(`[${lineId}] No cruises found`);
        return;
      }

      logger.info(`[${lineId}] Found ${cruisesData.length} cruises to process`);

      // Process in small batches
      for (let i = 0; i < cruisesData.length; i += this.BATCH_SIZE) {
        const batch = cruisesData.slice(i, i + this.BATCH_SIZE);
        logger.info(
          `[${lineId}] Processing batch ${Math.floor(i / this.BATCH_SIZE) + 1} (${batch.length} cruises)`
        );

        // Process each cruise in the batch sequentially
        for (const cruise of batch) {
          const result = await this.processSingleCruiseWithRetry(cruise);

          if (result.status === 'success') {
            processedCount++;
          } else if (result.status === 'error') {
            errorCount++;
          }

          // Log result
          logger.info(`[${lineId}] ${result.cruiseCode}: ${result.status} - ${result.message}`);

          // Delay between cruises
          if (batch.indexOf(cruise) < batch.length - 1) {
            await this.delay(this.PROCESSING_DELAY);
          }
        }

        // Longer delay between batches
        if (i + this.BATCH_SIZE < cruisesData.length) {
          await this.delay(this.PROCESSING_DELAY * 2);
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);
      logger.info(
        `[${lineId}] Webhook processing completed in ${duration}s: ` +
          `${processedCount} successful, ${errorCount} errors, ` +
          `${cruisesData.length - processedCount - errorCount} skipped`
      );
    } catch (error) {
      logger.error(`[${lineId}] Webhook processing failed:`, error);
    } finally {
      // Release lock
      await redisClient.del(lockKey);
    }
  }

  private async processSingleCruiseWithRetry(cruise: any): Promise<ProcessingResult> {
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await this.processSingleCruise(cruise);
      } catch (error: any) {
        if (attempt === this.MAX_RETRIES) {
          return {
            cruiseCode: cruise.code,
            status: 'error',
            message: `Failed after ${this.MAX_RETRIES} attempts: ${error.message}`,
          };
        }

        logger.warn(
          `[${cruise.code}] Attempt ${attempt} failed, retrying in ${this.RETRY_DELAY}ms...`
        );
        await this.delay(this.RETRY_DELAY);
      }
    }

    return {
      cruiseCode: cruise.code,
      status: 'error',
      message: 'Max retries exceeded',
    };
  }

  private async processSingleCruise(cruise: any): Promise<ProcessingResult> {
    const cruiseCode = cruise.code;

    try {
      // Create a fresh FTP connection with keep-alive
      const ftpClient = await this.createFTPConnectionWithKeepalive();
      let keepAliveInterval: NodeJS.Timeout | null = null;

      try {
        // Set up keep-alive
        keepAliveInterval = setInterval(async () => {
          try {
            // Send NOOP command to keep connection alive
            await ftpClient.send('NOOP');
            logger.debug(`[${cruiseCode}] Keep-alive sent`);
          } catch (error: any) {
            logger.warn(`[${cruiseCode}] Keep-alive failed:`, error.message);
          }
        }, this.FTP_KEEPALIVE_INTERVAL);

        // Download and process the file
        const xmlContent = await this.downloadFileWithTimeout(
          ftpClient,
          `/cruise_xml/${cruiseCode}.xml`,
          cruiseCode
        );

        if (!xmlContent) {
          return {
            cruiseCode,
            status: 'error',
            message: 'Failed to download XML file',
          };
        }

        // Parse and update
        const parsedData = await parseCruiseXML(xmlContent);

        if (!parsedData) {
          return {
            cruiseCode,
            status: 'error',
            message: 'Failed to parse XML',
          };
        }

        // Update database
        await this.updateCruiseData(cruise.id, parsedData);

        // Clear cache for this cruise
        await redisClient.del(`cruise:${cruise.id}`);
        await redisClient.del(`cruise:${cruiseCode}`);

        return {
          cruiseCode,
          status: 'success',
          message: 'Updated successfully',
          details: {
            hasRates: parsedData.cheapest ? true : false,
            cheapestPrice: parsedData.cheapest?.combined?.inside || null,
          },
        };
      } finally {
        // Clean up keep-alive and connection
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
        }
        ftpClient.close();
      }
    } catch (error: any) {
      logger.error(`[${cruiseCode}] Processing failed:`, error);
      return {
        cruiseCode,
        status: 'error',
        message: error.message || 'Unknown error',
      };
    }
  }

  private async createFTPConnectionWithKeepalive(): Promise<FTPClient> {
    const ftpClient = new ftp.Client();

    // Set conservative timeouts
    // ftpClient.ftp.timeout = this.FTP_OPERATION_TIMEOUT; // Read-only property
    ftpClient.ftp.verbose = false; // Reduce logging noise

    const ftpConfig = {
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER || '',
      password: process.env.TRAVELTEK_FTP_PASSWORD || '',
      secure: false,
      secureOptions: { rejectUnauthorized: false },
    };

    await ftpClient.access(ftpConfig);

    // Ensure passive mode for better compatibility
    await ftpClient.ensureDir('/');

    return ftpClient;
  }

  private async downloadFileWithTimeout(
    ftpClient: FTPClient,
    filePath: string,
    cruiseCode: string
  ): Promise<string | null> {
    return new Promise(async resolve => {
      const timeout = setTimeout(() => {
        logger.warn(`[${cruiseCode}] Download timeout for ${filePath}`);
        resolve(null);
      }, this.FTP_OPERATION_TIMEOUT);

      try {
        // Download file using stream
        const stream = require('stream');
        const chunks: Buffer[] = [];
        const writable = new stream.Writable({
          write(chunk: Buffer, encoding: string, callback: Function) {
            chunks.push(chunk);
            callback();
          },
        });

        await ftpClient.downloadTo(writable, filePath);
        const buffer = chunks.length > 0 ? Buffer.concat(chunks) : null;

        if (buffer && buffer.length > 0) {
          clearTimeout(timeout);
          const content = buffer.toString('utf-8');
          resolve(content);
        } else {
          clearTimeout(timeout);
          resolve(null);
        }
      } catch (error: any) {
        clearTimeout(timeout);
        logger.error(`[${cruiseCode}] Download failed:`, error.message);
        resolve(null);
      }
    });
  }

  private async getCruisesForLine(lineId: string): Promise<any[]> {
    try {
      const cruisesData = await db
        .select({
          id: cruises.id,
          code: cruises.voyageCode,
          name: cruises.name,
          updated_at: cruises.updatedAt,
        })
        .from(cruises)
        .where(
          and(
            eq(cruises.ownerId, lineId),
            isNotNull(cruises.voyageCode),
            sql`${cruises.voyageCode} != ''`,
            eq(cruises.isActive, true)
          )
        )
        .orderBy(sql`${cruises.updatedAt} ASC NULLS FIRST`)
        .limit(500);

      return cruisesData || [];
    } catch (error) {
      logger.error(`Failed to get cruises for line ${lineId}:`, error);
      return [];
    }
  }

  private async updateCruiseData(cruiseId: string, parsedData: any): Promise<void> {
    const cheapestPrice = this.extractCheapestPrice(parsedData);

    await db
      .update(cruises)
      .set({
        rawData: parsedData,
        cheapestPrice: cheapestPrice,
        updatedAt: new Date(),
      })
      .where(eq(cruises.id, cruiseId));
  }

  private extractCheapestPrice(parsedData: any): number | null {
    if (!parsedData?.cheapest?.combined) {
      return null;
    }

    const prices = [
      parsedData.cheapest.combined.inside,
      parsedData.cheapest.combined.outside,
      parsedData.cheapest.combined.balcony,
      parsedData.cheapest.combined.suite,
    ]
      .filter(p => p && p > 0)
      .map(p => parseFloat(p));

    return prices.length > 0 ? Math.min(...prices) : null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const webhookKeepaliveService = new WebhookKeepaliveService();
