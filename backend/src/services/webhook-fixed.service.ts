/**
 * Fixed Webhook Service - Resolves processing issues
 * - Handles database connection properly
 * - Better error handling and logging
 * - Smaller batch sizes to prevent timeouts
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

export class WebhookFixedService {
  private readonly BATCH_SIZE = 10; // Small batch for testing
  private readonly FTP_TIMEOUT = 30000;
  private pgPool: Pool | null = null;

  constructor() {
    // Initialize PostgreSQL connection pool
    if (process.env.DATABASE_URL) {
      this.pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('render.com')
          ? { rejectUnauthorized: false }
          : false,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      logger.info('✅ WebhookFixedService: Database pool initialized');
    } else {
      logger.error('❌ WebhookFixedService: No DATABASE_URL found');
    }
  }

  async processWebhook(lineId: number): Promise<ProcessingResult> {
    const startTime = Date.now();
    const webhookId = `webhook_fixed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const databaseLineId = getDatabaseLineId(lineId);

    logger.info(`🚀 WebhookFixedService: Starting processing`, {
      webhookId,
      originalLineId: lineId,
      databaseLineId
    });

    const result: ProcessingResult = {
      lineId: databaseLineId,
      totalCruises: 0,
      processedCruises: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      skippedFiles: 0,
      duration: 0,
      errors: []
    };

    // Check database connection
    if (!this.pgPool) {
      const error = 'Database connection not available';
      logger.error(`❌ WebhookFixedService: ${error}`);
      result.errors.push(error);
      return result;
    }

    try {
      // Acquire Redis lock with shorter timeout
      const lockKey = `webhook:lock:line:${databaseLineId}`;
      const lockValue = webhookId;
      const lockAcquired = await this.acquireLock(lockKey, lockValue, 60); // 60 second timeout

      if (!lockAcquired) {
        const message = `Another webhook is processing line ${databaseLineId}`;
        logger.warn(`⚠️ WebhookFixedService: ${message}`);
        result.errors.push(message);
        return result;
      }

      try {
        // Get cruises with timeout
        logger.info(`📊 WebhookFixedService: Fetching cruises for line ${databaseLineId}`);
        const cruiseInfos = await this.getAllFutureCruisesForLine(databaseLineId);
        result.totalCruises = cruiseInfos.length;

        logger.info(`📊 WebhookFixedService: Found ${cruiseInfos.length} cruises`);

        if (cruiseInfos.length === 0) {
          logger.warn(`⚠️ WebhookFixedService: No cruises found for line ${databaseLineId}`);
          return result;
        }

        // Process only first batch for now
        const batchToProcess = cruiseInfos.slice(0, this.BATCH_SIZE);
        logger.info(`🔄 WebhookFixedService: Processing ${batchToProcess.length} cruises`);

        // Initialize single FTP connection
        const ftpClient = await this.createFtpConnection();

        try {
          for (const cruise of batchToProcess) {
            try {
              const processResult = await this.processCruise(cruise, lineId, ftpClient);
              result.processedCruises++;

              if (processResult.success) {
                result.successfulUpdates++;
                logger.info(`✅ Processed ${cruise.cruiseCode}`);
              } else if (processResult.skipped) {
                result.skippedFiles++;
                logger.info(`⏭️ Skipped ${cruise.cruiseCode} (not on FTP)`);
              } else {
                result.failedUpdates++;
                if (processResult.error) {
                  result.errors.push(`${cruise.cruiseCode}: ${processResult.error}`);
                }
              }
            } catch (error) {
              result.failedUpdates++;
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              result.errors.push(`${cruise.cruiseCode}: ${errorMsg}`);
              logger.error(`❌ Error processing ${cruise.cruiseCode}:`, { error: errorMsg });
            }
          }
        } finally {
          // Always close FTP connection
          ftpClient.close();
        }

      } finally {
        // Always release lock
        await this.releaseLock(lockKey, lockValue);
        logger.info(`🔓 WebhookFixedService: Released lock for line ${databaseLineId}`);
      }

      result.duration = Date.now() - startTime;

      // Send summary
      const successRate = result.processedCruises > 0
        ? Math.round((result.successfulUpdates / result.processedCruises) * 100)
        : 0;

      logger.info(`📊 WebhookFixedService: Processing complete`, {
        webhookId,
        lineId: databaseLineId,
        totalCruises: result.totalCruises,
        processed: result.processedCruises,
        successful: result.successfulUpdates,
        failed: result.failedUpdates,
        skipped: result.skippedFiles,
        successRate: `${successRate}%`,
        duration: `${Math.round(result.duration / 1000)}s`
      });

      // Send Slack notification if configured
      await this.sendSlackNotification(result, successRate);

      return result;

    } catch (error) {
      logger.error(`❌ WebhookFixedService: Fatal error`, {
        webhookId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      result.errors.push(`Fatal: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  private async acquireLock(key: string, value: string, ttl: number = 60): Promise<boolean> {
    try {
      const result = await redisClient.set(key, value, 'NX', 'EX', ttl);
      return result === 'OK';
    } catch (error) {
      logger.error('❌ Failed to acquire Redis lock:', error);
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
      logger.error('❌ Failed to release Redis lock:', error);
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
      WHERE c.line_id = $1
      AND c.sailing_date >= CURRENT_DATE
      ORDER BY c.sailing_date
      LIMIT 100
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
      logger.error('❌ Database query failed:', { error, lineId });
      throw error;
    }
  }

  private async createFtpConnection(): Promise<ftp.Client> {
    const client = new ftp.Client();
    client.ftp.timeout = this.FTP_TIMEOUT;

    const ftpConfig = {
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false,
    };

    logger.info('🔌 Connecting to FTP...');
    await client.access(ftpConfig);
    logger.info('✅ FTP connected');

    return client;
  }

  private async processCruise(
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
        }
      });

      await ftpClient.downloadTo(writable, ftpPath);
      const jsonData = Buffer.concat(chunks).toString('utf-8');

      // Parse JSON
      const cruiseData = JSON.parse(jsonData);

      // Update database
      await this.updateCruiseData(cruise.id, cruiseData);

      return { success: true, skipped: false };

    } catch (error) {
      return {
        success: false,
        skipped: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async updateCruiseData(cruiseId: string, data: any): Promise<void> {
    if (!this.pgPool) {
      throw new Error('Database connection not available');
    }

    // Update cruise with raw data
    await this.pgPool.query(
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
      const prices = [combined.inside, combined.outside, combined.balcony, combined.suite]
        .filter(p => p && p > 0);

      const cheapestPrice = prices.length > 0 ? Math.min(...prices) : null;

      if (cheapestPrice) {
        await this.pgPool.query(
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
            data.currency || 'USD'
          ]
        );

        logger.info(`💰 Updated pricing for cruise ${cruiseId}: $${cheapestPrice}`);
      }
    }
  }

  private async sendSlackNotification(result: ProcessingResult, successRate: number): Promise<void> {
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
              text: `*Fixed Webhook Processing for Line ${result.lineId}*\n` +
                    `Success Rate: ${successRate}%\n` +
                    `Processed: ${result.processedCruises}/${result.totalCruises} cruises\n` +
                    `✅ Successful: ${result.successfulUpdates}\n` +
                    `❌ Failed: ${result.failedUpdates}\n` +
                    `⏭️ Skipped: ${result.skippedFiles}\n` +
                    `⏱️ Duration: ${Math.round(result.duration / 1000)}s`
            }
          }
        ]
      };

      await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
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

export const webhookFixedService = new WebhookFixedService();
