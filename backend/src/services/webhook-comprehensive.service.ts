/**
 * Comprehensive Webhook Service
 * Processes ALL cruises for a cruise line with robust error handling
 * Based on successful sync-complete-enhanced.js strategy
 */

import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import logger from '../config/logger';
import { traveltekFTPService } from './traveltek-ftp.service';
// import { slackService } from './slack.service'; // TODO: Add proper Slack integration
import { getDatabaseLineId } from '../config/cruise-line-mapping';
import redisClient from '../cache/redis';
import * as ftp from 'basic-ftp';
import { Writable } from 'stream';

interface ProcessingResult {
  lineId: number;
  totalCruises: number;
  processedCruises: number;
  successfulUpdates: number;
  failedUpdates: number;
  skippedFiles: number;
  corruptedFiles: number;
  batches: number;
  duration: number;
  errors: string[];
}

interface CruiseInfo {
  id: string;
  cruiseCode: string;
  shipId: number;
  shipName: string;
  sailingDate: Date;
}

export class ComprehensiveWebhookService {
  private readonly BATCH_SIZE = 100; // Process 100 files per batch
  private readonly MAX_CONCURRENT_DOWNLOADS = 10; // Download 10 files concurrently
  private readonly MAX_RETRIES = 3;
  private readonly FTP_TIMEOUT = 30000; // 30 seconds per file
  private readonly CONNECTION_POOL_SIZE = 3; // FTP connection pool
  private ftpPool: ftp.Client[] = [];

