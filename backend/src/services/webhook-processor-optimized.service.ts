import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import * as path from 'path';
import { db } from '../db/connection';
import { cruises, priceSnapshots, webhookEvents, systemFlags } from '../db/schema';
import { eq, and, gte, sql, inArray } from 'drizzle-orm';
import logger from '../config/logger';
import { env } from '../config/environment';
import { ftpConnectionPool } from './ftp-connection-pool.service';
import { slackService } from './slack.service';
import redisClient from '../cache/redis';

interface WebhookPayload {
  event: string;
  lineid: number;
  currency?: string;
  marketid?: number;
  source?: string;
  description?: string;
  timestamp: number;
}

interface CruiseFileInfo {
  year: string;
  month: string;
  lineId: string;
  shipId: string;
  cruiseCode: string;
  fullPath: string;
}

interface ProcessingStats {
  startTime: Date;
  endTime?: Date;
  totalFiles: number;
  processedFiles: number;
  updatedCruises: number;
  createdCruises: number;
  failedFiles: number;
  snapshotsCreated: number;
  errors: string[];
}

/**
 * Optimized Webhook Processor Service
 * Features:
 * - FTP connection pooling with keep-alive
 * - Intelligent file discovery (current month forward)
 * - Parallel processing with queue management
 * - Comprehensive Slack notifications
 * - Automatic retry and error recovery
 */
export class WebhookProcessorOptimized {
  private processingQueue: Queue | null = null;
  private worker: Worker | null = null;
  private redisConnection: IORedis | null = null;
  private readonly BATCH_SIZE = 10; // Process files in batches
  private readonly MAX_CONCURRENT = 5; // Max concurrent file processing
  private readonly FTP_SCAN_CONCURRENT = 2; // Max concurrent FTP directory scans

  constructor() {
    this.initializeQueue();
  }

  private async initializeQueue() {
    try {
      // Initialize Redis connection for BullMQ
      if (env.REDIS_URL) {
        this.redisConnection = new IORedis(env.REDIS_URL, {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        });
      } else if (env.REDIS_HOST) {
        this.redisConnection = new IORedis({
          host: env.REDIS_HOST,
          port: env.REDIS_PORT || 6379,
          password: env.REDIS_PASSWORD,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        });
      }

      if (this.redisConnection) {
        // Create processing queue
        this.processingQueue = new Queue('webhook-file-processing', {
          connection: this.redisConnection,
          defaultJobOptions: {
            removeOnComplete: { age: 3600, count: 100 },
            removeOnFail: { age: 24 * 3600 },
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
          },
        });

        // Create worker
        this.worker = new Worker(
          'webhook-file-processing',
          async (job: Job) => this.processFileJob(job),
          {
            connection: this.redisConnection,
            concurrency: this.MAX_CONCURRENT,
            limiter: {
              max: 20,
              duration: 1000, // Max 20 files per second
            },
          }
        );

        logger.info('✅ Webhook processor queue initialized');
      }
    } catch (error) {
      logger.error('Failed to initialize webhook processor queue:', error);
    }
  }

