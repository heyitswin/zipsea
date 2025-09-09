/**
 * Debug version of Comprehensive Webhook Service
 * Adds extensive logging to identify processing issues
 */

import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import logger from '../config/logger';
import { getDatabaseLineId } from '../config/cruise-line-mapping';
import redisClient from '../cache/redis';
import * as ftp from 'basic-ftp';

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
  debugInfo?: any;
}

interface CruiseInfo {
  id: string;
  cruiseCode: string;
  shipId: number;
  shipName: string;
  sailingDate: Date;
}

export class ComprehensiveWebhookDebugService {
  private readonly BATCH_SIZE = 5; // Start small for debugging
  private readonly MAX_CONCURRENT_DOWNLOADS = 2;
  private readonly MAX_RETRIES = 2;
  private readonly FTP_TIMEOUT = 30000;
  private readonly CONNECTION_POOL_SIZE = 1;
  private ftpPool: ftp.Client[] = [];

  async processWebhook(lineId: number): Promise<ProcessingResult> {
    const startTime = Date.now();
    const webhookId = `webhook_debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`🔍 DEBUG: Starting webhook processing for line ${lineId}`);
    logger.info(`🔍 DEBUG: Starting webhook processing`, { webhookId, lineId });

    const result: ProcessingResult = {
      lineId,
      totalCruises: 0,
      processedCruises: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      skippedFiles: 0,
      corruptedFiles: 0,
      batches: 0,
      duration: 0,
      errors: [],
      debugInfo: {
        webhookId,
        startTime: new Date(startTime).toISOString(),
        steps: [],
      },
    };

    try {
      // Step 1: Map line ID
      const databaseLineId = getDatabaseLineId(lineId);
      result.debugInfo.steps.push({
        step: 'mapLineId',
        originalLineId: lineId,
        databaseLineId,
        timestamp: new Date().toISOString(),
      });

      console.log(`🔍 DEBUG: Mapped line ${lineId} to database line ${databaseLineId}`);
      logger.info(`🔍 DEBUG: Line ID mapping`, { originalLineId: lineId, databaseLineId });

      // Step 2: Acquire Redis lock
      const lockKey = `webhook:lock:line:${databaseLineId}`;
      const lockValue = webhookId;
      const lockAcquired = await this.acquireLock(lockKey, lockValue);

      result.debugInfo.steps.push({
        step: 'acquireLock',
        lockKey,
        lockAcquired,
        timestamp: new Date().toISOString(),
      });

      if (!lockAcquired) {
        const message = `Another webhook is already processing line ${databaseLineId}`;
        console.log(`🔍 DEBUG: ${message}`);
        logger.warn(`🔍 DEBUG: Lock acquisition failed`, { lineId: databaseLineId, webhookId });
        result.errors.push(message);
        return result;
      }

      console.log(`🔍 DEBUG: Acquired lock for line ${databaseLineId}`);

      try {
        // Step 3: Get cruises from database
        console.log(`🔍 DEBUG: Fetching cruises for line ${databaseLineId}...`);
        const cruiseInfos = await this.getAllFutureCruisesForLine(databaseLineId);
        result.totalCruises = cruiseInfos.length;

        result.debugInfo.steps.push({
          step: 'fetchCruises',
          cruiseCount: cruiseInfos.length,
          timestamp: new Date().toISOString(),
        });

        console.log(`🔍 DEBUG: Found ${cruiseInfos.length} cruises for line ${databaseLineId}`);
        logger.info(`🔍 DEBUG: Cruise count`, {
          lineId: databaseLineId,
          count: cruiseInfos.length,
        });

        if (cruiseInfos.length === 0) {
          console.log(`🔍 DEBUG: No cruises found, exiting`);
          return result;
        }

        // Step 4: Initialize FTP connection
        console.log(`🔍 DEBUG: Initializing FTP connection...`);
        await this.initializeFtpPool();

        result.debugInfo.steps.push({
          step: 'initializeFtp',
          poolSize: this.ftpPool.length,
          timestamp: new Date().toISOString(),
        });

        console.log(`🔍 DEBUG: FTP pool initialized with ${this.ftpPool.length} connection(s)`);

        // Step 5: Process first batch only for debugging
        const firstBatch = cruiseInfos.slice(0, Math.min(this.BATCH_SIZE, cruiseInfos.length));
        console.log(`🔍 DEBUG: Processing batch of ${firstBatch.length} cruises`);

        for (const cruise of firstBatch) {
          try {
            console.log(`🔍 DEBUG: Processing cruise ${cruise.cruiseCode}`);
            const processResult = await this.processCruise(cruise, lineId);

            result.processedCruises++;
            if (processResult.success) {
              result.successfulUpdates++;
              console.log(`✅ DEBUG: Successfully processed ${cruise.cruiseCode}`);
            } else if (processResult.skipped) {
              result.skippedFiles++;
              console.log(`⏭️ DEBUG: Skipped ${cruise.cruiseCode} (file not found)`);
            } else if (processResult.corrupted) {
              result.corruptedFiles++;
              console.log(`❌ DEBUG: Corrupted file for ${cruise.cruiseCode}`);
            } else {
              result.failedUpdates++;
              console.log(`❌ DEBUG: Failed to process ${cruise.cruiseCode}`);
              if (processResult.error) {
                result.errors.push(`${cruise.cruiseCode}: ${processResult.error}`);
              }
            }
          } catch (error) {
            console.log(`❌ DEBUG: Error processing cruise ${cruise.cruiseCode}:`, error);
            result.failedUpdates++;
            result.errors.push(
              `${cruise.cruiseCode}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }

