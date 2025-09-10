import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import * as path from 'path';
import { db } from '../db/connection';
import { webhookEvents, systemFlags, priceSnapshots, syncLocks } from '../db/schema/webhook-events';
import { cruises, pricing, cheapestPricing } from '../db/schema';
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
    let lock: any = null;

    try {
      console.log(`[OPTIMIZED] Starting webhook processing for line ${lineId || 'all'} - v2`);

      await slackService.sendNotification({
        text: '🚀 Starting optimized webhook processing',
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

      let canProceed = true;

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
                  if (file.type === 1 && file.name.endsWith('.json')) {
                    // For Traveltek, line ID is the directory name (e.g., /2025/09/54/shipid/cruise.json)
                    // dayDir.name is the line ID
                    const fileLineId = parseInt(dayDir.name);
                    if (!lineId || fileLineId === lineId || isNaN(fileLineId)) {
                      files.push({
                        path: `${dayPath}/${file.name}`,
                        size: file.size,
                        modifiedAt: file.modifiedAt || new Date(),
                        lineId: fileLineId || 0,
                      });
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
            eq(webhookEvents.webhookType, 'file_processed'),
            eq(webhookEvents.metadata, sql`${file.path}`)
          )
        )
        .limit(1);

      if (existingEvent.length > 0) {
        this.stats.filesSkipped++;
        return;
      }

      // Download and parse file
      const tempFile = `/tmp/webhook-${Date.now()}.json`;
      await conn.client.downloadTo(tempFile, file.path);
      const fs = await import('fs');
      const content = await fs.promises.readFile(tempFile, 'utf-8');
      await fs.promises.unlink(tempFile);

      let cruisesProcessed = 0;
      let pricesProcessed = 0;

      // Take snapshot before processing
      await this.takeSnapshot(file.lineId);

      try {
        // Traveltek files are single JSON objects, not JSONL
        const data = JSON.parse(content);

        // Check if this is a Traveltek cruise object
        if (data.codetocruiseid || data.cruise_id) {
          await this.updateCruise(data);
          cruisesProcessed++;

          // Extract and update detailed pricing from the same object
          // Traveltek stores pricing in cheapest.prices, not prices directly
          const pricingData = data.prices || (data.cheapest && data.cheapest.prices);
          if (pricingData) {
            await this.updateDetailedPricing(data.codetocruiseid || data.cruise_id, pricingData);
            pricesProcessed++;
          }
        } else if (data.cruise) {
          // Legacy format support - if data has a cruise property
          await this.updateCruise(data.cruise);
          cruisesProcessed++;
        }

        if (data.pricing) {
          // Legacy format support - if data has a pricing property
          await this.updatePricing(data.pricing);
          pricesProcessed++;
        }
      } catch (error) {
        console.error(`Error processing JSON in ${file.path}:`, error);
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
    // Take snapshots of cheapest pricing for all cruises in this line
    const cruisesWithPricing = await db
      .select({
        cruiseId: cruises.id,
        cheapestPrice: cheapestPricing.cheapestPrice,
        interiorPrice: cheapestPricing.interiorPrice,
        oceanviewPrice: cheapestPricing.oceanviewPrice,
        balconyPrice: cheapestPricing.balconyPrice,
        suitePrice: cheapestPricing.suitePrice,
      })
      .from(cruises)
      .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
      .where(eq(cruises.cruiseLineId, lineId))
      .limit(1000);

    // Create snapshots for each cruise
    for (const cruise of cruisesWithPricing) {
      if (cruise.cruiseId && cruise.cheapestPrice) {
        try {
          await db.insert(priceSnapshots).values({
            cruiseId: cruise.cruiseId,
            snapshotData: {
              cheapestPrice: cruise.cheapestPrice,
              interiorPrice: cruise.interiorPrice,
              oceanviewPrice: cruise.oceanviewPrice,
              balconyPrice: cruise.balconyPrice,
              suitePrice: cruise.suitePrice,
              timestamp: new Date().toISOString(),
              lineId: lineId,
            },
            createdAt: new Date(),
          });
        } catch (error) {
          console.error(`Failed to create snapshot for cruise ${cruise.cruiseId}:`, error);
        }
      }
    }
  }

  private async getCurrentPrices(lineId: number) {
    // This method is no longer used
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

  private async updateDetailedPricing(cruiseId: string, pricesData: any) {
    // Process detailed cabin pricing from Traveltek structure
    // pricesData format: { rateCode: { cabinCode: { price, taxes, etc } } }

    let pricingRecordsInserted = 0;
    let pricingRecordsUpdated = 0;

    for (const rateCode in pricesData) {
      const cabins = pricesData[rateCode];

      for (const cabinCode in cabins) {
        const cabinData = cabins[cabinCode];

        // Skip if no price data
        if (!cabinData.price && !cabinData.adultprice) continue;

        // Determine cabin type based on cabin code or type
        const cabinType = (cabinData.cabintype || cabinCode).toLowerCase();
        let standardCabinType = 'unknown';

        if (cabinType.includes('inside') || cabinType.includes('interior')) {
          standardCabinType = 'interior';
        } else if (cabinType.includes('outside') || cabinType.includes('ocean')) {
          standardCabinType = 'oceanview';
        } else if (cabinType.includes('balcony')) {
          standardCabinType = 'balcony';
        } else if (cabinType.includes('suite')) {
          standardCabinType = 'suite';
        }

        const pricingRecord = {
          cruiseId: cruiseId,
          rateCode: rateCode,
          cabinCode: cabinCode,
          occupancyCode: '101', // Standard 2-adult occupancy
          cabinType: standardCabinType,
          basePrice: this.parsePrice(cabinData.price),
          adultPrice: this.parsePrice(cabinData.adultprice),
          childPrice: this.parsePrice(cabinData.childprice),
          infantPrice: this.parsePrice(cabinData.infantprice),
          singlePrice: this.parsePrice(cabinData.singleprice),
          thirdAdultPrice: this.parsePrice(cabinData.thirdadultprice),
          fourthAdultPrice: this.parsePrice(cabinData.fourthadultprice),
          taxes: this.parsePrice(cabinData.taxes),
          ncf: this.parsePrice(cabinData.ncf),
          gratuity: this.parsePrice(cabinData.gratuity),
          fuel: this.parsePrice(cabinData.fuel),
          nonComm: this.parsePrice(cabinData.noncomm),
          totalPrice: this.parsePrice(cabinData.price) + this.parsePrice(cabinData.taxes),
          isAvailable: true,
          currency: 'USD',
          updatedAt: new Date(),
        };

        try {
          // Try to insert, if it exists then update
          const existingPricing = await db
            .select()
            .from(pricing)
            .where(
              and(
                eq(pricing.cruiseId, cruiseId),
                eq(pricing.rateCode, rateCode),
                eq(pricing.cabinCode, cabinCode)
              )
            )
            .limit(1);

          if (existingPricing.length > 0) {
            await db
              .update(pricing)
              .set(pricingRecord)
              .where(eq(pricing.id, existingPricing[0].id));
            pricingRecordsUpdated++;
          } else {
            await db.insert(pricing).values(pricingRecord);
            pricingRecordsInserted++;
          }
        } catch (error) {
          console.error(
            `Failed to update pricing for ${cruiseId}/${rateCode}/${cabinCode}:`,
            error
          );
        }
      }
    }

    if (pricingRecordsInserted > 0 || pricingRecordsUpdated > 0) {
      console.log(
        `[PRICING] Cruise ${cruiseId}: inserted ${pricingRecordsInserted}, updated ${pricingRecordsUpdated} pricing records`
      );
    }
  }

  private parsePrice(value: any): number {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      return parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
    }
    return 0;
  }

  private async updatePricing(pricingData: any) {
    // Legacy pricing update method
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

// Removed global instantiation - use lazy loading in routes instead
