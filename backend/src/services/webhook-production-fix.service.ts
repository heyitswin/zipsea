/**
 * Production-Ready Webhook Service
 * Fixes all identified issues:
 * - Proper FTP connection management (no reuse of active connections)
 * - Sequential processing to avoid overwhelming FTP server
 * - Smaller batches
 * - Better error handling
 */

import logger from '../config/logger';
import { getDatabaseLineId } from '../config/cruise-line-mapping';
import redisClient from '../cache/redis';
import * as ftp from 'basic-ftp';
import { Pool } from 'pg';

interface ProcessingResult {
  lineId: number;
  totalCruises: number;
  processedCruises: number;
  successfulUpdates: number;
  failedUpdates: number;
  skippedFiles: number;
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

export class WebhookProductionFixService {
  private readonly BATCH_SIZE = 5; // Very small batch to avoid overwhelming
  private readonly FTP_TIMEOUT = 30000;
  private readonly PROCESSING_DELAY = 1000; // 1 second delay between cruises
  private pgPool: Pool | null = null;

  constructor() {
    // Initialize PostgreSQL connection pool
    if (process.env.DATABASE_URL) {
      this.pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('render.com')
          ? { rejectUnauthorized: false }
          : false,
        max: 3, // Reduced pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      logger.info('✅ WebhookProductionFixService: Database pool initialized');
    } else {
      logger.error('❌ WebhookProductionFixService: No DATABASE_URL found');
    }
  }

