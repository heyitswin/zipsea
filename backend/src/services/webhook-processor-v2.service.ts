import { Queue, Worker, Job } from 'bullmq';
import { eq, and, sql, inArray, gte } from 'drizzle-orm';
import { db } from '../db/connection';
import { logger } from '../config/logger';
import {
  cruises,
  pricing,
  cheapestPricing,
  ships,
  cruiseLines,
  ports,
  priceHistory,
} from '../db/schema';
import { traveltekFTPService } from './traveltek-ftp.service';
import { enhancedSlackService as slackService } from './slack-enhanced.service';
import { getDatabaseLineId } from '../config/cruise-line-mapping';
import redisClient from '../cache/redis';

interface WebhookJobData {
  webhookId: string;
  eventType: string;
  lineId: number;
  timestamp: string;
  testMode?: boolean;
}

interface ProcessingResult {
  success: boolean;
  totalCruises: number;
  processedCruises: number;
  successfulUpdates: number;
  failedUpdates: number;
  batches: number;
  duration: number;
  errors: string[];
}

interface CruiseInfo {
  id: string;
  cruiseCode: string;
  shipId: number;
  sailingDate: Date;
}

export class WebhookProcessorV2Service {
  private readonly BATCH_SIZE = 50; // Process 50 cruises at a time
  private readonly FTP_TIMEOUT = 30000; // 30 seconds per file
  private readonly MAX_RETRIES = 3;
  private readonly CONCURRENT_DOWNLOADS = 5; // Download 5 files concurrently

  private queue: Queue<WebhookJobData> | null = null;
  private worker: Worker<WebhookJobData> | null = null;

  constructor() {
    this.initializeQueue();
  }

