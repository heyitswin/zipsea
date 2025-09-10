import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import * as path from 'path';
import * as fs from 'fs/promises';
import { db } from '../db/connection';
import { webhookEvents, systemFlags, priceSnapshots, syncLocks } from '../db/schema/webhook-events';
import { cruises, pricing } from '../db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { ftpConnectionPool } from './ftp-connection-pool.service';
import { slackService } from './slack.service';
import * as ftp from 'basic-ftp';

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

export class WebhookProcessorFixed {
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
    // BullMQ requires maxRetriesPerRequest to be null
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    } else {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    }

    // Check and warn about eviction policy
    this.checkRedisConfig();

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

  private async checkRedisConfig() {
    try {
      const config = await this.redis.config('GET', 'maxmemory-policy');
      const policy = config[1];
      if (policy !== 'noeviction') {
        console.warn(`IMPORTANT! Eviction policy is ${policy}. It should be "noeviction"`);
      }
    } catch (error) {
      console.error('Could not check Redis eviction policy:', error);
    }
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
    let lock: any = null;

    try {
      console.log(`Starting webhook processing for line ${lineId || 'all'}`);

      await slackService.sendNotification({
        text: '🚀 Starting fixed webhook processing',
        fields: [
          { title: 'Line ID', value: lineId ? lineId.toString() : 'All lines', short: true },
          { title: 'Start Time', value: new Date().toISOString(), short: true },
        ],
      });

      // Check for existing lock and handle stale locks
      const lockKey = `webhook-sync-${lineId || 'all'}`;

      // First, check if there's an existing lock
      const existingLock = await db
        .select()
        .from(syncLocks)
        .where(eq(syncLocks.lockKey, lockKey))
        .limit(1);

      if (existingLock.length > 0 && existingLock[0].isActive) {
        const lockAge = Date.now() - new Date(existingLock[0].acquiredAt).getTime();
        if (lockAge < 30 * 60 * 1000) {
          // Lock is still fresh (less than 30 minutes old)
          console.log(
            `Lock ${lockKey} is still active (age: ${Math.floor(lockAge / 60000)} minutes)`
          );
          throw new Error('Another sync process is already running');
        }
        // Lock is stale, we'll take it over
        console.log(
          `Taking over stale lock ${lockKey} (age: ${Math.floor(lockAge / 60000)} minutes)`
        );
      }

      // Acquire or update lock using upsert
      const locks = await db
        .insert(syncLocks)
        .values({
          lockKey,
          isActive: true,
          acquiredAt: new Date(),
          releasedAt: null,
          metadata: { lineId, processId: process.pid },
        })
        .onConflictDoUpdate({
          target: syncLocks.lockKey,
          set: {
            isActive: true,
            acquiredAt: new Date(),
            releasedAt: null,
            metadata: { lineId, processId: process.pid },
          },
        })
        .returning();

      lock = locks[0];
      console.log(`Acquired lock ${lock.id} for ${lockKey}`);

      // Skip file discovery for now - just log success
      console.log('TEMPORARY: Skipping FTP file discovery to test webhook flow');
      this.stats.filesDiscovered = 0;

      await slackService.sendNotification({
        text: `✅ Webhook received for line ${lineId || 'all'}`,
        fields: [
          { title: 'Status', value: 'FTP temporarily disabled', short: true },
          { title: 'Action', value: 'Webhook acknowledged', short: true },
        ],
      });

      console.log('No files to process (FTP disabled)');
      return;

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
    } catch (error) {
      console.error('Webhook processing failed:', error);
      await slackService.sendError('Webhook processing failed', error as Error);
      throw error;
    } finally {
      // Always release lock if we acquired one
      if (lock) {
        try {
          await db
            .update(syncLocks)
            .set({ isActive: false, releasedAt: new Date() })
            .where(eq(syncLocks.id, lock.id));
          console.log(`Released lock ${lock.id}`);
        } catch (releaseError) {
          console.error(`Failed to release lock ${lock.id}:`, releaseError);
        }
      }
    }
  }

  private async discoverFilesFixed(lineId?: number): Promise<WebhookFile[]> {
    const files: WebhookFile[] = [];

    // Create a dedicated FTP client for discovery (don't use pool for listing)
    const client = new ftp.Client();
    client.ftp.verbose = false;

    try {
      // Connect to FTP
      await client.access({
        host: process.env.TRAVELTEK_FTP_HOST || process.env.FTP_HOST || 'localhost',
        user: process.env.TRAVELTEK_FTP_USER || process.env.FTP_USER || '',
        password: process.env.TRAVELTEK_FTP_PASSWORD || process.env.FTP_PASSWORD || '',
        secure: false,
      });

      const currentDate = new Date();
      const startYear = currentDate.getFullYear();
      const startMonth = currentDate.getMonth() + 1;

      // IMPORTANT: Only scan 3 months ahead, not 3 years!
      const endDate = new Date(currentDate);
      endDate.setMonth(endDate.getMonth() + 3);
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth() + 1;

      console.log(`Scanning from ${startYear}/${startMonth} to ${endYear}/${endMonth}`);

      for (let year = startYear; year <= endYear; year++) {
        const monthStart = year === startYear ? startMonth : 1;
        const monthEnd = year === endYear ? endMonth : 12;

        for (let month = monthStart; month <= monthEnd; month++) {
          const monthStr = month.toString().padStart(2, '0');
          const basePath = `/${year}/${monthStr}`;

          try {
            console.log(`Checking ${basePath}...`);
            const dayDirs = await client.list(basePath);

            for (const dayDir of dayDirs) {
              if (dayDir.type === 2) {
                // Directory
                const dayPath = `${basePath}/${dayDir.name}`;

                try {
                  const dayFiles = await client.list(dayPath);

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
                } catch (dayError) {
                  console.log(`Could not list ${dayPath}:`, (dayError as Error).message);
                }
              }
            }
          } catch (error) {
            console.log(`No data for ${basePath}:`, (error as Error).message);
          }
        }
      }

      console.log(`Found ${files.length} files to process`);
    } catch (error) {
      console.error('FTP connection failed:', error);
      throw error;
    } finally {
      // Always close the client
      try {
        client.close();
      } catch (closeError) {
        console.error('Error closing FTP client:', closeError);
      }
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
        concurrency: 2, // Reduced concurrency to avoid overwhelming FTP
      }
    );
  }

  private async processFile(file: WebhookFile) {
    const conn = await ftpConnectionPool.getConnection();

    try {
      // Check if already processed recently (within last 24 hours)
      const recentEvent = await db
        .select()
        .from(webhookEvents)
        .where(
          and(
            eq(webhookEvents.webhookType, 'file_processed'),
            eq(webhookEvents.lineId, file.lineId),
            gte(webhookEvents.processedAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
          )
        )
        .limit(1);

      if (recentEvent.length > 0 && recentEvent[0].metadata?.path === file.path) {
        console.log(`Skipping recently processed file: ${file.path}`);
        this.stats.filesSkipped++;
        return;
      }

      // Download and parse file
      const tempFile = `/tmp/webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jsonl`;

      console.log(`Downloading ${file.path} to ${tempFile}`);
      await conn.client.downloadTo(tempFile, file.path);

      const content = await fs.readFile(tempFile, 'utf-8');
      await fs.unlink(tempFile);

      const lines = content.split('\n').filter(line => line.trim());
      let cruisesProcessed = 0;
      let pricesProcessed = 0;

      // Take snapshot before processing (only for first file of the line)
      const hasSnapshot = await db
        .select()
        .from(priceSnapshots)
        .where(
          and(
            eq(priceSnapshots.lineId, file.lineId),
            gte(priceSnapshots.createdAt, new Date(Date.now() - 60 * 60 * 1000))
          )
        )
        .limit(1);

      if (hasSnapshot.length === 0) {
        await this.takeSnapshot(file.lineId);
      }

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
        webhookType: 'file_processed',
        lineId: file.lineId,
        metadata: {
          path: file.path,
          size: file.size,
          cruisesProcessed,
          pricesProcessed,
        },
        status: 'completed',
        processedAt: new Date(),
      });

      console.log(`Processed ${file.path}: ${cruisesProcessed} cruises, ${pricesProcessed} prices`);

      this.stats.cruisesUpdated += cruisesProcessed;
      this.stats.pricesUpdated += pricesProcessed;
    } catch (error) {
      console.error(`Failed to process file ${file.path}:`, error);

      await db.insert(webhookEvents).values({
        webhookType: 'file_error',
        lineId: file.lineId,
        metadata: {
          path: file.path,
          error: (error as Error).message,
        },
        status: 'failed',
        errorMessage: (error as Error).message,
        processedAt: new Date(),
      });

      throw error;
    } finally {
      ftpConnectionPool.releaseConnection(conn.id);
    }
  }

  private async takeSnapshot(lineId: number) {
    try {
      // Create price snapshot with limited data
      const snapshotData = await this.getCurrentPrices(lineId);

      await db.insert(priceSnapshots).values({
        lineId,
        snapshotData,
        createdAt: new Date(),
      });

      console.log(`Created price snapshot for line ${lineId}`);
    } catch (error) {
      console.error(`Failed to create snapshot for line ${lineId}:`, error);
    }
  }

  private async getCurrentPrices(lineId: number) {
    const prices = await db
      .select({
        cruiseId: pricing.cruiseId,
        cabinCode: pricing.cabinCode,
        basePrice: pricing.basePrice,
        totalPrice: pricing.totalPrice,
      })
      .from(pricing)
      .innerJoin(cruises, eq(cruises.id, pricing.cruiseId))
      .where(eq(cruises.cruiseLineId, lineId))
      .limit(100); // Limit snapshot size

    return prices;
  }

  private async updateCruise(cruiseData: any) {
    try {
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
            name: cruiseData.name || existingCruise[0].name,
            nights: cruiseData.nights || existingCruise[0].nights,
            sailingDate: cruiseData.embarkDate || existingCruise[0].sailingDate,
            updatedAt: new Date(),
          })
          .where(eq(cruises.id, existingCruise[0].id));
      }
    } catch (error) {
      console.error(`Failed to update cruise ${cruiseData.id}:`, error);
    }
  }

  private async updatePricing(pricingData: any) {
    try {
      // Update pricing
      const existingPricing = await db
        .select()
        .from(pricing)
        .where(
          and(
            eq(pricing.cruiseId, pricingData.cruiseId),
            eq(pricing.cabinCode, pricingData.cabinCode || 'DEFAULT')
          )
        )
        .limit(1);

      if (existingPricing.length > 0) {
        await db
          .update(pricing)
          .set({
            rateCode: pricingData.rateCode || existingPricing[0].rateCode,
            basePrice: pricingData.price || existingPricing[0].basePrice,
            taxes: pricingData.taxes || existingPricing[0].taxes,
            totalPrice: pricingData.totalPrice || existingPricing[0].totalPrice,
            updatedAt: new Date(),
          })
          .where(eq(pricing.id, existingPricing[0].id));
      } else if (pricingData.cruiseId && pricingData.price) {
        // Insert new pricing if it doesn't exist
        await db.insert(pricing).values({
          cruiseId: pricingData.cruiseId,
          cabinCode: pricingData.cabinCode || 'DEFAULT',
          rateCode: pricingData.rateCode || 'STANDARD',
          basePrice: pricingData.price,
          taxes: pricingData.taxes || 0,
          totalPrice: pricingData.totalPrice || pricingData.price,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      console.error(`Failed to update pricing for cruise ${pricingData.cruiseId}:`, error);
    }
  }

  private async waitForCompletion() {
    // If no files were discovered, return immediately
    if (this.stats.filesDiscovered === 0) {
      console.log('No files to wait for');
      return;
    }

    return new Promise(resolve => {
      let checksWithoutJobs = 0;
      const maxChecksWithoutJobs = 3; // Give up after 15 seconds of no jobs

      const checkInterval = setInterval(async () => {
        try {
          const waiting = await this.fileQueue.getWaitingCount();
          const active = await this.fileQueue.getActiveCount();

          console.log(`Queue status - Waiting: ${waiting}, Active: ${active}`);

          if (waiting === 0 && active === 0) {
            checksWithoutJobs++;
            if (checksWithoutJobs >= maxChecksWithoutJobs) {
              clearInterval(checkInterval);
              resolve(true);
            }
          } else {
            checksWithoutJobs = 0; // Reset counter if jobs are found
          }
        } catch (error) {
          console.error('Error checking queue status:', error);
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 5000);
    });
  }

  private async generateReport() {
    this.stats.endTime = new Date();
    const duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();
    const durationMinutes = Math.floor(duration / 60000);
    const durationSeconds = Math.floor((duration % 60000) / 1000);

    await slackService.sendNotification({
      text: '✅ Webhook processing completed',
      fields: [
        { title: 'Duration', value: `${durationMinutes}m ${durationSeconds}s`, short: true },
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
  }
}
