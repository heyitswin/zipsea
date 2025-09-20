import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import * as ftp from 'basic-ftp';
import { db } from '../db/connection';
import { cruises } from '../db/schema/cruises';
import { eq } from 'drizzle-orm';
import logger from '../config/logger';
import { Writable } from 'stream';
import { env } from '../config/environment';

// Configuration
const QUEUE_CONFIG = {
  FILES_PER_JOB: 5, // Process only 5 files per job to avoid timeouts
  MAX_CONCURRENT_JOBS: 3, // Process 3 jobs concurrently
  JOB_TIMEOUT: 30000, // 30 seconds per job
  STALLED_INTERVAL: 30000,
  MAX_MONTHS_AHEAD: 2, // Only scan 2 months ahead for faster discovery
};

// Redis connection for BullMQ
const redisConnection = new Redis(env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Create queue
export const webhookQueue = new Queue('webhook-processing', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 100, // Keep maximum 100 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Queue events for monitoring
const queueEvents = new QueueEvents('webhook-processing', {
  connection: redisConnection,
});

// FTP Connection Pool
class FtpConnectionPool {
  private pool: Array<{ client: ftp.Client; inUse: boolean; lastUsed: number }> = [];
  private initialized = false;

  async initialize() {
    if (this.initialized) return;

    console.log('[QUEUE] Initializing FTP connection pool...');
    const ftpConfig = {
      host: env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: env.TRAVELTEK_FTP_USER,
      password: env.TRAVELTEK_FTP_PASSWORD,
      secure: false,
      timeout: 20000,
    };

    // Create 3 connections
    for (let i = 0; i < 3; i++) {
      const client = new ftp.Client();
      client.ftp.verbose = false;
      try {
        await client.access(ftpConfig);
        this.pool.push({ client, inUse: false, lastUsed: Date.now() });
        console.log(`[QUEUE] FTP connection ${i + 1} established`);
      } catch (error) {
        console.error(`[QUEUE] Failed to create FTP connection ${i + 1}:`, error);
      }
    }

    this.initialized = true;
  }

  async getConnection() {
    await this.initialize();

    // Find available connection
    let conn = this.pool.find(c => !c.inUse);
    if (conn) {
      conn.inUse = true;
      conn.lastUsed = Date.now();
      return conn.client;
    }

    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.getConnection();
  }

  releaseConnection(client: ftp.Client) {
    const conn = this.pool.find(c => c.client === client);
    if (conn) {
      conn.inUse = false;
      conn.lastUsed = Date.now();
    }
  }
}

const ftpPool = new FtpConnectionPool();

// Worker to process jobs
export const webhookWorker = new Worker(
  'webhook-processing',
  async (job: Job) => {
    const { lineId, files, batchNumber, totalBatches } = job.data;

    console.log(
      `[WORKER] Processing batch ${batchNumber}/${totalBatches} for line ${lineId} with ${files.length} files`
    );

    const results = {
      processed: 0,
      failed: 0,
      cruisesUpdated: 0,
    };

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Update job progress
      await job.updateProgress((i / files.length) * 100);

      try {
        await processFile(file);
        results.processed++;
        results.cruisesUpdated++;
      } catch (error) {
        console.error(`[WORKER] Failed to process ${file.path}:`, error);
        results.failed++;
      }
    }

    console.log(
      `[WORKER] Batch ${batchNumber} completed: ${results.processed} processed, ${results.failed} failed`
    );
    return results;
  },
  {
    connection: redisConnection,
    concurrency: QUEUE_CONFIG.MAX_CONCURRENT_JOBS,
    stalledInterval: QUEUE_CONFIG.STALLED_INTERVAL,
  }
);

// Process a single file
async function processFile(file: any): Promise<void> {
  const client = await ftpPool.getConnection();

  try {
    // Download file to memory
    const chunks: Buffer[] = [];
    const writeStream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    await client.downloadTo(writeStream, file.path);

    if (chunks.length === 0) {
      console.log(`[WORKER] Empty file: ${file.path}`);
      return;
    }

    const data = JSON.parse(Buffer.concat(chunks).toString());
    const cruiseId = data.id || data.codetocruiseid || file.cruiseId;

    if (!cruiseId) {
      console.log(`[WORKER] No cruise ID found in ${file.path}`);
      return;
    }

    // Extract sailing date
    let sailingDate = data.embarkDate || data.embarkdate || data.sailingdate || data.sailing_date;
    if (sailingDate && sailingDate.includes('T')) {
      sailingDate = sailingDate.split('T')[0];
    }

    // Prepare cruise data
    const cruiseData = {
      id: cruiseId,
      cruiseId: data.cruiseid || data.cruise_id,
      name: data.name || data.title || data.cruisename || 'Unknown Cruise',
      cruiseLineId: file.lineId,
      shipId: file.shipId || data.shipid || 0,
      nights: parseInt(data.nights || data.duration || 0),
      sailingDate: sailingDate || new Date().toISOString().split('T')[0],
      embarkPortId: data.embarkportid || data.embarkation_port_id || 0,
      disembarkPortId: data.disembarkportid || data.disembarkation_port_id || 0,
      rawData: data,
      updatedAt: new Date(),
    };

    // Upsert cruise
    await db
      .insert(cruises)
      .values(cruiseData)
      .onConflictDoUpdate({
        target: cruises.id,
        set: {
          name: cruiseData.name,
          nights: cruiseData.nights,
          sailingDate: cruiseData.sailingDate,
          rawData: cruiseData.rawData,
          updatedAt: new Date(),
        },
      });

    console.log(`[WORKER] Updated cruise ${cruiseId}`);

    // Update pricing if available
    await updatePricing(cruiseId, data);
  } finally {
    ftpPool.releaseConnection(client);
  }
}

// Update pricing data
async function updatePricing(cruiseId: string, data: any): Promise<void> {
  try {
    const pricingData = data.prices || data.pricing || data.cabins || data.categories;

    if (!pricingData) {
      return;
    }

    let interiorPrice = null;
    let oceanviewPrice = null;
    let balconyPrice = null;
    let suitePrice = null;

    if (Array.isArray(pricingData)) {
      for (const cabin of pricingData) {
        const price = parseFloat(
          cabin.price ||
            cabin.adult_price ||
            cabin.adultprice ||
            cabin.cheapest_price ||
            cabin.from_price ||
            0
        );

        if (!price || price === 0) continue;

        const category = (
          cabin.category ||
          cabin.cabin_type ||
          cabin.cabintype ||
          cabin.type ||
          ''
        ).toLowerCase();

        if (category.includes('interior') || category.includes('inside')) {
          if (!interiorPrice || price < interiorPrice) {
            interiorPrice = price;
          }
        } else if (category.includes('ocean') || category.includes('outside')) {
          if (!oceanviewPrice || price < oceanviewPrice) {
            oceanviewPrice = price;
          }
        } else if (category.includes('balcony') || category.includes('verandah')) {
          if (!balconyPrice || price < balconyPrice) {
            balconyPrice = price;
          }
        } else if (category.includes('suite') || category.includes('penthouse')) {
          if (!suitePrice || price < suitePrice) {
            suitePrice = price;
          }
        }
      }
    }

    if (interiorPrice || oceanviewPrice || balconyPrice || suitePrice) {
      await db
        .update(cruises)
        .set({
          interiorPrice: interiorPrice?.toString(),
          oceanviewPrice: oceanviewPrice?.toString(),
          balconyPrice: balconyPrice?.toString(),
          suitePrice: suitePrice?.toString(),
          updatedAt: new Date(),
        })
        .where(eq(cruises.id, cruiseId));

      console.log(`[WORKER] Updated pricing for cruise ${cruiseId}`);
    }
  } catch (error) {
    console.error(`[WORKER] Failed to update pricing for ${cruiseId}:`, error);
  }
}

// Main webhook processor class
export class WebhookQueueProcessor {
  async processWebhook(lineId: number): Promise<{ jobIds: string[] }> {
    console.log(`[QUEUE] Starting webhook processing for line ${lineId}`);

    try {
      // Discover files
      const files = await this.discoverFiles(lineId);
      console.log(`[QUEUE] Found ${files.length} files for line ${lineId}`);

      if (files.length === 0) {
        console.log(`[QUEUE] No files to process for line ${lineId}`);
        return { jobIds: [] };
      }

      // Split files into batches
      const batches: any[][] = [];
      for (let i = 0; i < files.length; i += QUEUE_CONFIG.FILES_PER_JOB) {
        batches.push(files.slice(i, i + QUEUE_CONFIG.FILES_PER_JOB));
      }

      console.log(`[QUEUE] Creating ${batches.length} jobs for line ${lineId}`);

      // Create jobs for each batch
      const jobIds: string[] = [];
      for (let i = 0; i < batches.length; i++) {
        const job = await webhookQueue.add(
          `process-line-${lineId}-batch-${i + 1}`,
          {
            lineId,
            files: batches[i],
            batchNumber: i + 1,
            totalBatches: batches.length,
          },
          {
            priority: batches.length - i, // Process earlier batches first
            delay: i * 1000, // Stagger job starts by 1 second
          }
        );
        jobIds.push(job.id!);
        console.log(`[QUEUE] Created job ${job.id} for batch ${i + 1}/${batches.length}`);
      }

      return { jobIds };
    } catch (error) {
      console.error('[QUEUE] Failed to process webhook:', error);
      throw error;
    }
  }

  private async discoverFiles(lineId: number): Promise<any[]> {
    const client = await ftpPool.getConnection();
    const files: any[] = [];

    try {
      const now = new Date();

      // Only check current month and next N months
      for (let monthOffset = 0; monthOffset < QUEUE_CONFIG.MAX_MONTHS_AHEAD; monthOffset++) {
        const checkDate = new Date(now);
        checkDate.setMonth(checkDate.getMonth() + monthOffset);

        const year = checkDate.getFullYear();
        const month = (checkDate.getMonth() + 1).toString().padStart(2, '0');
        const linePath = `/${year}/${month}/${lineId}`;

        try {
          const shipDirs = await client.list(linePath);

          for (const shipDir of shipDirs) {
            if (shipDir.type === 2) {
              // Directory
              const shipPath = `${linePath}/${shipDir.name}`;
              const cruiseFiles = await client.list(shipPath);

              for (const file of cruiseFiles) {
                if (file.type === 1 && file.name.endsWith('.json')) {
                  files.push({
                    path: `${shipPath}/${file.name}`,
                    name: file.name,
                    lineId: lineId,
                    shipId: parseInt(shipDir.name) || 0,
                    cruiseId: file.name.replace('.json', ''),
                    size: file.size,
                  });
                }
              }
            }
          }

          console.log(`[QUEUE] Found ${files.length} files in ${linePath}`);
        } catch (error) {
          // No data for this month, continue
        }
      }
    } finally {
      ftpPool.releaseConnection(client);
    }

    return files;
  }

  async getQueueStatus(): Promise<any> {
    const [waiting, active, completed, failed] = await Promise.all([
      webhookQueue.getWaitingCount(),
      webhookQueue.getActiveCount(),
      webhookQueue.getCompletedCount(),
      webhookQueue.getFailedCount(),
    ]);

    const jobs = await webhookQueue.getJobs(['active', 'waiting'], 0, 10);

    return {
      waiting,
      active,
      completed,
      failed,
      recentJobs: jobs.map(job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        createdAt: new Date(job.timestamp),
      })),
    };
  }

  async clearQueue(): Promise<void> {
    await webhookQueue.obliterate({ force: true });
    console.log('[QUEUE] Queue cleared');
  }
}

// Export singleton instance
export const webhookQueueProcessor = new WebhookQueueProcessor();

// Monitor queue events
queueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`[QUEUE] Job ${jobId} completed:`, returnvalue);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`[QUEUE] Job ${jobId} failed:`, failedReason);
});

queueEvents.on('progress', ({ jobId, data }) => {
  console.log(`[QUEUE] Job ${jobId} progress: ${data}%`);
});