  /**
   * Main entry point for webhook processing
   */
  async processWebhook(lineId: number): Promise<ProcessingResult> {
    const startTime = Date.now();
    const databaseLineId = getDatabaseLineId(lineId);
    const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result: ProcessingResult = {
      lineId: databaseLineId,
      totalCruises: 0,
      processedCruises: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      skippedFiles: 0,
      corruptedFiles: 0,
      batches: 0,
      duration: 0,
      errors: [],
    };

    try {
      logger.info(`🚀 Starting comprehensive webhook processing for line ${databaseLineId}`, {
        webhookId,
        originalLineId: lineId,
        databaseLineId,
      });

      // Get ALL future cruises for this line
      const cruiseInfos = await this.getAllFutureCruisesForLine(databaseLineId);
      result.totalCruises = cruiseInfos.length;

      if (cruiseInfos.length === 0) {
        logger.warn(`No future cruises found for line ${databaseLineId}`);
        return result;
      }

      logger.info(`📊 Found ${cruiseInfos.length} future cruises to process`, {
        lineId: databaseLineId,
        firstSailing: cruiseInfos[0]?.sailingDate,
        lastSailing: cruiseInfos[cruiseInfos.length - 1]?.sailingDate,
      });

      // Initialize FTP connection pool
      await this.initializeFtpPool();

      // Process cruises in batches
      const batches = this.createBatches(cruiseInfos, this.BATCH_SIZE);
      result.batches = batches.length;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchStartTime = Date.now();

        logger.info(`📦 Processing batch ${i + 1}/${batches.length}`, {
          batchSize: batch.length,
          progress: `${Math.round((i / batches.length) * 100)}%`,
        });

        const batchResult = await this.processBatch(batch, databaseLineId);

        result.processedCruises += batchResult.processed;
        result.successfulUpdates += batchResult.successful;
        result.failedUpdates += batchResult.failed;
        result.skippedFiles += batchResult.skipped;
        result.corruptedFiles += batchResult.corrupted;

        logger.info(`✅ Batch ${i + 1}/${batches.length} completed`, {
          processed: batchResult.processed,
          successful: batchResult.successful,
          failed: batchResult.failed,
          duration: `${((Date.now() - batchStartTime) / 1000).toFixed(2)}s`,
        });

        // Send progress update to Slack every 5 batches
        if ((i + 1) % 5 === 0 || i === batches.length - 1) {
          await this.sendProgressUpdate(databaseLineId, i + 1, batches.length, result);
        }
      }

      result.duration = Date.now() - startTime;

      // Send final summary to Slack
      await this.sendFinalSummary(databaseLineId, result);

      logger.info(`🎉 Webhook processing completed for line ${databaseLineId}`, {
        ...result,
        durationSeconds: (result.duration / 1000).toFixed(2),
      });

      return result;
    } catch (error) {
      logger.error(`❌ Webhook processing failed for line ${databaseLineId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      result.duration = Date.now() - startTime;

      // Log error (Slack notification commented out for now)
      logger.error(`Webhook processing failed for line ${databaseLineId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        successful: result.successfulUpdates,
        failed: result.failedUpdates,
        duration: result.duration,
      });

      throw error;
    } finally {
      // Clean up FTP connections
      await this.closeFtpPool();
    }
  }

  /**
   * Get ALL future cruises for a line (no limit)
   */
  private async getAllFutureCruisesForLine(lineId: number): Promise<CruiseInfo[]> {
    try {
      const result = await db.execute(sql`
        SELECT
          c.id,
          c.cruise_id as cruise_code,
          c.ship_id,
          COALESCE(s.name, 'Unknown_Ship') as ship_name,
          c.sailing_date
        FROM cruises c
        LEFT JOIN ships s ON s.id = c.ship_id
        WHERE c.cruise_line_id = ${lineId}
          AND c.sailing_date >= CURRENT_DATE
          AND c.is_active = true
        ORDER BY c.sailing_date ASC
      `);

      return result.map((row: any) => ({
        id: row.id,
        cruiseCode: row.cruise_code,
        shipId: row.ship_id,
        shipName: row.ship_name,
        sailingDate: new Date(row.sailing_date),
      }));
    } catch (error) {
      logger.error(`Failed to get cruises for line ${lineId}:`, error);
      throw error;
    }
  }

  /**
   * Process a batch of cruises
   */
  private async processBatch(
    cruises: CruiseInfo[],
    lineId: number
  ): Promise<{
    processed: number;
    successful: number;
    failed: number;
    skipped: number;
    corrupted: number;
  }> {
    const result = { processed: 0, successful: 0, failed: 0, skipped: 0, corrupted: 0 };

    // Process cruises in smaller concurrent groups
    const concurrentGroups = this.createBatches(cruises, this.MAX_CONCURRENT_DOWNLOADS);

    for (const group of concurrentGroups) {
      const promises = group.map(cruise => this.processSingleCruise(cruise, lineId));
      const results = await Promise.allSettled(promises);

      for (const [index, promiseResult] of results.entries()) {
        result.processed++;

        if (promiseResult.status === 'fulfilled') {
          const cruiseResult = promiseResult.value;
          if (cruiseResult.success) {
            result.successful++;
          } else if (cruiseResult.skipped) {
            result.skipped++;
          } else if (cruiseResult.corrupted) {
            result.corrupted++;
          } else {
            result.failed++;
          }
        } else {
          result.failed++;
          logger.error(`Failed to process cruise ${group[index].cruiseCode}:`, {
            error: promiseResult.reason,
          });
        }
      }
    }

    return result;
  }

  /**
   * Process a single cruise with retry logic
   */
  private async processSingleCruise(
    cruise: CruiseInfo,
    lineId: number
  ): Promise<{ success: boolean; skipped: boolean; corrupted: boolean; error?: string }> {
    const year = cruise.sailingDate.getFullYear();
    const month = cruise.sailingDate.getMonth() + 1;
    const fileName = `${cruise.cruiseCode}.json`;
    const ftpPath = `/${year}/${month}/${lineId}/${fileName}`;

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < this.MAX_RETRIES) {
      attempts++;

      try {
        // Get an FTP connection from the pool
        const ftpClient = await this.getFtpConnection();

        // Download the file
        const jsonData = await this.downloadFile(ftpClient, ftpPath);

        if (!jsonData) {
          // File doesn't exist on FTP
          return { success: false, skipped: true, corrupted: false };
        }

        // Parse JSON with corruption detection
        const cruiseData = await this.parseJsonSafely(jsonData, cruise.cruiseCode);

        if (!cruiseData) {
          if (attempts === this.MAX_RETRIES) {
            logger.error(
              `❌ Corrupted JSON for cruise ${cruise.cruiseCode} after ${attempts} attempts`
            );
            return { success: false, skipped: false, corrupted: true };
          }
          // Retry on corruption
          continue;
        }

        // Update database with the cruise data
        await this.updateCruiseData(cruise.id, cruiseData);

        return { success: true, skipped: false, corrupted: false };
      } catch (error) {
        lastError = error as Error;

        if (attempts === this.MAX_RETRIES) {
          logger.error(
            `❌ Failed to process cruise ${cruise.cruiseCode} after ${attempts} attempts:`,
            {
              error: lastError.message,
            }
          );
          return {
            success: false,
            skipped: false,
            corrupted: false,
            error: lastError.message,
          };
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }

    return {
      success: false,
      skipped: false,
      corrupted: false,
      error: lastError?.message || 'Unknown error',
    };
  }

  /**
   * Download a file from FTP
   */
  private async downloadFile(ftpClient: ftp.Client, ftpPath: string): Promise<string | null> {
    const chunks: Buffer[] = [];

    const writable = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    try {
      await ftpClient.downloadTo(writable, ftpPath);
      const data = Buffer.concat(chunks).toString();
      return data;
    } catch (error: any) {
      if (error.code === 550) {
        // File not found
        return null;
      }
      throw error;
    }
  }

  /**
   * Parse JSON safely with corruption detection
   */
  private async parseJsonSafely(jsonString: string, cruiseCode: string): Promise<any | null> {
    try {
      // Check for obvious corruption patterns
      const openBraces = (jsonString.match(/{/g) || []).length;
      const closeBraces = (jsonString.match(/}/g) || []).length;

      if (openBraces !== closeBraces) {
        logger.warn(
          `🔧 Unbalanced braces in cruise ${cruiseCode}: ${openBraces} open, ${closeBraces} close`
        );
        return null;
      }

      // Try to parse
      const data = JSON.parse(jsonString);
      return data;
    } catch (error) {
      logger.warn(`⚠️ JSON parse error for cruise ${cruiseCode}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        dataLength: jsonString.length,
        preview: jsonString.substring(0, 200),
      });
      return null;
    }
  }

  /**
   * Update cruise data in database
   */
  private async updateCruiseData(cruiseId: string, data: any): Promise<void> {
    try {
      // Update cruise details
      await db.execute(sql`
        UPDATE cruises
        SET
          updated_at = NOW(),
          last_traveltek_update = NOW(),
          raw_data = ${JSON.stringify(data)}::jsonb
        WHERE id = ${cruiseId}
      `);

      // Update pricing if available
      if (data.cheapest && data.cheapest.combined) {
        const combined = data.cheapest.combined;
        const prices = [combined.inside, combined.outside, combined.balcony, combined.suite].filter(
          p => p && p > 0
        );

        const cheapestPrice = prices.length > 0 ? Math.min(...prices) : null;

        if (cheapestPrice) {
          await db.execute(sql`
            INSERT INTO cheapest_pricing (
              cruise_id,
              cheapest_price,
              interior_price,
              oceanview_price,
              balcony_price,
              suite_price,
              currency,
              last_updated
            ) VALUES (
              ${cruiseId},
              ${cheapestPrice},
              ${combined.inside || null},
              ${combined.outside || null},
              ${combined.balcony || null},
              ${combined.suite || null},
              ${data.currency || 'USD'},
              NOW()
            )
            ON CONFLICT (cruise_id) DO UPDATE SET
              cheapest_price = EXCLUDED.cheapest_price,
              interior_price = EXCLUDED.interior_price,
              oceanview_price = EXCLUDED.oceanview_price,
              balcony_price = EXCLUDED.balcony_price,
              suite_price = EXCLUDED.suite_price,
              currency = EXCLUDED.currency,
              last_updated = NOW()
          `);
        }
      }
    } catch (error) {
      logger.error(`Failed to update cruise ${cruiseId}:`, error);
      throw error;
    }
  }

  /**
   * Initialize FTP connection pool
   */
  private async initializeFtpPool(): Promise<void> {
    logger.info(`🔌 Creating FTP connection pool (${this.CONNECTION_POOL_SIZE} connections)...`);

    for (let i = 0; i < this.CONNECTION_POOL_SIZE; i++) {
      const client = new ftp.Client();

      try {
        await client.access({
          host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
          user: process.env.TRAVELTEK_FTP_USER,
          password: process.env.TRAVELTEK_FTP_PASSWORD,
          secure: false,
        });

        this.ftpPool.push(client);
      } catch (error) {
        logger.error(`Failed to create FTP connection ${i + 1}:`, error);
      }
    }

    if (this.ftpPool.length === 0) {
      throw new Error('Failed to create any FTP connections');
    }

    logger.info(`✅ FTP pool created with ${this.ftpPool.length} connections`);
  }

  /**
   * Get an FTP connection from the pool
   */
  private async getFtpConnection(): Promise<ftp.Client> {
    // Round-robin through connections
    const client = this.ftpPool.shift();
    if (client) {
      this.ftpPool.push(client);

      // Test if connection is still alive
      try {
        await client.pwd();
        return client;
      } catch {
        // Reconnect if dead
        await client.access({
          host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
          user: process.env.TRAVELTEK_FTP_USER,
          password: process.env.TRAVELTEK_FTP_PASSWORD,
          secure: false,
        });
        return client;
      }
    }

    throw new Error('No FTP connections available');
  }

  /**
   * Close all FTP connections
   */
  private async closeFtpPool(): Promise<void> {
    for (const client of this.ftpPool) {
      try {
        client.close();
      } catch (error) {
        // Ignore close errors
      }
    }
    this.ftpPool = [];
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Send progress update to Slack
   */
  private async sendProgressUpdate(
    lineId: number,
    currentBatch: number,
    totalBatches: number,
    result: ProcessingResult
  ): Promise<void> {
    try {
      const progress = Math.round((currentBatch / totalBatches) * 100);
      const message =
        `📊 Webhook Progress - Line ${lineId}\n` +
        `Progress: ${progress}% (Batch ${currentBatch}/${totalBatches})\n` +
        `Processed: ${result.processedCruises}/${result.totalCruises}\n` +
        `✅ Successful: ${result.successfulUpdates}\n` +
        `❌ Failed: ${result.failedUpdates}\n` +
        `⏭️ Skipped: ${result.skippedFiles}\n` +
        `🔧 Corrupted: ${result.corruptedFiles}`;

      // Log progress (Slack notification could be added here)
      logger.info(message);
    } catch (error) {
      logger.error('Failed to send progress update:', error);
    }
  }

  /**
   * Send final summary to Slack
   */
  private async sendFinalSummary(lineId: number, result: ProcessingResult): Promise<void> {
    const successRate =
      result.processedCruises > 0
        ? Math.round((result.successfulUpdates / result.processedCruises) * 100)
        : 0;

    // Log final summary (Slack notification commented out for now)
    logger.info(`✅ Webhook Summary - Line ${lineId}`, {
      totalCruises: result.totalCruises,
      processedCruises: result.processedCruises,
      successfulUpdates: result.successfulUpdates,
      failedUpdates: result.failedUpdates,
      skippedFiles: result.skippedFiles,
      corruptedFiles: result.corruptedFiles,
      batches: result.batches,
      successRate: `${successRate}%`,
      duration: `${(result.duration / 1000).toFixed(2)}s`,
    });
  }
}

// Export singleton instance
export const comprehensiveWebhookService = new ComprehensiveWebhookService();
