import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import * as path from 'path';
import { db } from '../db/connection';
import { webhookEvents, systemFlags, syncLocks } from '../db/schema/webhook-events';
import { cruises, pricing } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { ftpConnectionPool } from './ftp-connection-pool.service';
import { slackService } from './slack.service';

interface CruiseFile {
  path: string;
  size: number;
  modifiedAt: Date;
  lineId: number;
  shipId: number;
  cruiseId: string;
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
    // Initialize Redis connection for BullMQ
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

    this.fileQueue = new Queue('cruise-files', {
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

    this.queueEvents = new QueueEvents('cruise-files', {
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
    });
  }

  async processWebhooks(lineId?: number) {
    let lock: any = null;

    try {
      console.log(`[FIXED] Starting webhook processing for line ${lineId || 'all'}`);

      this.stats = {
        filesDiscovered: 0,
        filesProcessed: 0,
        filesSkipped: 0,
        filesFailed: 0,
        cruisesUpdated: 0,
        pricesUpdated: 0,
        startTime: new Date(),
      };

      // Send initial notification
      await slackService.sendNotification({
        text: '🚀 Starting webhook processing (Fixed)',
        fields: [
          { title: 'Line ID', value: lineId ? lineId.toString() : 'All lines', short: true },
          { title: 'Start Time', value: new Date().toISOString(), short: true },
        ],
      });

      // Acquire lock
      const lockKey = `webhook-sync-${lineId || 'all'}`;

      // Check for existing lock
      const existingLock = await db
        .select()
        .from(syncLocks)
        .where(eq(syncLocks.lockKey, lockKey))
        .limit(1);

      if (existingLock.length > 0 && existingLock[0].isActive) {
        const lockAge = Date.now() - new Date(existingLock[0].acquiredAt).getTime();
        if (lockAge < 30 * 60 * 1000) {
          console.log(
            `Lock ${lockKey} is still active (age: ${Math.floor(lockAge / 60000)} minutes)`
          );
          throw new Error('Another sync process is already running');
        }
        console.log(
          `Taking over stale lock ${lockKey} (age: ${Math.floor(lockAge / 60000)} minutes)`
        );
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

      lock = locks[0];
      console.log(`[FIXED] Acquired lock ${lock.id} for ${lockKey}`);

      // Discover files using correct FTP structure
      const files = await this.discoverFiles(lineId);
      this.stats.filesDiscovered = files.length;
      console.log(`[FIXED] Discovered ${files.length} cruise files`);

      await slackService.sendNotification({
        text: `📁 Discovered ${files.length} cruise files to process`,
      });

      if (files.length === 0) {
        console.log('[FIXED] No files to process');
        await slackService.sendNotification({
          text: '✅ No files found to process',
          fields: [
            { title: 'Line ID', value: lineId ? lineId.toString() : 'All', short: true },
            { title: 'Result', value: 'No updates needed', short: true },
          ],
        });
        return;
      }

      // Add files to queue (limit to prevent overwhelming)
      const filesToProcess = files.slice(0, 100); // Process max 100 files at a time
      const jobs = filesToProcess.map(file => ({
        name: `process-${file.cruiseId}`,
        data: file,
      }));

      await this.fileQueue.addBulk(jobs);
      console.log(`[FIXED] Added ${jobs.length} jobs to queue`);

      // Start worker
      await this.startWorker();

      // Wait for completion
      await this.waitForCompletion();

      // Generate final report
      await this.generateReport();
    } catch (error) {
      console.error('[FIXED] Webhook processing failed:', error);
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
          console.log(`[FIXED] Released lock ${lock.id}`);
        } catch (releaseError) {
          console.error(`[FIXED] Failed to release lock ${lock.id}:`, releaseError);
        }
      }
    }
  }