  /**
   * Main webhook handler - triggered by incoming webhook
   */
  public async handleWebhook(payload: WebhookPayload): Promise<void> {
    const processingId = `webhook-${payload.lineid}-${Date.now()}`;
    const lockKey = `webhook:processing:${payload.lineid}`;
    const lockTTL = 30 * 60; // 30 minutes

    try {
      // Check if already processing this line
      const isLocked = await redisClient.get(lockKey);
      if (isLocked) {
        logger.warn(`[${payload.lineid}] Already processing, skipping webhook`);
        return;
      }

      // Acquire lock
      await redisClient.set(lockKey, processingId, lockTTL);

      // Log webhook event
      const [webhookEvent] = await db.insert(webhookEvents).values({
        eventType: payload.event,
        lineId: payload.lineid,
        payload: JSON.stringify(payload),
        status: 'processing',
        createdAt: new Date(),
      }).returning();

      // Send Slack notification - webhook received
      await slackService.notifyWebhookReceived(payload);

      // Initialize stats
      const stats: ProcessingStats = {
        startTime: new Date(),
        totalFiles: 0,
        processedFiles: 0,
        updatedCruises: 0,
        createdCruises: 0,
        failedFiles: 0,
        snapshotsCreated: 0,
        errors: [],
      };

      logger.info(`[${payload.lineid}] Starting webhook processing`, {
        event: payload.event,
        processingId,
      });

      // Discover files to process
      const files = await this.discoverFiles(payload.lineid);
      stats.totalFiles = files.length;

      if (files.length === 0) {
        logger.warn(`[${payload.lineid}] No files found to process`);
        await this.completeProcessing(webhookEvent.id, stats, lockKey);
        return;
      }

      logger.info(`[${payload.lineid}] Found ${files.length} files to process`);

      // Queue files for processing
      if (this.processingQueue) {
        const jobs = [];
        for (let i = 0; i < files.length; i += this.BATCH_SIZE) {
          const batch = files.slice(i, i + this.BATCH_SIZE);
          const job = await this.processingQueue.add(
            'process-batch',
            {
              webhookEventId: webhookEvent.id,
              lineId: payload.lineid,
              files: batch,
              processingId,
            },
            {
              priority: 1,
              delay: i * 100, // Stagger batch processing
            }
          );
          jobs.push(job);
        }

        // Monitor processing
        this.monitorProcessing(webhookEvent.id, payload.lineid, stats, jobs, lockKey);
      } else {
        // Fallback to sequential processing if queue not available
        await this.processFilesSequentially(files, webhookEvent.id, stats);
        await this.completeProcessing(webhookEvent.id, stats, lockKey);
      }

    } catch (error) {
      logger.error(`[${payload.lineid}] Webhook processing failed:`, error);
      await redisClient.del(lockKey);
      throw error;
    }
  }

  /**
   * Discover files to process for a given line ID
   */
  private async discoverFiles(lineId: number): Promise<CruiseFileInfo[]> {
    const files: CruiseFileInfo[] = [];
    const connection = await ftpConnectionPool.acquire();

    try {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      const maxYear = currentYear + 3; // Look 3 years ahead

      logger.info(`[${lineId}] Scanning FTP directories from ${currentYear}/${currentMonth} to ${maxYear}/12`);

      // Scan year by year
      for (let year = currentYear; year <= maxYear; year++) {
        const startMonth = year === currentYear ? currentMonth : 1;

        for (let month = startMonth; month <= 12; month++) {
          const monthPath = `/${year}/${month.toString().padStart(2, '0')}/${lineId}`;

          try {
            // Check if directory exists
            await connection.client.cd(monthPath);

            // List ship directories
            const shipDirs = await connection.client.list();

            for (const shipDir of shipDirs) {
              if (shipDir.type === 2 && shipDir.name !== '.' && shipDir.name !== '..') {
                const shipPath = `${monthPath}/${shipDir.name}`;

                // List cruise files
                await connection.client.cd(shipPath);
                const cruiseFiles = await connection.client.list();

                for (const file of cruiseFiles) {
                  if (file.name.endsWith('.json')) {
                    const cruiseCode = file.name.replace('.json', '');
                    files.push({
                      year: year.toString(),
                      month: month.toString().padStart(2, '0'),
                      lineId: lineId.toString(),
                      shipId: shipDir.name,
                      cruiseCode,
                      fullPath: `${shipPath}/${file.name}`,
                    });
                  }
                }
              }
            }
          } catch (error) {
            // Directory doesn't exist or access error - continue scanning
            logger.debug(`[${lineId}] Could not access ${monthPath}: ${error.message}`);
          }
        }
      }

      logger.info(`[${lineId}] Found ${files.length} cruise files`);
      return files;

    } finally {
      ftpConnectionPool.release(connection.id);
    }
  }

