import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import * as path from 'path';
import * as fs from 'fs/promises';
import { db } from '../db/connection';
import { webhookEvents, systemFlags, priceSnapshots, syncLocks } from '../db/schema/webhook-events';
import { cruises, pricing } from '../db/schema';
import { eq, and, gte, sql, inArray } from 'drizzle-orm';
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
  errors: string[];
}

export class WebhookProcessorRobust {
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
    errors: [],
  };

  // Configuration
  private readonly MAX_FILES_PER_WEBHOOK = 50; // Process max 50 files per webhook
  private readonly MAX_CONCURRENT_DOWNLOADS = 2; // Download 2 files at a time
  private readonly FTP_TIMEOUT = 30000; // 30 second timeout for FTP operations
  private readonly LOCK_TIMEOUT = 30 * 60 * 1000; // 30 minutes max lock time

  constructor() {
    // Use REDIS_URL if available
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

    this.fileQueue = new Queue('webhook-files-robust', {
      connection: this.redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });

    this.queueEvents = new QueueEvents('webhook-files-robust', {
      connection: this.redis,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.queueEvents.on('completed', ({ jobId }) => {
      console.log(`Job ${jobId} completed`);
      this.stats.filesProcessed++;
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`Job ${jobId} failed:`, failedReason);
      this.stats.filesFailed++;
      this.stats.errors.push(failedReason || 'Unknown error');
    });
  }

  async processWebhooks(lineId?: number) {
    let lock: any = null;

    try {
      console.log(`[ROBUST] Starting webhook processing for line ${lineId || 'all'}`);

      // Send initial notification
      await this.sendSlackNotification({
        text: `🚀 Starting robust webhook processing`,
        fields: [
          { title: 'Line ID', value: lineId ? lineId.toString() : 'All lines', short: true },
          { title: 'Max Files', value: this.MAX_FILES_PER_WEBHOOK.toString(), short: true },
        ],
      });

      // Acquire lock with proper timeout handling
      lock = await this.acquireLock(lineId);

      // Get cruise IDs that need updating (from database)
      const cruisesToUpdate = await this.getCruisesNeedingUpdate(lineId);
      console.log(`[ROBUST] Found ${cruisesToUpdate.length} cruises needing updates`);

      if (cruisesToUpdate.length === 0) {
        console.log('[ROBUST] No cruises need updating');
        await this.sendSlackNotification({
          text: `✅ No updates needed for line ${lineId || 'all'}`,
        });
        return;
      }

      // Discover files on FTP (with timeout)
      const files = await this.discoverFilesWithTimeout(lineId, cruisesToUpdate);
      this.stats.filesDiscovered = files.length;

      if (files.length === 0) {
        console.log('[ROBUST] No files found on FTP');
        await this.sendSlackNotification({
          text: `📁 No files found on FTP for line ${lineId || 'all'}`,
        });
        return;
      }

      // Limit files to process
      const filesToProcess = files.slice(0, this.MAX_FILES_PER_WEBHOOK);
      console.log(`[ROBUST] Processing ${filesToProcess.length} of ${files.length} files`);

      await this.sendSlackNotification({
        text: `📁 Processing ${filesToProcess.length} files`,
        fields: [
          { title: 'Total Found', value: files.length.toString(), short: true },
          { title: 'Processing', value: filesToProcess.length.toString(), short: true },
        ],
      });

      // Process files in batches
      await this.processFilesInBatches(filesToProcess);

      // Generate final report
      await this.generateReport();
    } catch (error) {
      console.error('[ROBUST] Webhook processing failed:', error);
      this.stats.errors.push(error instanceof Error ? error.message : 'Unknown error');
      await this.sendSlackError('Webhook processing failed', error as Error);
      throw error;
    } finally {
      // Always release lock
      if (lock) {
        await this.releaseLock(lock);
      }
      // Clean up resources
      await this.cleanup();
    }
  }

  private async acquireLock(lineId?: number) {
    const lockKey = `webhook-sync-${lineId || 'all'}`;

    // Check for existing lock
    const existingLock = await db
      .select()
      .from(syncLocks)
      .where(eq(syncLocks.lockKey, lockKey))
      .limit(1);

    if (existingLock.length > 0 && existingLock[0].isActive) {
      const lockAge = Date.now() - new Date(existingLock[0].acquiredAt).getTime();
      if (lockAge < this.LOCK_TIMEOUT) {
        // For the same line, wait a bit and retry once
        if (lineId) {
          console.log(`[ROBUST] Lock active for line ${lineId}, waiting 5s...`);
          await new Promise(resolve => setTimeout(resolve, 5000));

          // Check again
          const recheckLock = await db
            .select()
            .from(syncLocks)
            .where(eq(syncLocks.lockKey, lockKey))
            .limit(1);

          if (recheckLock.length > 0 && recheckLock[0].isActive) {
            const newLockAge = Date.now() - new Date(recheckLock[0].acquiredAt).getTime();
            if (newLockAge < this.LOCK_TIMEOUT) {
              throw new Error(`Another webhook is processing line ${lineId}`);
            }
          }
        } else {
          throw new Error('Another sync process is running');
        }
      }
      console.log(`[ROBUST] Taking over stale lock (age: ${Math.floor(lockAge / 60000)} min)`);
    }

    // Acquire or update lock
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

    console.log(`[ROBUST] Acquired lock ${locks[0].id}`);
    return locks[0];
  }

  private async releaseLock(lock: any) {
    try {
      await db
        .update(syncLocks)
        .set({ isActive: false, releasedAt: new Date() })
        .where(eq(syncLocks.id, lock.id));
      console.log(`[ROBUST] Released lock ${lock.id}`);
    } catch (error) {
      console.error(`[ROBUST] Failed to release lock ${lock.id}:`, error);
    }
  }

  private async getCruisesNeedingUpdate(lineId?: number): Promise<string[]> {
    // Get cruises that either:
    // 1. Have no pricing data
    // 2. Haven't been updated in 24 hours
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    let query = db
      .select({ id: cruises.id })
      .from(cruises)
      .where(
        and(
          lineId ? eq(cruises.cruiseLineId, lineId) : undefined,
          gte(cruises.sailingDate, new Date().toISOString().split('T')[0]) // Only future cruises
        )
      )
      .limit(100); // Limit to 100 cruises per webhook

    const results = await query;
    return results.map(r => r.id);
  }

  private async discoverFilesWithTimeout(
    lineId: number | undefined,
    cruiseIds: string[]
  ): Promise<WebhookFile[]> {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('FTP discovery timeout after 30 seconds'));
      }, this.FTP_TIMEOUT);

      try {
        const files = await this.discoverFiles(lineId, cruiseIds);
        clearTimeout(timeout);
        resolve(files);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private async discoverFiles(
    lineId: number | undefined,
    cruiseIds: string[]
  ): Promise<WebhookFile[]> {
    const files: WebhookFile[] = [];
    const client = new ftp.Client();
    client.ftp.verbose = false;
    // timeout is configured in access() call

    try {
      // Connect with timeout
      // Use the same config that works in sync script
      const ftpConfig = {
        host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
        user: process.env.TRAVELTEK_FTP_USER || '',
        password: process.env.TRAVELTEK_FTP_PASSWORD || '',
        secure: false,
        timeout: 30000,
        verbose: false,
      };

      await client.access(ftpConfig);

      console.log('[ROBUST] FTP connected successfully');

      // Only scan current month and next 2 months
      const currentDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 2);

      for (let scanDate = new Date(currentDate); scanDate <= endDate; ) {
        const year = scanDate.getFullYear();
        const month = (scanDate.getMonth() + 1).toString().padStart(2, '0');
        const basePath = `/${year}/${month}`;

        try {
          const dayDirs = await client.list(basePath);

          for (const dayDir of dayDirs) {
            if (dayDir.type === 2 && files.length < this.MAX_FILES_PER_WEBHOOK) {
              const dayPath = `${basePath}/${dayDir.name}`;

              try {
                const dayFiles = await client.list(dayPath);

                for (const file of dayFiles) {
                  if (file.type === 1 && file.name.endsWith('.jsonl')) {
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

                        if (files.length >= this.MAX_FILES_PER_WEBHOOK) {
                          break;
                        }
                      }
                    }
                  }
                }
              } catch (error) {
                console.log(`[ROBUST] Could not list ${dayPath}`);
              }
            }
          }
        } catch (error) {
          console.log(`[ROBUST] No data for ${basePath}`);
        }

        // Move to next month
        scanDate.setMonth(scanDate.getMonth() + 1);
      }

      console.log(`[ROBUST] Found ${files.length} files`);
    } catch (error) {
      console.error('[ROBUST] FTP error:', error);
      throw error;
    } finally {
      client.close();
    }

    return files;
  }

  private async processFilesInBatches(files: WebhookFile[]) {
    // Process files in small batches to avoid overwhelming the system
    const batchSize = 5;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      console.log(`[ROBUST] Processing batch ${i / batchSize + 1} (${batch.length} files)`);

      await Promise.all(batch.map(file => this.processFileSafely(file)));

      // Small delay between batches
      if (i + batchSize < files.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async processFileSafely(file: WebhookFile) {
    try {
      await this.processFile(file);
      this.stats.filesProcessed++;
    } catch (error) {
      console.error(`[ROBUST] Failed to process ${file.path}:`, error);
      this.stats.filesFailed++;
      this.stats.errors.push(
        `${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async processFile(file: WebhookFile) {
    const client = new ftp.Client();
    client.ftp.verbose = false;

    try {
      // Connect to FTP - using the config that works in sync script
      const ftpConfig = {
        host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
        user: process.env.TRAVELTEK_FTP_USER || '',
        password: process.env.TRAVELTEK_FTP_PASSWORD || '',
        secure: false,
        timeout: 30000,
        verbose: false,
      };

      await client.access(ftpConfig);

      // Download file
      const tempFile = `/tmp/webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jsonl`;
      await client.downloadTo(tempFile, file.path);

      // Read and process file
      const content = await fs.readFile(tempFile, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      let cruisesProcessed = 0;
      let pricesProcessed = 0;

      for (const line of lines) {
        try {
          const data = JSON.parse(line);

          // Process cruise data
          if (data.id && data.name) {
            await this.updateCruise(data);
            cruisesProcessed++;
          }

          // Process pricing data
          if (data.pricing) {
            await this.updatePricing(data.pricing);
            pricesProcessed++;
          }
        } catch (error) {
          console.error(`[ROBUST] Error processing line in ${file.path}`);
        }
      }

      this.stats.cruisesUpdated += cruisesProcessed;
      this.stats.pricesUpdated += pricesProcessed;

      // Clean up temp file
      await fs.unlink(tempFile).catch(() => {});

      console.log(
        `[ROBUST] Processed ${file.path}: ${cruisesProcessed} cruises, ${pricesProcessed} prices`
      );
    } catch (error) {
      throw error;
    } finally {
      client.close();
    }
  }

  private async updateCruise(cruiseData: any) {
    try {
      // Update or insert cruise
      await db
        .insert(cruises)
        .values({
          id: cruiseData.id,
          name: cruiseData.name || 'Unknown',
          cruiseLineId: cruiseData.lineId || 0,
          shipId: cruiseData.shipId || 0,
          nights: cruiseData.nights || 0,
          sailingDate: cruiseData.sailingDate || new Date(),
          embarkationPortId: cruiseData.embarkationPortId || 0,
          disembarkationPortId: cruiseData.disembarkationPortId || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: cruises.id,
          set: {
            name: cruiseData.name,
            nights: cruiseData.nights,
            sailingDate: cruiseData.sailingDate,
            updatedAt: new Date(),
          },
        });
    } catch (error) {
      console.error(`[ROBUST] Failed to update cruise ${cruiseData.id}`);
    }
  }

  private async updatePricing(pricingData: any) {
    try {
      if (!pricingData.cruiseId || !pricingData.price) return;

      await db
        .insert(pricing)
        .values({
          cruiseId: pricingData.cruiseId,
          cabinCode: pricingData.cabinCode || 'DEFAULT',
          rateCode: pricingData.rateCode || 'STANDARD',
          basePrice: pricingData.price,
          taxes: pricingData.taxes || 0,
          totalPrice: pricingData.totalPrice || pricingData.price,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [pricing.cruiseId, pricing.cabinCode],
          set: {
            basePrice: pricingData.price,
            taxes: pricingData.taxes || 0,
            totalPrice: pricingData.totalPrice || pricingData.price,
            updatedAt: new Date(),
          },
        });
    } catch (error) {
      console.error(`[ROBUST] Failed to update pricing for cruise ${pricingData.cruiseId}`);
    }
  }

  private async generateReport() {
    this.stats.endTime = new Date();
    const duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();
    const durationMinutes = Math.floor(duration / 60000);
    const durationSeconds = Math.floor((duration % 60000) / 1000);

    await this.sendSlackNotification({
      text:
        this.stats.filesFailed > 0
          ? '⚠️ Webhook processing completed with errors'
          : '✅ Webhook processing completed',
      fields: [
        { title: 'Duration', value: `${durationMinutes}m ${durationSeconds}s`, short: true },
        {
          title: 'Files Processed',
          value: `${this.stats.filesProcessed}/${this.stats.filesDiscovered}`,
          short: true,
        },
        { title: 'Cruises Updated', value: this.stats.cruisesUpdated.toString(), short: true },
        { title: 'Prices Updated', value: this.stats.pricesUpdated.toString(), short: true },
        { title: 'Errors', value: this.stats.errors.length.toString(), short: true },
        {
          title: 'Status',
          value: this.stats.filesFailed > 0 ? 'Partial Success' : 'Success',
          short: true,
        },
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

  private async sendSlackNotification(notification: any) {
    try {
      await slackService.sendNotification(notification);
    } catch (error) {
      console.error('[ROBUST] Failed to send Slack notification');
    }
  }

  private async sendSlackError(message: string, error: Error) {
    try {
      await slackService.sendError(message, error);
    } catch (error) {
      console.error('[ROBUST] Failed to send Slack error');
    }
  }

  private async cleanup() {
    try {
      if (this.processingWorker) {
        await this.processingWorker.close();
      }
      await this.fileQueue.close();
      await this.queueEvents.close();
      await this.redis.quit();
    } catch (error) {
      console.error('[ROBUST] Cleanup error:', error);
    }
  }
}