  /**
   * Initialize BullMQ queue and worker
   */
  private async initializeQueue() {
    if (!redisClient) {
      logger.warn('Redis not available, webhook queue disabled');
      return;
    }

    // Create queue
    this.queue = new Queue<WebhookJobData>('webhook-processor-v2', {
      connection: redisClient as any,
      defaultJobOptions: {
        removeOnComplete: {
          age: 3600, // Keep for 1 hour
          count: 100, // Keep max 100 completed
        },
        removeOnFail: {
          age: 86400, // Keep failed for 24 hours
        },
        attempts: this.MAX_RETRIES,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    // Create worker
    this.worker = new Worker<WebhookJobData>(
      'webhook-processor-v2',
      async (job: Job<WebhookJobData>) => {
        return await this.processWebhookJob(job);
      },
      {
        connection: redisClient as any,
        concurrency: 3, // Process up to 3 webhooks in parallel
        limiter: {
          max: 5,
          duration: 60000, // Max 5 webhooks per minute
        },
      }
    );

    // Error handling
    this.worker.on('error', error => {
      logger.error('Webhook worker error:', error);
    });

    this.worker.on('completed', job => {
      logger.info(`✅ Webhook job completed: ${job.id}`);
    });

    this.worker.on('failed', (job, error) => {
      logger.error(`❌ Webhook job failed: ${job?.id}`, error);
    });

    logger.info('✅ Webhook processor V2 initialized with queue');
  }

  /**
   * Add webhook to processing queue
   */
  async queueWebhook(data: {
    eventType: string;
    lineId: number;
    timestamp: string;
    testMode?: boolean;
  }): Promise<string | null> {
    if (!this.queue) {
      logger.error('Queue not initialized');
      throw new Error('Webhook queue not available');
    }

    const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const job = await this.queue.add('process-webhook', {
      webhookId,
      ...data,
    });

    logger.info(`📦 Webhook queued for processing`, {
      webhookId,
      jobId: job.id,
      lineId: data.lineId,
    });

    return job.id || null;
  }

  /**
   * Process webhook job with proper batching and error handling
   */
  private async processWebhookJob(job: Job<WebhookJobData>): Promise<ProcessingResult> {
    const { webhookId, lineId, eventType, testMode } = job.data;
    const startTime = Date.now();
    const errors: string[] = [];

    logger.info(`🚀 Processing webhook job`, {
      webhookId,
      lineId,
      eventType,
      jobId: job.id,
    });

    const result: ProcessingResult = {
      success: false,
      totalCruises: 0,
      processedCruises: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      batches: 0,
      duration: 0,
      errors,
    };

    try {
      // Step 1: Get database line ID mapping
      const databaseLineId = getDatabaseLineId(lineId);
      await job.updateProgress(5);

      // Step 2: Get all future cruises for the line
      const cruiseInfos = await this.getCruisesForLine(databaseLineId);
      result.totalCruises = cruiseInfos.length;

      logger.info(`📊 Found ${cruiseInfos.length} cruises for line ${databaseLineId}`, {
        webhookId,
        originalLineId: lineId,
        databaseLineId,
      });

      if (cruiseInfos.length === 0) {
        logger.warn(`No active cruises found for line ${lineId}`);
        result.success = true;
        return result;
      }

      await job.updateProgress(10);

      // Step 3: Process in batches
      const batches = this.createBatches(cruiseInfos, this.BATCH_SIZE);
      result.batches = batches.length;

      logger.info(`📦 Processing ${batches.length} batches of ${this.BATCH_SIZE} cruises each`, {
        webhookId,
        totalBatches: batches.length,
      });

      // Notify start of processing
      logger.info(
        `📢 Starting processing of ${result.totalCruises} cruises in ${result.batches} batches`,
        {
          webhookId,
          lineId: databaseLineId,
        }
      );

      // Process each batch
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchNumber = i + 1;

        logger.info(`🔄 Processing batch ${batchNumber}/${batches.length}`, {
          webhookId,
          batchSize: batch.length,
        });

        try {
          const batchResult = await this.processBatch(
            batch,
            databaseLineId,
            webhookId,
            batchNumber
          );

          result.processedCruises += batchResult.processed;
          result.successfulUpdates += batchResult.successful;
          result.failedUpdates += batchResult.failed;

          // Update progress
          const progress = 10 + (90 * (i + 1)) / batches.length;
          await job.updateProgress(Math.round(progress));

          // Send progress update for large lines
          if (batches.length > 5 && batchNumber % 5 === 0) {
            logger.info(`📊 Progress update: batch ${batchNumber}/${batches.length}`, {
              webhookId,
              processedSoFar: result.processedCruises,
              successfulSoFar: result.successfulUpdates,
            });
          }
        } catch (batchError) {
          const errorMsg = `Batch ${batchNumber} failed: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`;
          logger.error(errorMsg, { webhookId, batchNumber });
          errors.push(errorMsg);
          result.failedUpdates += batch.length;
        }

        // Add small delay between batches to prevent overwhelming FTP
        if (i < batches.length - 1) {
          await this.delay(2000); // 2 second delay between batches
        }
      }

      result.success = result.successfulUpdates > 0;
      result.duration = Date.now() - startTime;

      // Send completion notification
      await slackService.notifyEnhancedWebhookUpdate({
        lineId,
        databaseLineId,
        successful: result.successfulUpdates,
        failed: result.failedUpdates,
        created: 0,
        totalFiles: result.totalCruises,
        successfulDownloads: result.successfulUpdates,
        failedDownloads: result.failedUpdates,
        corruptedFiles: 0,
        fileNotFoundErrors: result.failedUpdates,
        parseErrors: 0,
        successRate: Math.round((result.successfulUpdates / result.totalCruises) * 100),
        duration: result.duration,
      });

      logger.info(`✅ Webhook processing completed`, {
        webhookId,
        ...result,
      });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Webhook processing failed`, {
        webhookId,
        error: errorMsg,
      });

      errors.push(errorMsg);
      result.errors = errors;
      result.duration = Date.now() - startTime;

      // Send error notification
      await slackService.notifySyncError(errorMsg, `Webhook ${webhookId} for line ${lineId}`);

      throw error;
    }
  }

  /**
   * Get all active future cruises for a line
   */
  private async getCruisesForLine(lineId: number): Promise<CruiseInfo[]> {
    const cruiseData = await db
      .select({
        id: cruises.id,
        cruiseCode: cruises.cruiseId,
        shipId: cruises.shipId,
        sailingDate: cruises.sailingDate,
      })
      .from(cruises)
      .where(
        and(
          eq(cruises.cruiseLineId, lineId),
          gte(cruises.sailingDate, sql`CURRENT_DATE`),
          eq(cruises.isActive, true)
        )
      )
      .orderBy(cruises.sailingDate);

    return cruiseData.map(cruise => ({
      id: cruise.id,
      cruiseCode: cruise.cruiseCode || '',
      shipId: cruise.shipId || 0,
      sailingDate: new Date(cruise.sailingDate),
    }));
  }

  /**
   * Create batches from cruise list
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a batch of cruises
   */
  private async processBatch(
    batch: CruiseInfo[],
    lineId: number,
    webhookId: string,
    batchNumber: number
  ): Promise<{ processed: number; successful: number; failed: number }> {
    const result = {
      processed: 0,
      successful: 0,
      failed: 0,
    };

    // Process in smaller concurrent groups
    const concurrentGroups = this.createBatches(batch, this.CONCURRENT_DOWNLOADS);

    for (const group of concurrentGroups) {
      const promises = group.map(async cruise => {
        try {
          await this.processSingleCruise(cruise, lineId);
          result.successful++;
        } catch (error) {
          logger.error(`Failed to process cruise ${cruise.id}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            webhookId,
            batchNumber,
          });
          result.failed++;
        }
        result.processed++;
      });

      // Wait for concurrent group to complete
      await Promise.allSettled(promises);
    }

    return result;
  }

  /**
   * Update cruise data in database
   */
  private async updateCruiseFromData(cruiseId: string, data: any): Promise<void> {
    try {
      // Extract pricing data
      const prices = data.prices || {};
      const cheapest = data.cheapest || {};

      // Update cruise basic info and prices
      await db
        .update(cruises)
        .set({
          name: data.name,
          nights: data.nights,
          sailingDate: data.saildate,
          returnDate: data.enddate || data.saildate,
          embarkationPortId: data.startportid,
          disembarkationPortId: data.endportid,
          interiorPrice: cheapest.inside || null,
          oceanviewPrice: cheapest.outside || null,
          balconyPrice: cheapest.balcony || null,
          suitePrice: cheapest.suite || null,
          updatedAt: new Date(),
        })
        .where(eq(cruises.id, cruiseId));

      // Update detailed pricing if available
      if (Object.keys(prices).length > 0) {
        // Process cabin pricing
        for (const [rateCode, cabinData] of Object.entries(prices)) {
          for (const [cabinCode, occupancyData] of Object.entries(cabinData as any)) {
            for (const [occupancy, priceData] of Object.entries(occupancyData as any)) {
              // Type the price data
              const typedPriceData = priceData as any;

              // Update or insert pricing (simplified for now)
              // TODO: Add proper pricing update logic based on actual schema
              logger.debug(
                `Would update pricing for cabin ${cabinCode}, rate ${rateCode}, occupancy ${occupancy}`
              );
            }
          }
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to update cruise ${cruiseId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Process a single cruise update
   */
  private async processSingleCruise(cruise: CruiseInfo, lineId: number): Promise<void> {
    const year = cruise.sailingDate.getFullYear();
    const month = String(cruise.sailingDate.getMonth() + 1).padStart(2, '0');
    const filePath = `/${year}/${month}/${lineId}/${cruise.shipId}/${cruise.id}.json`;

    try {
      // Connect to FTP if not connected
      await traveltekFTPService.connect();

      // Download file with timeout
      const fileContent = await this.downloadWithTimeout(filePath, this.FTP_TIMEOUT);

      if (!fileContent) {
        throw new Error('Empty file content');
      }

      // Parse JSON
      const cruiseData = JSON.parse(fileContent);

      // Update cruise in database using direct update
      await this.updateCruiseFromData(cruise.id, cruiseData);
    } catch (error) {
      throw new Error(
        `Failed to process cruise ${cruise.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Download file with timeout
   */
  private async downloadWithTimeout(filePath: string, timeout: number): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Download timeout for ${filePath}`));
      }, timeout);

      try {
        // Use a custom download method that we'll add to FTP service
        const content = await this.downloadFileDirectly(filePath);
        clearTimeout(timer);
        resolve(content);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Download file directly using FTP
   */
  private async downloadFileDirectly(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Import the FTP client type
      const Client = require('ftp');
      const client = new Client();

      client.on('ready', () => {
        client.get(filePath, (err: any, stream: any) => {
          if (err) {
            client.end();
            reject(err);
            return;
          }

          let content = '';
          stream.on('data', (chunk: Buffer) => {
            content += chunk.toString('utf-8');
          });

          stream.on('end', () => {
            client.end();
            resolve(content);
          });

          stream.on('error', (streamErr: any) => {
            client.end();
            reject(streamErr);
          });
        });
      });

      client.on('error', (err: any) => {
        reject(err);
      });

      // Connect using environment variables
      client.connect({
        host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
        user: process.env.TRAVELTEK_FTP_USER,
        password: process.env.TRAVELTEK_FTP_PASSWORD,
        secure: false,
        secureOptions: { rejectUnauthorized: false },
      });
    });
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    if (!this.queue) {
      return null;
    }

    const counts = await this.queue.getJobCounts();
    const workers = await this.queue.getWorkers();

    return {
      counts,
      workers: workers.length,
      isPaused: await this.queue.isPaused(),
    };
  }

  /**
   * Clear completed jobs
   */
  async clearCompleted() {
    if (!this.queue) {
      return;
    }

    await this.queue.clean(0, 1000, 'completed');
  }

  /**
   * Retry failed jobs
   */
  async retryFailed() {
    if (!this.queue) {
      return 0;
    }

    const failed = await this.queue.getFailed(0, 100);
    for (const job of failed) {
      await job.retry();
    }

    return failed.length;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('Shutting down webhook processor V2...');

    if (this.worker) {
      await this.worker.close();
    }

    if (this.queue) {
      await this.queue.close();
    }
  }
}

// Export singleton instance
export const webhookProcessorV2 = new WebhookProcessorV2Service();