  /**
   * Process a batch of files (queue job handler)
   */
  private async processFileJob(job: Job): Promise<any> {
    const { webhookEventId, lineId, files, processingId } = job.data;
    const results = { processed: 0, updated: 0, created: 0, failed: 0, snapshots: 0 };

    for (const file of files) {
      try {
        await job.updateProgress((results.processed / files.length) * 100);

        const result = await this.processSingleFile(file, webhookEventId);
        results.processed++;

        if (result.updated) results.updated++;
        if (result.created) results.created++;
        if (result.snapshot) results.snapshots++;

      } catch (error) {
        logger.error(`[${lineId}] Failed to process ${file.cruiseCode}:`, error);
        results.failed++;
      }
    }

    return results;
  }

  /**
   * Process a single cruise file
   */
  private async processSingleFile(
    fileInfo: CruiseFileInfo,
    webhookEventId: number
  ): Promise<{ updated: boolean; created: boolean; snapshot: boolean }> {
    const connection = await ftpConnectionPool.acquire();
    const result = { updated: false, created: false, snapshot: false };

    try {
      // Download file content
      const chunks: Buffer[] = [];
      await connection.client.downloadTo(
        {
          write(chunk) { chunks.push(chunk); },
          end() {},
        } as any,
        fileInfo.fullPath
      );

      const jsonContent = Buffer.concat(chunks).toString('utf-8');
      const cruiseData = JSON.parse(jsonContent);

      // Check if cruise exists
      const existingCruise = await db.select()
        .from(cruises)
        .where(eq(cruises.id, cruiseData.codetocruiseid))
        .limit(1);

      if (existingCruise.length > 0) {
        // Take snapshot before update
        const hasChanges = await this.checkForPriceChanges(existingCruise[0], cruiseData);

        if (hasChanges) {
          // Create price snapshot
          await db.insert(priceSnapshots).values({
            cruiseId: existingCruise[0].id,
            interiorPrice: existingCruise[0].interiorPrice,
            oceanviewPrice: existingCruise[0].oceanviewPrice,
            balconyPrice: existingCruise[0].balconyPrice,
            suitePrice: existingCruise[0].suitePrice,
            snapshotDate: new Date(),
            webhookEventId,
          });
          result.snapshot = true;

          // Update cruise
          await this.updateCruise(cruiseData);
          result.updated = true;
        }
      } else {
        // Create new cruise
        await this.createCruise(cruiseData);
        result.created = true;
      }

      return result;

    } catch (error) {
      logger.error(`Failed to process file ${fileInfo.fullPath}:`, error);
      throw error;
    } finally {
      ftpConnectionPool.release(connection.id);
    }
  }

  /**
   * Check if prices have changed
   */
  private async checkForPriceChanges(existing: any, newData: any): Promise<boolean> {
    const oldPrices = {
      interior: existing.interiorPrice,
      oceanview: existing.oceanviewPrice,
      balcony: existing.balconyPrice,
      suite: existing.suitePrice,
    };

    const newPrices = {
      interior: newData.cheapest?.inside || null,
      oceanview: newData.cheapest?.outside || null,
      balcony: newData.cheapest?.balcony || null,
      suite: newData.cheapest?.suite || null,
    };

    return JSON.stringify(oldPrices) !== JSON.stringify(newPrices);
  }

  /**
   * Update existing cruise
   */
  private async updateCruise(cruiseData: any): Promise<void> {
    await db.update(cruises)
      .set({
        interiorPrice: cruiseData.cheapest?.inside || null,
        oceanviewPrice: cruiseData.cheapest?.outside || null,
        balconyPrice: cruiseData.cheapest?.balcony || null,
        suitePrice: cruiseData.cheapest?.suite || null,
        lastCached: cruiseData.lastcached,
        cachedDate: cruiseData.cacheddate,
        updatedAt: new Date(),
      })
      .where(eq(cruises.id, cruiseData.codetocruiseid));
  }

  /**
   * Create new cruise
   */
  private async createCruise(cruiseData: any): Promise<void> {
    // Implementation would be similar to existing cruise creation logic
    // Reuse from existing services
    logger.info(`Creating new cruise: ${cruiseData.codetocruiseid}`);
    // ... cruise creation logic
  }