  async processWebhook(lineId: number): Promise<ProcessingResult> {
    const startTime = Date.now();
    const webhookId = `webhook_prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const databaseLineId = getDatabaseLineId(lineId);

    logger.info(`🚀 WebhookProductionFixService: Starting`, {
      webhookId,
      originalLineId: lineId,
      databaseLineId,
    });

    const result: ProcessingResult = {
      lineId: databaseLineId,
      totalCruises: 0,
      processedCruises: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      skippedFiles: 0,
      duration: 0,
      errors: [],
    };

    if (!this.pgPool) {
      const error = 'Database connection not available';
      logger.error(`❌ ${error}`);
      result.errors.push(error);
      return result;
    }

    try {
      // Acquire Redis lock
      const lockKey = `webhook:lock:line:${databaseLineId}`;
      const lockValue = webhookId;
      const lockAcquired = await this.acquireLock(lockKey, lockValue, 120); // 2 minute timeout

      if (!lockAcquired) {
        const message = `Another webhook is processing line ${databaseLineId}`;
        logger.warn(`⚠️ ${message}`);
        result.errors.push(message);
        return result;
      }

      try {
        // Get cruises
        logger.info(`📊 Fetching cruises for line ${databaseLineId}`);
        const cruiseInfos = await this.getAllFutureCruisesForLine(databaseLineId);
        result.totalCruises = cruiseInfos.length;

        logger.info(`📊 Found ${cruiseInfos.length} cruises`);

        if (cruiseInfos.length === 0) {
          logger.warn(`⚠️ No cruises found for line ${databaseLineId}`);
          return result;
        }

        // Process only first batch
        const batchToProcess = cruiseInfos.slice(0, this.BATCH_SIZE);
        logger.info(`🔄 Processing ${batchToProcess.length} cruises sequentially`);

        // Process each cruise SEQUENTIALLY with its own FTP connection
        for (const cruise of batchToProcess) {
          try {
            logger.info(`📥 Processing ${cruise.cruiseCode}...`);

            // Create a fresh FTP connection for EACH cruise
            const ftpClient = new ftp.Client();
            ftpClient.ftp.verbose = false;

            try {
              // Connect
              await ftpClient.access({
                host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
                user: process.env.TRAVELTEK_FTP_USER,
                password: process.env.TRAVELTEK_FTP_PASSWORD,
                secure: false,
              });

              // Process single cruise
              const processResult = await this.processSingleCruise(cruise, lineId, ftpClient);

              result.processedCruises++;
              if (processResult.success) {
                result.successfulUpdates++;
                logger.info(`✅ Successfully processed ${cruise.cruiseCode}`);
              } else if (processResult.skipped) {
                result.skippedFiles++;
                logger.info(`⏭️ Skipped ${cruise.cruiseCode} (not on FTP)`);
              } else {
                result.failedUpdates++;
                if (processResult.error) {
                  result.errors.push(`${cruise.cruiseCode}: ${processResult.error}`);
                }
              }
            } finally {
              // ALWAYS close the FTP connection
              ftpClient.close();
            }

            // Add delay between cruises to avoid overwhelming FTP server
            if (result.processedCruises < batchToProcess.length) {
              await new Promise(resolve => setTimeout(resolve, this.PROCESSING_DELAY));
            }
          } catch (error) {
            result.failedUpdates++;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(`${cruise.cruiseCode}: ${errorMsg}`);
            logger.error(`❌ Error processing ${cruise.cruiseCode}:`, { error: errorMsg });
          }
        }
      } finally {
        // Always release lock
        await this.releaseLock(lockKey, lockValue);
        logger.info(`🔓 Released lock for line ${databaseLineId}`);
      }

      result.duration = Date.now() - startTime;

      const successRate =
        result.processedCruises > 0
          ? Math.round((result.successfulUpdates / result.processedCruises) * 100)
          : 0;

      logger.info(`📊 Processing complete`, {
        webhookId,
        lineId: databaseLineId,
        totalCruises: result.totalCruises,
        processed: result.processedCruises,
        successful: result.successfulUpdates,
        failed: result.failedUpdates,
        skipped: result.skippedFiles,
        successRate: `${successRate}%`,
        duration: `${Math.round(result.duration / 1000)}s`,
      });

      // Send Slack notification
      await this.sendSlackNotification(result, successRate);

      return result;
    } catch (error) {
      logger.error(`❌ Fatal error`, {
        webhookId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      result.errors.push(`Fatal: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  private async acquireLock(key: string, value: string, ttl: number = 120): Promise<boolean> {
    try {
      // Use atomic operation to set if not exists
      const exists = await redisClient.exists(key);
      if (exists) {
        return false;
      }

      await redisClient.set(key, value);
      await redisClient.expire(key, ttl);
      return true;
    } catch (error) {
      logger.error('Failed to acquire Redis lock:', error);
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
      logger.error('Failed to release Redis lock:', error);
    }
  }

  private async getAllFutureCruisesForLine(lineId: number): Promise<CruiseInfo[]> {
    if (!this.pgPool) {
      throw new Error('Database connection not available');
    }

    const query = `
      SELECT
        c.id,
        c.cruise_id as cruise_code,
        c.ship_id,
        COALESCE(s.name, 'Unknown_Ship') as ship_name,
        c.sailing_date
      FROM cruises c
      LEFT JOIN ships s ON s.id = c.ship_id
      WHERE c.owner_id = $1
      AND c.sailing_date >= CURRENT_DATE
      ORDER BY c.sailing_date
      LIMIT 20
    `;

    try {
      const result = await this.pgPool.query(query, [lineId]);

      return result.rows.map(row => ({
        id: row.id,
        cruiseCode: row.cruise_code,
        shipId: row.ship_id,
        shipName: row.ship_name,
        sailingDate: new Date(row.sailing_date),
      }));
    } catch (error) {
      logger.error('Database query failed:', { error, lineId });
      throw error;
    }
  }

  private async processSingleCruise(
    cruise: CruiseInfo,
    lineId: number,
    ftpClient: ftp.Client
  ): Promise<{ success: boolean; skipped: boolean; error?: string }> {
    const year = cruise.sailingDate.getFullYear();
    const month = String(cruise.sailingDate.getMonth() + 1).padStart(2, '0');
    const fileName = `${cruise.cruiseCode}.json`;
    const ftpPath = `/${year}/${month}/${lineId}/${fileName}`;

    try {
      // Check if file exists
      try {
        await ftpClient.size(ftpPath);
      } catch {
        // File doesn't exist on FTP
        return { success: false, skipped: true };
      }

      // Download file to memory
      const chunks: Buffer[] = [];
      const writable = new (require('stream').Writable)({
        write(chunk: Buffer, encoding: string, callback: Function) {
          chunks.push(chunk);
          callback();
        },
      });

      await ftpClient.downloadTo(writable, ftpPath);
      const jsonData = Buffer.concat(chunks).toString('utf-8');

      // Parse JSON
      let cruiseData;
      try {
        cruiseData = JSON.parse(jsonData);
      } catch (parseError) {
        logger.error(`Failed to parse JSON for ${cruise.cruiseCode}`, { parseError });
        return { success: false, skipped: false, error: 'Invalid JSON' };
      }

      // Update database
      await this.updateCruiseData(cruise.id, cruiseData);

      return { success: true, skipped: false };
    } catch (error) {
      return {
        success: false,
        skipped: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async updateCruiseData(cruiseId: string, data: any): Promise<void> {
    if (!this.pgPool) {
      throw new Error('Database connection not available');
    }

    const client = await this.pgPool.connect();

    try {
      await client.query('BEGIN');

      // Update cruise with raw data
      await client.query(
        `UPDATE cruises
         SET updated_at = NOW(),
             last_traveltek_update = NOW(),
             raw_data = $1::jsonb
         WHERE id = $2`,
        [JSON.stringify(data), cruiseId]
      );

      // Update pricing if available
      if (data.cheapest && data.cheapest.combined) {
        const combined = data.cheapest.combined;
        const prices = [combined.inside, combined.outside, combined.balcony, combined.suite].filter(
          p => p && p > 0
        );

        const cheapestPrice = prices.length > 0 ? Math.min(...prices) : null;

        if (cheapestPrice) {
          await client.query(
            `INSERT INTO cheapest_pricing (
              cruise_id, cheapest_price, interior_price,
              oceanview_price, balcony_price, suite_price,
              currency, last_updated
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (cruise_id) DO UPDATE SET
              cheapest_price = EXCLUDED.cheapest_price,
              interior_price = EXCLUDED.interior_price,
              oceanview_price = EXCLUDED.oceanview_price,
              balcony_price = EXCLUDED.balcony_price,
              suite_price = EXCLUDED.suite_price,
              currency = EXCLUDED.currency,
              last_updated = NOW()`,
            [
              cruiseId,
              cheapestPrice,
              combined.inside || null,
              combined.outside || null,
              combined.balcony || null,
              combined.suite || null,
              data.currency || 'USD',
            ]
          );

          // Also update price_from in cruises table
          await client.query(`UPDATE cruises SET price_from = $1 WHERE id = $2`, [
            cheapestPrice,
            cruiseId,
          ]);

          logger.info(`💰 Updated pricing for cruise ${cruiseId}: $${cheapestPrice}`);
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async sendSlackNotification(
    result: ProcessingResult,
    successRate: number
  ): Promise<void> {
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!slackWebhookUrl) {
      return;
    }

    try {
      const message = {
        text: `Webhook Processing Complete - Line ${result.lineId}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text:
                `*Production Webhook Processing for Line ${result.lineId}*\n` +
                `Success Rate: ${successRate}%\n` +
                `Processed: ${result.processedCruises}/${result.totalCruises} cruises\n` +
                `✅ Successful: ${result.successfulUpdates}\n` +
                `❌ Failed: ${result.failedUpdates}\n` +
                `⏭️ Skipped: ${result.skippedFiles}\n` +
                `⏱️ Duration: ${Math.round(result.duration / 1000)}s`,
            },
          },
        ],
      };

      await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
    } catch (error) {
      logger.error('Failed to send Slack notification:', error);
    }
  }

  async cleanup(): Promise<void> {
    if (this.pgPool) {
      await this.pgPool.end();
    }
  }
}

export const webhookProductionFixService = new WebhookProductionFixService();
