import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import * as path from 'path';
import { db } from '../db/connection';
import { webhookEvents, systemFlags, priceSnapshots, syncLocks } from '../db/schema/webhook-events';
import { cruises, pricing } from '../db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { ftpConnectionPool } from './ftp-connection-pool.service';
import { slackService } from './slack.service';

interface WebhookFile {
  path: string;
  size: number;
  modifiedAt: Date;
  lineId: number;
}

interface ProcessingStats {
  filesDiscovered: number;
  filesProcessed: number;
  filesSkipped: number;
  filesFailed: number;
  cruisesUpdated: number;
  pricesUpdated: number;
  startTime: Date;
  endTime?: Date;
}

export class WebhookProcessorOptimized {
  private redis: Redis;
  private fileQueue: Queue;
  private processingWorker?: Worker;
  private queueEvents: QueueEvents;
  private stats: ProcessingStats = {
    filesDiscovered: 0,
    filesProcessed: 0,
    filesSkipped: 0,
    filesFailed: 0,
    cruisesUpdated: 0,
    pricesUpdated: 0,
    startTime: new Date(),
  };

  constructor() {
    // Use REDIS_URL if available, otherwise fall back to individual settings
    const redisConfig = process.env.REDIS_URL
      ? process.env.REDIS_URL
      : {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          maxRetriesPerRequest: 3,
        };

    this.redis = new Redis(redisConfig);

    this.fileQueue = new Queue('webhook-files', {
      connection: this.redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });

    this.queueEvents = new QueueEvents('webhook-files', {
      connection: this.redis,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      console.log(`Job ${jobId} completed`);
      this.stats.filesProcessed++;
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`Job ${jobId} failed:`, failedReason);
      this.stats.filesFailed++;
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      console.log(`Job ${jobId} progress:`, data);
    });
  }

  async processWebhooks(lineId?: number) {
    try {
      await slackService.sendNotification({
        text: '🚀 Starting optimized webhook processing',
        fields: [
          { title: 'Line ID', value: lineId ? lineId.toString() : 'All lines', short: true },
          { title: 'Start Time', value: new Date().toISOString(), short: true },
        ],
      });

      // Check for existing lock
      const lockKey = `webhook-sync-${lineId || 'all'}`;
      const existingLock = await db
        .select()
        .from(syncLocks)
        .where(and(eq(syncLocks.lockKey, lockKey), eq(syncLocks.isActive, true)))
        .limit(1);

      if (existingLock.length > 0) {
        const lockAge = Date.now() - new Date(existingLock[0].acquiredAt).getTime();
        if (lockAge < 30 * 60 * 1000) {
          // 30 minutes
          throw new Error('Another sync process is already running');
        }
        // Release stale lock
        await db
          .update(syncLocks)
          .set({ isActive: false, releasedAt: new Date() })
          .where(eq(syncLocks.id, existingLock[0].id));
      }

      // Acquire lock
      const [lock] = await db
        .insert(syncLocks)
        .values({
          lockKey,
          isActive: true,
          acquiredAt: new Date(),
          metadata: { lineId, processId: process.pid },
        })
        .returning();

      try {
        // Discover files
        const files = await this.discoverFiles(lineId);
        this.stats.filesDiscovered = files.length;

        await slackService.sendNotification({
          text: `📁 Discovered ${files.length} files to process`,
        });

        // Add files to queue
        const jobs = files.map(file => ({
          name: `process-${path.basename(file.path)}`,
          data: file,
        }));

        await this.fileQueue.addBulk(jobs);

        // Start worker
        await this.startWorker();

        // Wait for completion
        await this.waitForCompletion();

        // Generate final report
        await this.generateReport();
      } finally {
        // Release lock
        await db
          .update(syncLocks)
          .set({ isActive: false, releasedAt: new Date() })
          .where(eq(syncLocks.id, lock.id));
      }
    } catch (error) {
      console.error('Webhook processing failed:', error);
      await slackService.sendError('Webhook processing failed', error as Error);
      throw error;
    }
  }

  private async discoverFiles(lineId?: number): Promise<WebhookFile[]> {
    const files: WebhookFile[] = [];
    const conn = await ftpConnectionPool.getConnection();

    try {
      const currentDate = new Date();
      const startYear = currentDate.getFullYear();
      const startMonth = currentDate.getMonth() + 1;
      const endYear = startYear + 3;

      for (let year = startYear; year <= endYear; year++) {
        const monthStart = year === startYear ? startMonth : 1;
        const monthEnd = year === endYear ? 12 : 12;

        for (let month = monthStart; month <= monthEnd; month++) {
          const monthStr = month.toString().padStart(2, '0');
          const basePath = `/${year}/${monthStr}`;

          try {
            const dayDirs = await conn.client.list(basePath);

            for (const dayDir of dayDirs) {
              if (dayDir.type === 2) {
                // Directory
                const dayPath = `${basePath}/${dayDir.name}`;
                const dayFiles = await conn.client.list(dayPath);

                for (const file of dayFiles) {
                  if (file.type === 1 && file.name.endsWith('.jsonl')) {
                    // Extract line ID from filename
                    const match = file.name.match(/line_(\d+)_/);
                    if (match) {
                      const fileLineId = parseInt(match[1]);
                      if (!lineId || fileLineId === lineId) {
                        files.push({
                          path: `${dayPath}/${file.name}`,
                          size: file.size,
                          modifiedAt: file.modifiedAt || new Date(),
                          lineId: fileLineId,
                        });
                      }
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.log(`No data for ${basePath}:`, error);
          }
        }
      }
    } finally {
      ftpConnectionPool.releaseConnection(conn.id);
    }

    return files;
  }

  private async startWorker() {
    this.processingWorker = new Worker(
      'webhook-files',
      async job => {
        const file = job.data as WebhookFile;
        await this.processFile(file);
        await job.updateProgress(100);
      },
      {
        connection: this.redis,
        concurrency: 3, // Process 3 files in parallel
      }
    );
  }

  private async processFile(file: WebhookFile) {
    const conn = await ftpConnectionPool.getConnection();

    try {
      // Check if already processed
      const existingEvent = await db
        .select()
        .from(webhookEvents)
        .where(
          and(
            eq(webhookEvents.eventType, 'file_processed'),
            eq(webhookEvents.metadata, sql`${file.path}`)
          )
        )
        .limit(1);

      if (existingEvent.length > 0) {
        this.stats.filesSkipped++;
        return;
      }

      // Download and parse file
      const tempFile = `/tmp/webhook-${Date.now()}.jsonl`;
      await conn.client.downloadTo(tempFile, file.path);
      const fs = await import('fs');
      const content = await fs.promises.readFile(tempFile, 'utf-8');
      await fs.promises.unlink(tempFile);

      const lines = content.split('\n').filter(line => line.trim());
      let cruisesProcessed = 0;
      let pricesProcessed = 0;

      // Take snapshot before processing
      await this.takeSnapshot(file.lineId);

      for (const line of lines) {
        try {
          const data = JSON.parse(line);

          if (data.cruise) {
            await this.updateCruise(data.cruise);
            cruisesProcessed++;
          }

          if (data.pricing) {
            await this.updatePricing(data.pricing);
            pricesProcessed++;
          }
        } catch (error) {
          console.error(`Error processing line in ${file.path}:`, error);
        }
      }

      // Record processed event
      await db.insert(webhookEvents).values({
        eventType: 'file_processed',
        lineId: file.lineId,
        payload: {
          path: file.path,
          size: file.size,
          cruisesProcessed,
          pricesProcessed,
        },
        metadata: file.path,
        status: 'completed',
        processedAt: new Date(),
      });

      this.stats.cruisesUpdated += cruisesProcessed;
      this.stats.pricesUpdated += pricesProcessed;
    } catch (error) {
      console.error(`Failed to process file ${file.path}:`, error);

      await db.insert(webhookEvents).values({
        eventType: 'file_error',
        lineId: file.lineId,
        payload: {
          path: file.path,
          error: (error as Error).message,
        },
        metadata: file.path,
        status: 'failed',
        processedAt: new Date(),
      });

      throw error;
    } finally {
      ftpConnectionPool.releaseConnection(conn.id);
    }
  }

  private async takeSnapshot(lineId: number) {
    // Create price snapshot
    await db.insert(priceSnapshots).values({
      lineId,
      snapshotData: await this.getCurrentPrices(lineId),
      createdAt: new Date(),
    });
  }

  private async getCurrentPrices(lineId: number) {
    const prices = await db
      .select()
      .from(pricing)
      .innerJoin(cruises, eq(cruises.id, pricing.cruiseId))
      .where(eq(cruises.cruiseLineId, lineId))
      .limit(1000);

    return prices;
  }

  private async updateCruise(cruiseData: any) {
    // Update cruise details
    const existingCruise = await db
      .select()
      .from(cruises)
      .where(eq(cruises.id, cruiseData.id))
      .limit(1);

    if (existingCruise.length > 0) {
      await db
        .update(cruises)
        .set({
          name: cruiseData.name,
          nights: cruiseData.nights,
          sailingDate: cruiseData.embarkDate,
          updatedAt: new Date(),
        })
        .where(eq(cruises.id, existingCruise[0].id));
    }
  }

  private async updatePricing(pricingData: any) {
    // Update pricing
    const existingPricing = await db
      .select()
      .from(pricing)
      .where(
        and(
          eq(pricing.cruiseId, pricingData.cruiseId),
          eq(pricing.cabinCode, pricingData.cabinCode)
        )
      )
      .limit(1);

    if (existingPricing.length > 0) {
      await db
        .update(pricing)
        .set({
          rateCode: pricingData.rateCode,
          basePrice: pricingData.price,
          taxes: pricingData.taxes,
          totalPrice: pricingData.totalPrice,
          updatedAt: new Date(),
        })
        .where(eq(pricing.id, existingPricing[0].id));
    }
  }

  private async waitForCompletion() {
    return new Promise(resolve => {
      const checkInterval = setInterval(async () => {
        const waiting = await this.fileQueue.getWaitingCount();
        const active = await this.fileQueue.getActiveCount();

        if (waiting === 0 && active === 0) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 5000);
    });
  }

  private async generateReport() {
    this.stats.endTime = new Date();
    const duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();
    const durationMinutes = Math.floor(duration / 60000);

    await slackService.sendNotification({
      text: '✅ Webhook processing completed',
      fields: [
        { title: 'Duration', value: `${durationMinutes} minutes`, short: true },
        { title: 'Files Discovered', value: this.stats.filesDiscovered.toString(), short: true },
        { title: 'Files Processed', value: this.stats.filesProcessed.toString(), short: true },
        { title: 'Files Skipped', value: this.stats.filesSkipped.toString(), short: true },
        { title: 'Files Failed', value: this.stats.filesFailed.toString(), short: true },
        { title: 'Cruises Updated', value: this.stats.cruisesUpdated.toString(), short: true },
        { title: 'Prices Updated', value: this.stats.pricesUpdated.toString(), short: true },
      ],
    });

    // Update system flags
    await db
      .insert(systemFlags)
      .values({
        flagKey: 'last_webhook_sync',
        flagValue: new Date().toISOString(),
        metadata: this.stats,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemFlags.flagKey,
        set: {
          flagValue: new Date().toISOString(),
          metadata: this.stats,
          updatedAt: new Date(),
        },
      });
  }

  async shutdown() {
    if (this.processingWorker) {
      await this.processingWorker.close();
    }
    await this.fileQueue.close();
    await this.queueEvents.close();
    await this.redis.quit();
    await ftpConnectionPool.shutdown();
  }
}

export const webhookProcessorOptimized = new WebhookProcessorOptimized();