        // Close FTP connections
        await this.closeFtpPool();
      } finally {
        // Release lock
        await this.releaseLock(lockKey, lockValue);
        console.log(`🔍 DEBUG: Released lock for line ${databaseLineId}`);
      }

      result.duration = Date.now() - startTime;
      result.debugInfo.steps.push({
        step: 'complete',
        duration: result.duration,
        timestamp: new Date().toISOString(),
      });

      console.log(`🔍 DEBUG: Processing complete in ${result.duration}ms`);
      console.log(`📊 DEBUG Results:`, {
        total: result.totalCruises,
        processed: result.processedCruises,
        successful: result.successfulUpdates,
        failed: result.failedUpdates,
        skipped: result.skippedFiles,
        corrupted: result.corruptedFiles,
      });

      // Send Slack notification
      try {
        await this.sendSlackNotification(result);
      } catch (slackError) {
        console.log(`⚠️ DEBUG: Failed to send Slack notification:`, slackError);
      }

      return result;
    } catch (error) {
      console.error(`❌ DEBUG: Fatal error in webhook processing:`, error);
      logger.error(`❌ DEBUG: Fatal error`, {
        webhookId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      result.errors.push(
        `Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  private async acquireLock(key: string, value: string): Promise<boolean> {
    try {
      // Set with expiry - check if key doesn't exist first
      const exists = await redisClient.exists(key);
      if (exists) {
        return false;
      }
      await redisClient.set(key, value);
      await redisClient.expire(key, 300); // 5 minute expiry
      return true;
    } catch (error) {
      console.error(`❌ DEBUG: Failed to acquire lock:`, error);
      return false;
    }
  }

  private async releaseLock(key: string, value: string): Promise<void> {
    try {
      const currentValue = await redisClient.get(key);
      if (currentValue === value) {
        await redisClient.del(key);
      }
    } catch (error) {
      console.error(`❌ DEBUG: Failed to release lock:`, error);
    }
  }

  private async getAllFutureCruisesForLine(lineId: number): Promise<CruiseInfo[]> {
    try {
      const result = await db.execute(sql`
        SELECT
          c.id,
          c.cruise_code,
          c.ship_id,
          s.name as ship_name,
          c.sailing_date
        FROM cruises c
        JOIN ships s ON c.ship_id = s.id
        WHERE c.line_id = ${lineId}
        AND c.sailing_date >= CURRENT_DATE
        ORDER BY c.sailing_date
        LIMIT 10
      `);

      return result.rows.map(row => ({
        id: row.id as string,
        cruiseCode: row.cruise_code as string,
        shipId: row.ship_id as number,
        shipName: row.ship_name as string,
        sailingDate: new Date(row.sailing_date as string),
      }));
    } catch (error) {
      console.error(`❌ DEBUG: Database query failed:`, error);
      throw error;
    }
  }

  private async initializeFtpPool(): Promise<void> {
    const ftpHost = process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net';
    const ftpUser = process.env.TRAVELTEK_FTP_USER;
    const ftpPassword = process.env.TRAVELTEK_FTP_PASSWORD;

    console.log(`🔍 DEBUG: FTP config - Host: ${ftpHost}, User: ${ftpUser ? 'SET' : 'NOT SET'}`);

    const client = new ftp.Client();
    // client.ftp.timeout = this.FTP_TIMEOUT; // Commented out - timeout is read-only

    try {
      await client.access({
        host: ftpHost,
        user: ftpUser,
        password: ftpPassword,
        secure: false,
      });

      this.ftpPool.push(client);
      console.log(`✅ DEBUG: FTP connection established`);
    } catch (error) {
      console.error(`❌ DEBUG: FTP connection failed:`, error);
      throw error;
    }
  }

  private async closeFtpPool(): Promise<void> {
    for (const client of this.ftpPool) {
      try {
        client.close();
      } catch (error) {
        console.error(`⚠️ DEBUG: Error closing FTP connection:`, error);
      }
    }
    this.ftpPool = [];
  }

  private async processCruise(
    cruise: CruiseInfo,
    lineId: number
  ): Promise<{ success: boolean; skipped: boolean; corrupted: boolean; error?: string }> {
    const year = cruise.sailingDate.getFullYear();
    const month = String(cruise.sailingDate.getMonth() + 1).padStart(2, '0');
    const fileName = `${cruise.cruiseCode}.json`;
    const ftpPath = `/${year}/${month}/${lineId}/${fileName}`;

    console.log(`🔍 DEBUG: Attempting to download ${ftpPath}`);

    try {
      const client = this.ftpPool[0];
      if (!client) {
        throw new Error('No FTP connection available');
      }

      // Check if file exists
      try {
        await client.size(ftpPath);
      } catch (sizeError) {
        console.log(`⏭️ DEBUG: File not found: ${ftpPath}`);
        return { success: false, skipped: true, corrupted: false };
      }

      // Download file
      const chunks: Buffer[] = [];
      await client.downloadTo(
        new (require('stream').Writable)({
          write(chunk: Buffer, encoding: string, callback: Function) {
            chunks.push(chunk);
            callback();
          },
        }),
        ftpPath
      );

      const jsonData = Buffer.concat(chunks).toString('utf-8');
      console.log(`📥 DEBUG: Downloaded ${jsonData.length} bytes for ${cruise.cruiseCode}`);

      // Parse JSON
      const cruiseData = JSON.parse(jsonData);

      // Update database
      await this.updateCruiseData(cruise.id, cruiseData);

      return { success: true, skipped: false, corrupted: false };
    } catch (error) {
      console.error(`❌ DEBUG: Error processing ${cruise.cruiseCode}:`, error);
      return {
        success: false,
        skipped: false,
        corrupted: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async updateCruiseData(cruiseId: string, data: any): Promise<void> {
    console.log(`🔍 DEBUG: Updating cruise ${cruiseId} with pricing data`);

    try {
      // Update cruise with raw data
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

          console.log(`💰 DEBUG: Updated pricing for cruise ${cruiseId}: $${cheapestPrice}`);
        }
      }
    } catch (error) {
      console.error(`❌ DEBUG: Database update failed for ${cruiseId}:`, error);
      throw error;
    }
  }

  private async sendSlackNotification(result: ProcessingResult): Promise<void> {
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!slackWebhookUrl) {
      console.log('⏭️ DEBUG: No Slack webhook URL configured');
      return;
    }

    const successRate =
      result.processedCruises > 0
        ? Math.round((result.successfulUpdates / result.processedCruises) * 100)
        : 0;

    const message = {
      text: `🔍 Debug Webhook Processing Complete`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text:
              `*Debug Webhook Processing for Line ${result.lineId}*\n` +
              `Success Rate: ${successRate}%\n` +
              `Processed: ${result.processedCruises}/${result.totalCruises} cruises\n` +
              `✅ Successful: ${result.successfulUpdates}\n` +
              `❌ Failed: ${result.failedUpdates}\n` +
              `⏭️ Skipped: ${result.skippedFiles}\n` +
              `Duration: ${Math.round(result.duration / 1000)}s`,
          },
        },
      ],
    };

    try {
      await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
    } catch (error) {
      console.error('❌ DEBUG: Failed to send Slack notification:', error);
    }
  }
}

export const comprehensiveWebhookDebugService = new ComprehensiveWebhookDebugService();