  /**
   * Process files sequentially (fallback when queue not available)
   */
  private async processFilesSequentially(
    files: CruiseFileInfo[],
    webhookEventId: number,
    stats: ProcessingStats
  ): Promise<void> {
    for (const file of files) {
      try {
        const result = await this.processSingleFile(file, webhookEventId);
        stats.processedFiles++;
        if (result.updated) stats.updatedCruises++;
        if (result.created) stats.createdCruises++;
        if (result.snapshot) stats.snapshotsCreated++;
      } catch (error) {
        stats.failedFiles++;
        stats.errors.push(`${file.cruiseCode}: ${error.message}`);
      }
    }
  }

  /**
   * Monitor queue processing and send updates
   */
  private async monitorProcessing(
    webhookEventId: number,
    lineId: number,
    stats: ProcessingStats,
    jobs: Job[],
    lockKey: string
  ): Promise<void> {
    const checkInterval = setInterval(async () => {
      try {
        // Check job statuses
        let allCompleted = true;
        let totalProcessed = 0;
        let totalUpdated = 0;
        let totalCreated = 0;
        let totalFailed = 0;
        let totalSnapshots = 0;

        for (const job of jobs) {
          const state = await job.getState();
          if (state !== 'completed' && state !== 'failed') {
            allCompleted = false;
          }

          if (state === 'completed') {
            const result = job.returnvalue;
            if (result) {
              totalProcessed += result.processed || 0;
              totalUpdated += result.updated || 0;
              totalCreated += result.created || 0;
              totalFailed += result.failed || 0;
              totalSnapshots += result.snapshots || 0;
            }
          }
        }

        // Update stats
        stats.processedFiles = totalProcessed;
        stats.updatedCruises = totalUpdated;
        stats.createdCruises = totalCreated;
        stats.failedFiles = totalFailed;
        stats.snapshotsCreated = totalSnapshots;

        // Send progress update to Slack every 10 processed files
        if (totalProcessed > 0 && totalProcessed % 10 === 0) {
          await slackService.notifyProcessingProgress(lineId, stats);
        }

        if (allCompleted) {
          clearInterval(checkInterval);
          await this.completeProcessing(webhookEventId, stats, lockKey);
        }
      } catch (error) {
        logger.error('Error monitoring processing:', error);
      }
    }, 5000); // Check every 5 seconds

    // Set maximum monitoring time
    setTimeout(() => {
      clearInterval(checkInterval);
      logger.warn(`[${lineId}] Processing monitor timeout after 30 minutes`);
    }, 30 * 60 * 1000);
  }

  /**
   * Complete processing and cleanup
   */
  private async completeProcessing(
    webhookEventId: number,
    stats: ProcessingStats,
    lockKey: string
  ): Promise<void> {
    stats.endTime = new Date();

    try {
      // Update webhook event status
      await db.update(webhookEvents)
        .set({
          status: stats.failedFiles > 0 ? 'completed_with_errors' : 'completed',
          processedAt: new Date(),
          metadata: JSON.stringify(stats),
        })
        .where(eq(webhookEvents.id, webhookEventId));

      // Send completion notification to Slack
      await slackService.notifyWebhookProcessingCompleted(
        { lineId: parseInt(lockKey.split(':')[2]) },
        {
          successful: stats.updatedCruises + stats.createdCruises,
          failed: stats.failedFiles,
          errors: stats.errors,
          startTime: stats.startTime,
          endTime: stats.endTime,
          processingTimeMs: stats.endTime.getTime() - stats.startTime.getTime(),
          totalCruises: stats.totalFiles,
          priceSnapshotsCreated: stats.snapshotsCreated,
        }
      );

      logger.info(`Webhook processing completed`, stats);

    } finally {
      // Release lock
      await redisClient.del(lockKey);
    }
  }

  /**
   * Shutdown the service gracefully
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down webhook processor...');

    if (this.worker) {
      await this.worker.close();
    }

    if (this.processingQueue) {
      await this.processingQueue.close();
    }

    if (this.redisConnection) {
      await this.redisConnection.quit();
    }
  }
}

// Export singleton instance
export const webhookProcessorOptimized = new WebhookProcessorOptimized();

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  await webhookProcessorOptimized.shutdown();
});

process.on('SIGINT', async () => {
  await webhookProcessorOptimized.shutdown();
});