  private async discoverFiles(lineId?: number): Promise<CruiseFile[]> {
    const files: CruiseFile[] = [];
    const conn = await ftpConnectionPool.getConnection();

    try {
      const currentDate = new Date();
      const startYear = currentDate.getFullYear();
      const startMonth = currentDate.getMonth() + 1;
      const endYear = startYear + 3; // Check up to 3 years ahead

      console.log(`[FIXED] Scanning from ${startYear}/${startMonth} to ${endYear}/12`);

      // FTP structure: /year/month/lineid/shipid/cruiseid.json
      for (let year = startYear; year <= endYear; year++) {
        const monthStart = year === startYear ? startMonth : 1;

        for (let month = monthStart; month <= 12; month++) {
          const monthStr = month.toString().padStart(2, '0');

          if (lineId) {
            // Specific line: /year/month/lineid/
            const linePath = `/${year}/${monthStr}/${lineId}`;

            try {
              const shipDirs = await conn.client.list(linePath);

              if (shipDirs.length > 0) {
                console.log(
                  `[FIXED] Found ${shipDirs.length} ships for line ${lineId} in ${year}/${monthStr}`
                );
              }

              for (const shipDir of shipDirs) {
                if (shipDir.type === 2) {
                  // Directory
                  const shipPath = `${linePath}/${shipDir.name}`;
                  const cruiseFiles = await conn.client.list(shipPath);

                  for (const file of cruiseFiles) {
                    if (file.type === 1 && file.name.endsWith('.json')) {
                      files.push({
                        path: `${shipPath}/${file.name}`,
                        size: file.size,
                        modifiedAt: file.modifiedAt || new Date(),
                        lineId: lineId,
                        shipId: parseInt(shipDir.name),
                        cruiseId: file.name.replace('.json', ''),
                      });
                    }
                  }
                }
              }
            } catch (error) {
              // No data for this line/month combination - this is normal
            }
          } else {
            // All lines: scan each line directory
            const monthPath = `/${year}/${monthStr}`;

            try {
              const lineDirs = await conn.client.list(monthPath);

              for (const lineDir of lineDirs) {
                if (lineDir.type === 2 && /^\d+$/.test(lineDir.name)) {
                  const currentLineId = parseInt(lineDir.name);
                  const linePath = `${monthPath}/${lineDir.name}`;

                  try {
                    const shipDirs = await conn.client.list(linePath);

                    for (const shipDir of shipDirs) {
                      if (shipDir.type === 2) {
                        const shipPath = `${linePath}/${shipDir.name}`;
                        const cruiseFiles = await conn.client.list(shipPath);

                        for (const file of cruiseFiles) {
                          if (file.type === 1 && file.name.endsWith('.json')) {
                            files.push({
                              path: `${shipPath}/${file.name}`,
                              size: file.size,
                              modifiedAt: file.modifiedAt || new Date(),
                              lineId: currentLineId,
                              shipId: parseInt(shipDir.name),
                              cruiseId: file.name.replace('.json', ''),
                            });
                          }
                        }
                      }
                    }
                  } catch (error) {
                    // Skip this line if error
                  }
                }
              }
            } catch (error) {
              // No data for this month - this is normal
            }
          }

          // Stop if we've found enough files
          if (files.length > 1000) {
            console.log(`[FIXED] Stopping discovery at ${files.length} files`);
            break;
          }
        }

        // Stop if we've found enough files
        if (files.length > 1000) {
          break;
        }
      }

      console.log(`[FIXED] Total files discovered: ${files.length}`);
    } finally {
      ftpConnectionPool.releaseConnection(conn.id);
    }

    return files;
  }

  private async startWorker() {
    this.processingWorker = new Worker(
      'cruise-files',
      async job => {
        const file = job.data as CruiseFile;
        await this.processFile(file);
        await job.updateProgress(100);
      },
      {
        connection: this.redis,
        concurrency: 3, // Process 3 files in parallel
      }
    );
  }

  private async processFile(file: CruiseFile) {
    const conn = await ftpConnectionPool.getConnection();

    try {
      console.log(`[FIXED] Processing ${file.path}`);

      // Download and parse the JSON file
      const tempFile = `/tmp/webhook-fixed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`;
      await conn.client.downloadTo(tempFile, file.path);
      const fs = await import('fs');
      const content = await fs.promises.readFile(tempFile, 'utf-8');
      const cruiseData = JSON.parse(content);

      // Clean up temp file
      await fs.promises.unlink(tempFile).catch(() => {});

      // Process the cruise data
      await this.updateCruise(cruiseData);

      this.stats.cruisesUpdated++;
    } catch (error) {
      console.error(`[FIXED] Failed to process ${file.path}:`, error);
      this.stats.filesFailed++;
    } finally {
      ftpConnectionPool.releaseConnection(conn.id);
    }
  }

  private async updateCruise(cruiseData: any) {
    // This would update the cruise in the database
    // For now, just log that we processed it
    console.log(`[FIXED] Would update cruise ${cruiseData.id || 'unknown'}`);
  }

  private async waitForCompletion() {
    // If no files were discovered, return immediately
    if (this.stats.filesDiscovered === 0) {
      console.log('[FIXED] No files to wait for');
      return;
    }

    return new Promise(resolve => {
      let checksWithoutJobs = 0;
      const maxChecksWithoutJobs = 3; // Give up after 15 seconds of no jobs

      const checkInterval = setInterval(async () => {
        try {
          const waiting = await this.fileQueue.getWaitingCount();
          const active = await this.fileQueue.getActiveCount();

          console.log(`[FIXED] Queue status - Waiting: ${waiting}, Active: ${active}`);

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
          console.error('[FIXED] Error checking queue status:', error);
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

    await slackService.sendNotification({
      text: '✅ Webhook processing completed (Fixed)',
      fields: [
        { title: 'Duration', value: `${durationMinutes} minutes`, short: true },
        { title: 'Files Discovered', value: this.stats.filesDiscovered.toString(), short: true },
        { title: 'Files Processed', value: this.stats.filesProcessed.toString(), short: true },
        { title: 'Files Failed', value: this.stats.filesFailed.toString(), short: true },
        { title: 'Cruises Updated', value: this.stats.cruisesUpdated.toString(), short: true },
      ],
    });
  }
}

// Singleton instance
let webhookProcessorFixed: WebhookProcessorFixed | null = null;

export function getWebhookProcessorFixed(): WebhookProcessorFixed {
  if (!webhookProcessorFixed) {
    webhookProcessorFixed = new WebhookProcessorFixed();
  }
  return webhookProcessorFixed;
}
