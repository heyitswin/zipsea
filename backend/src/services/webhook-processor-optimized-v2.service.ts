import { env } from '../config/environment'; // Load environment variables first
import * as ftp from 'basic-ftp';
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { db } from '../db/connection';
import { cruises } from '../db/schema/cruises';
import { ships } from '../db/schema/ships';
import { cheapestPricing } from '../db/schema';
import { priceSnapshots } from '../db/schema/webhook-events';
import { eq, sql } from 'drizzle-orm';
import logger from '../config/logger';
import { Writable } from 'stream';
import {
  processNCLPricingData,
  extractNCLAdultPrice,
  getNCLCheapestPrice,
} from '../utils/ncl-pricing-fix';
import { slackService, WebhookProcessingResult } from './slack.service';
import { WebhookStatsTracker } from './webhook-stats-tracker';
import * as crypto from 'crypto';
import { priceHistoryService } from './price-history.service';

interface FtpConnection {
  client: ftp.Client;
  inUse: boolean;
  lastUsed: number;
}

export class WebhookProcessorOptimizedV2 {
  private static ftpPool: FtpConnection[] = [];
  private static poolInitialized = false;
  private static MAX_CONNECTIONS = 3; // Reduced to prevent FTP server connection limits
  private static KEEP_ALIVE_INTERVAL = 30000;
  private static processorInstance: WebhookProcessorOptimizedV2 | null = null;

  // BullMQ configuration
  private static webhookQueue: Queue | null = null;
  private static webhookWorker: Worker | null = null;
  private static redisConnection: Redis | null = null;
  private static statsTracker: WebhookStatsTracker | null = null;

  // Performance optimization caches
  private static shipCache: Map<number, boolean> = new Map();
  private static checksumCache: Map<string, string> = new Map(); // cruiseId -> checksum

  private stats = {
    filesProcessed: 0,
    cruisesUpdated: 0,
    skippedUnchanged: 0,
    errors: [] as string[],
    priceSnapshotsCreated: 0,
    changeLog: [] as Array<{
      cruiseId: string;
      changes: string[];
      timestamp: Date;
    }>,
  };

  private processingJobs = new Map<
    string, // Changed to string to include run ID
    {
      lineId: number;
      startTime: Date;
      totalFiles: number;
      processedFiles: number;
      successful: number;
      failed: number;
      errors: Array<{ filePath?: string; error: string }>;
      completedBatches: Set<number>; // Track which batches have completed
      totalBatches: number; // Track total expected batches
    }
  >();

  constructor() {
    this.initializeFtpPool();
    this.initializeQueue();
  }

  private async initializeQueue() {
    // Only initialize once
    if (WebhookProcessorOptimizedV2.webhookQueue) {
      return;
    }

    // Skip Redis initialization if REDIS_URL is not configured
    if (!env.REDIS_URL) {
      console.log('[OPTIMIZED-V2] Redis URL not configured - webhook processing disabled');
      return;
    }

    // Create Redis connection for BullMQ with retry logic
    const redisUrl = env.REDIS_URL;
    WebhookProcessorOptimizedV2.redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: times => {
        const delay = Math.min(times * 100, 3000);
        console.log(`[OPTIMIZED-V2] Redis retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      reconnectOnError: err => {
        const targetErrors = ['READONLY', 'LOADING'];
        if (targetErrors.some(e => err.message.includes(e))) {
          console.log('[OPTIMIZED-V2] Redis is loading, will retry connection');
          return true;
        }
        return false;
      },
    });

    // Initialize stats tracker
    WebhookProcessorOptimizedV2.statsTracker = new WebhookStatsTracker(redisUrl);

    // Create the queue for webhook processing
    WebhookProcessorOptimizedV2.webhookQueue = new Queue('webhook-v2-processing', {
      connection: WebhookProcessorOptimizedV2.redisConnection,
      defaultJobOptions: {
        removeOnComplete: { count: 200, age: 7200 }, // Keep more completed jobs with upgraded Redis
        removeOnFail: { count: 100, age: 86400 }, // Keep more failed jobs for debugging
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000, // Faster retry with better Redis performance
        },
      },
    });

    // Create worker to process jobs
    WebhookProcessorOptimizedV2.webhookWorker = new Worker(
      'webhook-v2-processing',
      async (job: Job) => {
        const { lineId, files, batchNumber, totalBatches, runId, webhookEventId } = job.data;
        console.log(
          `[WORKER-V2] Processing job ${job.id} (batch ${batchNumber}/${totalBatches}) for line ${lineId} with ${files.length} files`
        );

        // Process files in batches
        const BATCH_SIZE = 10; // Increased batch size with upgraded Redis
        const results = { processed: 0, failed: 0, updated: 0 };
        const startTime = Date.now();

        for (let i = 0; i < files.length; i += BATCH_SIZE) {
          const batch = files.slice(i, i + BATCH_SIZE);

          // Update job progress with more detail
          const progress = Math.round((i / files.length) * 100);
          await job.updateProgress(progress);

          // Log progress every 10 files
          if (i > 0 && i % 10 === 0) {
            const elapsed = Date.now() - startTime;
            const rate = Math.round((results.processed / elapsed) * 1000 * 60); // files per minute
            console.log(
              `[WORKER-V2] Job ${job.id} progress: ${results.processed}/${files.length} files (${progress}%) - ${rate} files/min`
            );
          }

          // Process batch in parallel - pass runId for global stats tracking
          const batchResults = await Promise.allSettled(
            batch.map(file => WebhookProcessorOptimizedV2.processFileStatic(file, runId))
          );

          // Add a small delay between batches to prevent PostgreSQL page cache exhaustion
          // This allows the database to clear its cache and prevents memory spikes
          if (i + BATCH_SIZE < files.length) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Reduced delay with better Redis
          }

          batchResults.forEach(result => {
            if (result.status === 'fulfilled') {
              results.processed++;
              if (result.value) results.updated++;
            } else {
              results.failed++;
              console.error(`[WORKER-V2] File processing failed:`, result.reason);
            }
          });
        }

        console.log(
          `[WORKER-V2] Job ${job.id} completed: ${results.processed} processed, ${results.updated} updated, ${results.failed} failed`
        );

        // Track completion for Slack notifications
        if (WebhookProcessorOptimizedV2.processorInstance) {
          await WebhookProcessorOptimizedV2.processorInstance.trackBatchCompletion(
            lineId,
            job.data.runId, // Pass the run ID
            results,
            batchNumber,
            totalBatches,
            job.data.totalFilesInRun
          );
        }

        return results;
      },
      {
        connection: WebhookProcessorOptimizedV2.redisConnection!,
        concurrency: 2, // Reduced concurrency to manage memory usage
        stalledInterval: 30000,
      }
    );

    // Track completed batches per webhook event
    const completedBatchesMap = new Map<number, Set<number>>();
    const totalBatchesMap = new Map<number, number>();

    // Set up event listeners
    WebhookProcessorOptimizedV2.webhookWorker.on('completed', async job => {
      console.log(`[QUEUE-V2] Job ${job.id} completed successfully`);

      // Update webhook event status to completed
      const { webhookEventId, batchNumber, totalBatches } = job.data;

      if (webhookEventId) {
        // Track this batch completion
        if (!completedBatchesMap.has(webhookEventId)) {
          completedBatchesMap.set(webhookEventId, new Set());
          totalBatchesMap.set(webhookEventId, totalBatches);
        }

        const completedBatches = completedBatchesMap.get(webhookEventId)!;
        completedBatches.add(batchNumber);

        console.log(
          `[QUEUE-V2] Webhook ${webhookEventId}: Batch ${batchNumber}/${totalBatches} completed. Total completed: ${completedBatches.size}`
        );

        // Check if ALL batches are completed
        if (completedBatches.size === totalBatches) {
          // All batches completed - mark webhook as completed
          try {
            // Check if db connection exists, create direct connection if needed
            if (!db) {
              console.error(
                '[QUEUE-V2] Database connection not available, creating direct connection...'
              );
              const postgres = require('postgres');
              const directDb = postgres(env.DATABASE_URL!, {
                ssl: env.DATABASE_URL!.includes('localhost')
                  ? false
                  : { rejectUnauthorized: false },
              });

              await directDb`
                UPDATE webhook_events
                SET status = 'completed',
                    processed_at = NOW()
                WHERE id = ${webhookEventId}
              `;

              await directDb.end();
              console.log(
                `[QUEUE-V2] ✅ Updated webhook_event ${webhookEventId} to completed via direct connection`
              );
            } else {
              await db.execute(sql`
                UPDATE webhook_events
                SET status = 'completed',
                    processed_at = NOW(),
                    metadata = CASE
                      WHEN metadata IS NULL OR jsonb_typeof(metadata) != 'object'
                      THEN jsonb_build_object('completed_at', NOW())
                      ELSE jsonb_set(metadata, '{completed_at}', to_jsonb(NOW()))
                    END
                WHERE id = ${webhookEventId}
              `);
              console.log(
                `[QUEUE-V2] ✅ All batches completed! Updated webhook_event ${webhookEventId} status to completed`
              );
            }

            // Clean up tracking maps
            completedBatchesMap.delete(webhookEventId);
            totalBatchesMap.delete(webhookEventId);
          } catch (error) {
            console.error(`[QUEUE-V2] Failed to update webhook_event ${webhookEventId}:`, error);
          }
        }
      }
    });

    WebhookProcessorOptimizedV2.webhookWorker.on('failed', async (job, err) => {
      console.error(`[QUEUE-V2] Job ${job?.id} failed:`, err.message);

      // Update webhook event status to failed
      if (job) {
        const { webhookEventId } = job.data;
        if (webhookEventId) {
          try {
            await db.execute(sql`
              UPDATE webhook_events
              SET status = 'failed',
                  processed_at = NOW(),
                  error_message = ${err.message},
                  metadata = CASE
                    WHEN metadata IS NULL OR jsonb_typeof(metadata) != 'object'
                    THEN jsonb_build_object('failed_at', NOW())
                    ELSE jsonb_set(metadata, '{failed_at}', to_jsonb(NOW()))
                  END
              WHERE id = ${webhookEventId}
            `);
            console.log(`[QUEUE-V2] Updated webhook_event ${webhookEventId} status to failed`);
          } catch (error) {
            console.error(`[QUEUE-V2] Failed to update webhook_event ${webhookEventId}:`, error);
          }
        }
      }
    });

    WebhookProcessorOptimizedV2.webhookWorker.on('active', job => {
      console.log(`[QUEUE-V2] Job ${job.id} is now active (started processing)`);
    });

    WebhookProcessorOptimizedV2.webhookWorker.on('stalled', jobId => {
      console.warn(`[QUEUE-V2] Job ${jobId} has stalled`);
    });

    WebhookProcessorOptimizedV2.webhookWorker.on('error', err => {
      console.error(`[QUEUE-V2] Worker error:`, err.message);
    });

    console.log('[OPTIMIZED-V2] BullMQ queue and worker initialized');

    // Resume queue in case it was paused
    await WebhookProcessorOptimizedV2.webhookQueue.resume();
    console.log('[OPTIMIZED-V2] Queue resumed to ensure processing');

    // Log worker status
    setTimeout(async () => {
      try {
        const isRunning = await WebhookProcessorOptimizedV2.webhookWorker.isRunning();
        const waiting = await WebhookProcessorOptimizedV2.webhookQueue.getWaitingCount();
        const active = await WebhookProcessorOptimizedV2.webhookQueue.getActiveCount();
        const isPaused = await WebhookProcessorOptimizedV2.webhookQueue.isPaused();
        console.log(
          `[OPTIMIZED-V2] Worker status check - Running: ${isRunning}, Waiting: ${waiting}, Active: ${active}, Paused: ${isPaused}`
        );
      } catch (err) {
        console.error('[OPTIMIZED-V2] Error checking worker status:', err);
      }
    }, 5000); // Check after 5 seconds
  }

  private async initializeFtpPool() {
    // Check if already initialized or initializing
    if (WebhookProcessorOptimizedV2.poolInitialized) {
      return;
    }

    // Set flag immediately to prevent race conditions
    WebhookProcessorOptimizedV2.poolInitialized = true;

    // Double-check pool size after setting flag
    if (WebhookProcessorOptimizedV2.ftpPool.length >= WebhookProcessorOptimizedV2.MAX_CONNECTIONS) {
      return;
    }

    console.log(
      `[OPTIMIZED-V2] Initializing FTP connection pool with ${WebhookProcessorOptimizedV2.MAX_CONNECTIONS} connections...`
    );

    const ftpConfig = {
      host: env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: env.TRAVELTEK_FTP_USER,
      password: env.TRAVELTEK_FTP_PASSWORD,
      secure: false,
      timeout: 30000,
      verbose: false,
    };

    // Debug logging (mask password)
    console.log('[OPTIMIZED-V2] FTP Config:', {
      host: ftpConfig.host,
      user: ftpConfig.user,
      hasPassword: !!ftpConfig.password,
      passwordLength: ftpConfig.password?.length || 0,
      secure: ftpConfig.secure,
    });

    // Create connection pool
    for (let i = 0; i < WebhookProcessorOptimizedV2.MAX_CONNECTIONS; i++) {
      let retries = 3;
      let connected = false;

      while (retries > 0 && !connected) {
        const client = new ftp.Client();
        client.ftp.verbose = false;

        try {
          // Add delay between connection attempts to avoid overwhelming server
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          await client.access(ftpConfig);
          WebhookProcessorOptimizedV2.ftpPool.push({
            client,
            inUse: false,
            lastUsed: Date.now(),
          });
          console.log(
            `[OPTIMIZED-V2] Connection ${i + 1}/${WebhookProcessorOptimizedV2.MAX_CONNECTIONS} established`
          );
          connected = true;
        } catch (error: any) {
          retries--;
          const errorMsg = error?.message || String(error);

          // Check for specific FTP errors
          if (errorMsg.includes('FIN packet') || errorMsg.includes('ECONNRESET')) {
            console.error(
              `[OPTIMIZED-V2] FTP server closed connection ${i + 1} unexpectedly, ${retries} retries left`
            );
            // Longer wait for server-side issues
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
          } else {
            console.error(
              `[OPTIMIZED-V2] Failed to create connection ${i + 1}, ${retries} retries left:`,
              errorMsg
            );
            if (retries > 0) {
              // Normal exponential backoff for other errors
              await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
            }
          }
        }
      }

      if (!connected) {
        console.error(`[OPTIMIZED-V2] Could not establish connection ${i + 1} after all retries`);
      }
    }

    // Set up keep-alive and health check
    setInterval(async () => {
      const deadConnections: FtpConnection[] = [];

      for (const conn of WebhookProcessorOptimizedV2.ftpPool) {
        if (
          !conn.inUse &&
          Date.now() - conn.lastUsed > WebhookProcessorOptimizedV2.KEEP_ALIVE_INTERVAL
        ) {
          try {
            await conn.client.send('NOOP');
            conn.lastUsed = Date.now();
          } catch (error) {
            // Connection is dead, mark for removal
            deadConnections.push(conn);
          }
        }
      }

      // Remove dead connections and create replacements
      for (const deadConn of deadConnections) {
        const index = WebhookProcessorOptimizedV2.ftpPool.indexOf(deadConn);
        if (index !== -1) {
          WebhookProcessorOptimizedV2.ftpPool.splice(index, 1);
          console.log(
            `[OPTIMIZED-V2] Removed dead connection during health check. Pool size: ${WebhookProcessorOptimizedV2.ftpPool.length}`
          );

          // Try to create replacement
          try {
            const newClient = new ftp.Client();
            newClient.ftp.verbose = false;
            await newClient.access(ftpConfig);
            WebhookProcessorOptimizedV2.ftpPool.push({
              client: newClient,
              inUse: false,
              lastUsed: Date.now(),
            });
            console.log(
              `[OPTIMIZED-V2] Created replacement connection during health check. Pool size: ${WebhookProcessorOptimizedV2.ftpPool.length}`
            );
          } catch (replaceError) {
            console.error(
              '[OPTIMIZED-V2] Failed to create replacement during health check:',
              replaceError
            );
          }
        }
      }

      // If pool is critically low, trigger full reset
      if (
        WebhookProcessorOptimizedV2.ftpPool.length < 2 &&
        !WebhookProcessorOptimizedV2.poolInitialized
      ) {
        console.error(
          '[OPTIMIZED-V2] Pool critically low during health check, triggering reset...'
        );
        WebhookProcessorOptimizedV2.poolInitialized = false;
        WebhookProcessorOptimizedV2.ftpPool = [];
        this.initializeFtpPool().catch(console.error);
      }
    }, WebhookProcessorOptimizedV2.KEEP_ALIVE_INTERVAL);

    // Don't set poolInitialized again, it's already set at the beginning
    console.log(
      `[OPTIMIZED-V2] FTP pool ready with ${WebhookProcessorOptimizedV2.ftpPool.length} connections`
    );
  }

  private async getFtpConnection(): Promise<FtpConnection> {
    // Wait for pool to be initialized
    while (!WebhookProcessorOptimizedV2.poolInitialized) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Find available connection
    let availableConn = WebhookProcessorOptimizedV2.ftpPool.find(conn => !conn.inUse);

    if (availableConn) {
      availableConn.inUse = true;
      availableConn.lastUsed = Date.now();

      // Test if connection is still alive
      try {
        await availableConn.client.pwd();
        return availableConn;
      } catch (error) {
        // Connection dead, recreate it with retry logic
        console.log('[OPTIMIZED-V2] Recreating dead connection...');
        const ftpConfig = {
          host: env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
          user: env.TRAVELTEK_FTP_USER,
          password: env.TRAVELTEK_FTP_PASSWORD,
          secure: false,
          timeout: 30000,
          verbose: false,
        };

        // Debug logging for reconnection (mask password)
        console.log('[OPTIMIZED-V2] Reconnect FTP Config:', {
          host: ftpConfig.host,
          user: ftpConfig.user,
          hasPassword: !!ftpConfig.password,
          passwordLength: ftpConfig.password?.length || 0,
          secure: ftpConfig.secure,
        });

        // Try to recreate connection with retries
        let retries = 3;
        let lastError: any;

        while (retries > 0) {
          try {
            availableConn.client = new ftp.Client();
            availableConn.client.ftp.verbose = false;
            await availableConn.client.access(ftpConfig);
            console.log('[OPTIMIZED-V2] Successfully recreated FTP connection');
            return availableConn;
          } catch (reconnectError) {
            lastError = reconnectError;
            retries--;
            console.error(
              `[OPTIMIZED-V2] Failed to recreate connection, ${retries} retries left:`,
              reconnectError
            );

            if (retries > 0) {
              // Wait before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
            }
          }
        }

        // If all retries failed, remove the dead connection from pool
        console.error('[OPTIMIZED-V2] Failed to recreate connection after all retries:', lastError);
        const deadIndex = WebhookProcessorOptimizedV2.ftpPool.indexOf(availableConn);
        if (deadIndex !== -1) {
          WebhookProcessorOptimizedV2.ftpPool.splice(deadIndex, 1);
          console.log(
            `[OPTIMIZED-V2] Removed dead connection from pool. Pool size: ${WebhookProcessorOptimizedV2.ftpPool.length}`
          );
        }

        // Try to create a replacement connection
        try {
          const newClient = new ftp.Client();
          newClient.ftp.verbose = false;
          await newClient.access(ftpConfig);
          const newConn: FtpConnection = {
            client: newClient,
            inUse: true,
            lastUsed: Date.now(),
          };
          WebhookProcessorOptimizedV2.ftpPool.push(newConn);
          console.log(
            `[OPTIMIZED-V2] Created replacement connection. Pool size: ${WebhookProcessorOptimizedV2.ftpPool.length}`
          );
          return newConn;
        } catch (replacementError) {
          console.error(
            '[OPTIMIZED-V2] Failed to create replacement connection:',
            replacementError
          );
        }

        // If pool is getting too small, trigger a full reset
        if (WebhookProcessorOptimizedV2.ftpPool.length < 2) {
          console.error('[OPTIMIZED-V2] FTP pool critically low, triggering reset...');
          WebhookProcessorOptimizedV2.poolInitialized = false;
          WebhookProcessorOptimizedV2.ftpPool = [];
          await this.initializeFtpPool();
          return this.getFtpConnection();
        }

        // Try another connection from the pool
        const otherConn = WebhookProcessorOptimizedV2.ftpPool.find(c => !c.inUse);
        if (otherConn) {
          return this.getFtpConnection();
        }

        throw new Error(
          `FTP connection failed: ${lastError?.message || 'No available connections'} (control socket)`
        );
      }
    }

    // Wait for connection to become available
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.getFtpConnection();
  }

  private releaseFtpConnection(conn: FtpConnection) {
    conn.inUse = false;
    conn.lastUsed = Date.now();
  }

  async processWebhooks(
    lineId: number,
    webhookEventId?: number
  ): Promise<{ status: string; jobId?: string; message: string }> {
    const startTime = Date.now();
    console.log(`[OPTIMIZED-V2] Starting webhook processing for line ${lineId}`);

    // Send Slack notification for processing start
    await slackService.notifyWebhookProcessingStarted({
      eventType: 'cruise_line_update',
      lineId,
      timestamp: new Date().toISOString(),
    });

    try {
      // Initialize queue if not already done
      try {
        await this.initializeQueue();
      } catch (error: any) {
        if (error.message?.includes('LOADING')) {
          console.error(
            '[OPTIMIZED-V2] Redis is still loading dataset, webhook processing delayed'
          );
          return {
            status: 'error',
            message: 'Redis is loading data after restart. Please retry in 30 seconds.',
          };
        }
        throw error;
      }

      // Check if we recently processed this line (throttling)
      const recentProcessing = await db.execute(sql`
        SELECT MAX(processed_at) as last_processed
        FROM webhook_events
        WHERE line_id = ${lineId}
          AND status = 'completed'
          AND processed_at > NOW() - INTERVAL '15 minutes'
      `);

      if (recentProcessing && recentProcessing[0]?.last_processed) {
        const minutesAgo = Math.round(
          (Date.now() - new Date(recentProcessing[0].last_processed).getTime()) / 60000
        );
        console.log(`[THROTTLE] Line ${lineId} was processed ${minutesAgo} minutes ago, skipping`);

        // Update webhook status to throttled
        if (webhookEventId) {
          await db.execute(sql`
            UPDATE webhook_events
            SET status = 'throttled',
                processed_at = NOW(),
                metadata = CASE
                  WHEN metadata IS NULL OR jsonb_typeof(metadata) != 'object'
                  THEN jsonb_build_object('throttled_reason', ${'Recently processed ' + minutesAgo + ' minutes ago'}::text)
                  ELSE jsonb_set(metadata, '{throttled_reason}', to_jsonb(${'Recently processed ' + minutesAgo + ' minutes ago'}::text))
                END
            WHERE id = ${webhookEventId}
          `);
        } else {
          await db.execute(sql`
            UPDATE webhook_events
            SET status = 'throttled',
                processed_at = NOW(),
                metadata = CASE
                  WHEN metadata IS NULL OR jsonb_typeof(metadata) != 'object'
                  THEN jsonb_build_object('throttled_reason', ${'Recently processed ' + minutesAgo + ' minutes ago'}::text)
                  ELSE jsonb_set(metadata, '{throttled_reason}', to_jsonb(${'Recently processed ' + minutesAgo + ' minutes ago'}::text))
                END
            WHERE line_id = ${lineId}
              AND status = 'pending'
              AND received_at > NOW() - INTERVAL '1 hour'
          `);
        }

        return {
          status: 'throttled',
          message: `Recently processed ${minutesAgo} minutes ago`,
        };
      }

      // Skip snapshot for now - database schema mismatch
      // await this.takeSnapshot(lineId);

      // Generate unique run ID for this webhook processing session
      const runId = `${lineId}-${Date.now()}`;

      // Initialize global stats tracker for this run
      if (WebhookProcessorOptimizedV2.statsTracker) {
        await WebhookProcessorOptimizedV2.statsTracker.initStats(runId);
        console.log(`[OPTIMIZED-V2] Initialized global stats for run ${runId}`);
      }

      // Reset processing stats for this line
      // Clean up any old runs for this line
      for (const [key, value] of this.processingJobs.entries()) {
        if (value.lineId === lineId) {
          this.processingJobs.delete(key);
        }
      }

      this.stats = {
        filesProcessed: 0,
        cruisesUpdated: 0,
        skippedUnchanged: 0,
        errors: [],
        priceSnapshotsCreated: 0,
        changeLog: [],
      };

      // Discover files efficiently
      const files = await this.discoverFiles(lineId);

      // Log configuration and summary
      console.log(`[OPTIMIZED-V2] Found ${files.length} files to process`);

      // Show file distribution by month for better visibility
      const fileSummary: Record<string, number> = {};
      files.forEach(file => {
        const key = `${file.year}/${file.month.toString().padStart(2, '0')}`;
        fileSummary[key] = (fileSummary[key] || 0) + 1;
      });
      if (Object.keys(fileSummary).length > 0) {
        console.log(`[OPTIMIZED-V2] File distribution:`, JSON.stringify(fileSummary));
      }

      if (files.length === 0) {
        return {
          status: 'completed',
          message: `No files found for line ${lineId}`,
        };
      }

      // Create batches of files for queue processing
      const MAX_FILES_PER_JOB = 100; // Increased job size with upgraded Redis
      const batches = [];

      for (let i = 0; i < files.length; i += MAX_FILES_PER_JOB) {
        batches.push(files.slice(i, i + MAX_FILES_PER_JOB));
      }

      console.log(
        `[OPTIMIZED-V2] Creating ${batches.length} jobs for line ${lineId} (${files.length} files / ${MAX_FILES_PER_JOB} per job)`
      );

      // Check for existing active jobs - DO NOT remove them
      const activeJobs = await WebhookProcessorOptimizedV2.webhookQueue!.getJobs(['active']);
      const activeForThisLine = activeJobs.filter(job => job.data?.lineId === lineId);

      if (activeForThisLine.length > 0) {
        console.log(
          `[OPTIMIZED-V2] WARNING: ${activeForThisLine.length} active jobs already processing for line ${lineId}. ` +
            `Skipping new job creation to prevent conflicts.`
        );
        return {
          status: 'skipped',
          message: `Active jobs already processing for line ${lineId} (${activeForThisLine.length} jobs)`,
        };
      }

      // Queue jobs for processing
      const jobIds = [];
      for (let i = 0; i < batches.length; i++) {
        const job = await WebhookProcessorOptimizedV2.webhookQueue!.add(
          `line-${lineId}-batch-${i + 1}`,
          {
            lineId,
            runId, // Pass the unique run ID
            webhookEventId, // Pass webhook event ID for status tracking
            files: batches[i],
            batchNumber: i + 1,
            totalBatches: batches.length,
            totalFilesInRun: files.length, // Track actual file count
          },
          {
            priority: batches.length - i, // Process earlier batches first
            delay: i * 2000, // Stagger job starts by 2 seconds
            jobId: `line-${lineId}-batch-${i + 1}-${Date.now()}`, // Unique job ID to prevent duplicates
          }
        );
        jobIds.push(job.id);
      }

      const duration = Date.now() - startTime;
      console.log(`[OPTIMIZED-V2] Queued ${batches.length} jobs in ${duration}ms`);
      console.log(`[OPTIMIZED-V2] Job IDs: ${jobIds.join(', ')}`);

      // Update webhook status to processing now that jobs are queued
      if (webhookEventId) {
        try {
          await db.execute(sql`
            UPDATE webhook_events
            SET status = 'processing',
                metadata = CASE
                  WHEN metadata IS NULL OR jsonb_typeof(metadata) != 'object'
                  THEN jsonb_build_object('job_ids', ${JSON.stringify(jobIds)}::jsonb)
                  ELSE jsonb_set(metadata, '{job_ids}', ${JSON.stringify(jobIds)}::jsonb)
                END
            WHERE id = ${webhookEventId}
          `);
          console.log(
            `[OPTIMIZED-V2] Updated webhook_event ${webhookEventId} status to processing`
          );
        } catch (error) {
          console.error(`[OPTIMIZED-V2] Failed to update webhook_event ${webhookEventId}:`, error);
        }
      }

      // Check queue status immediately after adding jobs
      const waiting = await WebhookProcessorOptimizedV2.webhookQueue.getWaitingCount();
      const delayed = await WebhookProcessorOptimizedV2.webhookQueue.getDelayedCount();
      const active = await WebhookProcessorOptimizedV2.webhookQueue.getActiveCount();
      const isPaused = await WebhookProcessorOptimizedV2.webhookQueue.isPaused();

      console.log(
        `[OPTIMIZED-V2] Queue status after adding jobs - Waiting: ${waiting}, Delayed: ${delayed}, Active: ${active}, Paused: ${isPaused}`
      );

      // Resume queue if it's paused
      if (isPaused) {
        console.log('[OPTIMIZED-V2] Queue is paused, resuming...');
        await WebhookProcessorOptimizedV2.webhookQueue.resume();
        const stillPaused = await WebhookProcessorOptimizedV2.webhookQueue.isPaused();
        console.log(`[OPTIMIZED-V2] Queue resumed. Still paused: ${stillPaused}`);
      }

      // Check if worker is running
      if (WebhookProcessorOptimizedV2.webhookWorker) {
        const isRunning = await WebhookProcessorOptimizedV2.webhookWorker.isRunning();
        console.log(`[OPTIMIZED-V2] Worker running: ${isRunning}`);

        if (!isRunning) {
          console.log('[OPTIMIZED-V2] WARNING: Worker is not running! Attempting to run worker...');
          await WebhookProcessorOptimizedV2.webhookWorker.run();
        }
      } else {
        console.error('[OPTIMIZED-V2] ERROR: Worker not initialized!');
      }

      return {
        status: 'queued',
        jobId: jobIds[0], // Return first job ID
        message: `Queued ${batches.length} jobs to process ${files.length} files for line ${lineId}`,
      };
    } catch (error) {
      console.error('[OPTIMIZED-V2] Processing failed:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async discoverFiles(lineId: number): Promise<any[]> {
    const conn = await this.getFtpConnection();
    const files: any[] = [];

    try {
      // Get current date
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // First, discover what years are available on FTP
      const availableYears: number[] = [];
      try {
        const yearDirs = await conn.client.list('/');
        for (const dir of yearDirs) {
          if (dir.type === 2) {
            // Directory
            const year = parseInt(dir.name);
            // Include any year from current year onwards (no upper limit)
            if (!isNaN(year) && year >= currentYear) {
              availableYears.push(year);
            }
          }
        }
        // Sort years in ascending order
        availableYears.sort((a, b) => a - b);
      } catch (error) {
        console.log('[OPTIMIZED-V2] Error listing years, using default range');
        availableYears.push(currentYear, currentYear + 1);
      }

      console.log(`[OPTIMIZED-V2] Scanning ALL available years: ${availableYears.join(', ')}`);

      // For each available year, scan all months from current month onwards
      for (const year of availableYears) {
        const startMonth = year === currentYear ? currentMonth : 1;
        const endMonth = 12;

        for (let month = startMonth; month <= endMonth; month++) {
          const monthStr = month.toString().padStart(2, '0');
          const linePath = `/${year}/${monthStr}/${lineId}`;

          try {
            const shipDirs = await conn.client.list(linePath);

            for (const shipDir of shipDirs) {
              if (shipDir.type === 2) {
                // Directory
                const shipPath = `${linePath}/${shipDir.name}`;
                const cruiseFiles = await conn.client.list(shipPath);

                for (const file of cruiseFiles) {
                  if (file.type === 1 && file.name.endsWith('.json')) {
                    files.push({
                      path: `${shipPath}/${file.name}`,
                      name: file.name,
                      lineId: lineId,
                      shipId: parseInt(shipDir.name) || 0,
                      cruiseId: file.name.replace('.json', ''),
                      size: file.size,
                      year: year,
                      month: month,
                    });
                  }
                }
              }
            }

            if (files.length > 0) {
              console.log(`[OPTIMIZED-V2] Found ${files.length} files in ${year}/${monthStr}`);
            }
          } catch (error) {
            // No data for this month, continue silently
          }
        }
      }

      // Sort files by date (year/month) to process most recent first
      files.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
    } finally {
      this.releaseFtpConnection(conn);
    }

    return files;
  }

  // Static version of processFile that can be called from worker
  public static async processFileStatic(file: any, runId: string): Promise<boolean> {
    // Use singleton instance to avoid creating multiple FTP pools
    if (!WebhookProcessorOptimizedV2.processorInstance) {
      WebhookProcessorOptimizedV2.processorInstance = new WebhookProcessorOptimizedV2();
    }
    return WebhookProcessorOptimizedV2.processorInstance.processFile(file, runId);
  }

  /**
   * Calculate checksum for change detection (much faster than JSON.stringify)
   */
  private calculateChecksum(data: any): string {
    // Only hash the fields we actually care about for changes
    const relevantData = {
      cheapest: data.cheapest,
      prices: data.prices,
      cabins: data.cabins,
      availabilitystatus: data.availabilitystatus,
      soldout: data.soldout,
      cheapestinside: data.cheapestinside,
      cheapestoutside: data.cheapestoutside,
      cheapestbalcony: data.cheapestbalcony,
      cheapestsuite: data.cheapestsuite,
    };

    return crypto.createHash('md5').update(JSON.stringify(relevantData)).digest('hex');
  }

  /**
   * Check if cruise data has actually changed using checksums
   * Much faster than comparing full JSON objects
   */
  private async hasDataChanged(
    cruiseId: string,
    newData: any
  ): Promise<{ changed: boolean; changes: string[] }> {
    try {
      // Calculate checksum for new data
      const newChecksum = this.calculateChecksum(newData);

      // Check cached checksum first (in-memory, instant)
      const cachedChecksum = WebhookProcessorOptimizedV2.checksumCache.get(cruiseId);
      if (cachedChecksum === newChecksum) {
        // Data hasn't changed
        return { changed: false, changes: [] };
      }

      // If not in cache or different, check if cruise exists
      const existing = await db
        .select({
          id: cruises.id,
        })
        .from(cruises)
        .where(eq(cruises.id, cruiseId))
        .limit(1);

      if (!existing[0]) {
        console.log(`[CHANGE-DETECTION] New cruise ${cruiseId}`);
        // Store checksum for future comparisons
        WebhookProcessorOptimizedV2.checksumCache.set(cruiseId, newChecksum);
        return { changed: true, changes: ['new_cruise'] };
      }

      // Cruise exists and data changed - update checksum cache
      WebhookProcessorOptimizedV2.checksumCache.set(cruiseId, newChecksum);
      console.log(`[CHANGE-DETECTION] Cruise ${cruiseId} data changed (checksum mismatch)`);

      return { changed: true, changes: ['data_changed'] };
    } catch (error) {
      console.error(`[CHANGE-DETECTION] Error checking changes for ${cruiseId}:`, error);
      // On error, process anyway to be safe
      return { changed: true, changes: ['error_checking'] };
    }
  }

  /**
   * Ensure raw_data is a proper object, not a string or character array
   * This prevents the corruption where JSON strings get stored as character arrays
   */
  private ensureValidRawData(data: any): any {
    // If data is a string, parse it
    if (typeof data === 'string') {
      try {
        console.warn('[OPTIMIZED-V2] WARNING: rawData was a string, parsing to object');
        return JSON.parse(data);
      } catch (e) {
        console.error('[OPTIMIZED-V2] ERROR: Could not parse rawData string:', e);
        return {};
      }
    }

    // If data looks like a character array (has numeric string keys)
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      // Check for character array pattern
      if (
        data['0'] !== undefined &&
        data['1'] !== undefined &&
        typeof data['0'] === 'string' &&
        data['0'].length === 1
      ) {
        console.warn('[OPTIMIZED-V2] WARNING: Detected character array in rawData, reconstructing');

        // Reconstruct the JSON string
        let jsonString = '';
        let i = 0;
        const maxChars = 10000000; // Safety limit

        while (data[i.toString()] !== undefined && i < maxChars) {
          jsonString += data[i.toString()];
          i++;
        }

        try {
          return JSON.parse(jsonString);
        } catch (e) {
          console.error('[OPTIMIZED-V2] ERROR: Could not parse reconstructed JSON:', e);
          return {};
        }
      }
    }

    // Data is already a proper object
    return data;
  }

  private async processFile(file: any, runId?: string): Promise<boolean> {
    let conn;

    try {
      conn = await this.getFtpConnection();
    } catch (error) {
      console.error(`[OPTIMIZED-V2] Failed to get FTP connection for ${file.path}:`, error);
      // Return false to indicate processing failed, but don't crash the whole batch
      return false;
    }

    try {
      // Download file to memory (like sync-complete-enhanced.js)
      let chunks: Buffer[] = [];
      const writeStream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });

      await conn.client.downloadTo(writeStream, file.path);

      if (chunks.length === 0) {
        console.log(`[OPTIMIZED-V2] Empty file: ${file.path}`);
        return false;
      }

      // Parse JSON with error handling for corrupted files
      let data;
      let parseAttempts = 0;
      const maxParseAttempts = 2;

      while (parseAttempts < maxParseAttempts) {
        try {
          const jsonString = Buffer.concat(chunks).toString();
          data = JSON.parse(jsonString);
          break; // Success, exit loop
        } catch (parseError) {
          parseAttempts++;
          console.error(
            `[OPTIMIZED-V2] JSON parsing error for ${file.path} (attempt ${parseAttempts}/${maxParseAttempts}):`,
            parseError
          );

          if (parseAttempts < maxParseAttempts) {
            // Try to re-download the file
            console.log(`[OPTIMIZED-V2] Attempting to re-download corrupted file: ${file.path}`);
            chunks = [];

            try {
              // Use the same download approach as initial download
              const writeStream = new Writable({
                write(chunk, encoding, callback) {
                  chunks.push(chunk);
                  callback();
                },
              });
              await conn.client.downloadTo(writeStream, file.path);

              if (chunks.length === 0) {
                console.log(`[OPTIMIZED-V2] Re-downloaded empty file: ${file.path}`);
                return false;
              }

              console.log(
                `[OPTIMIZED-V2] Re-downloaded ${file.path} (${Buffer.concat(chunks).length} bytes)`
              );
            } catch (redownloadError) {
              console.error(`[OPTIMIZED-V2] Failed to re-download ${file.path}:`, redownloadError);
              return false;
            }
          } else {
            // Final failure, log details
            const fileContent = Buffer.concat(chunks).toString();
            const errorPosition = parseInt(
              (parseError as any).message.match(/position (\d+)/)?.[1] || '0'
            );

            console.error(`[OPTIMIZED-V2] File permanently corrupted: ${file.path}`);
            console.error(`[OPTIMIZED-V2] Parse error: ${(parseError as any).message}`);

            // Log the content around the error position for debugging
            if (errorPosition > 0) {
              const start = Math.max(0, errorPosition - 100);
              const end = Math.min(fileContent.length, errorPosition + 100);
              console.error(
                `[OPTIMIZED-V2] Content around error position ${errorPosition}:`,
                fileContent.substring(start, end).replace(/\n/g, '\\n')
              );
            } else {
              console.error(
                `[OPTIMIZED-V2] First 500 chars:`,
                fileContent.substring(0, 500).replace(/\n/g, '\\n')
              );
            }

            // Track this corrupted file in Redis for future reference
            if (runId && WebhookProcessorOptimizedV2.statsTracker) {
              await WebhookProcessorOptimizedV2.statsTracker.trackCorruptedFile(runId, file.path);
            }

            // Return false to mark as failed but continue processing other files
            return false;
          }
        }
      }

      // According to TRAVELTEK-COMPLETE-FIELD-REFERENCE.md, the primary ID is codetocruiseid
      const cruiseId = data.codetocruiseid || data.id || file.cruiseId;

      if (!cruiseId) {
        console.log(`[OPTIMIZED-V2] No cruise ID found in ${file.path}`);
        return;
      }

      // Check if data has actually changed before processing
      const changeResult = await this.hasDataChanged(cruiseId, data);
      if (!changeResult.changed) {
        console.log(`[SKIP-UNCHANGED] Cruise ${cruiseId} has no changes, skipping DB writes`);
        this.stats.skippedUnchanged++;
        this.stats.filesProcessed++;
        // Update global stats if runId is provided
        if (runId && WebhookProcessorOptimizedV2.statsTracker) {
          await WebhookProcessorOptimizedV2.statsTracker.incrementStat(runId, 'skippedUnchanged');
          await WebhookProcessorOptimizedV2.statsTracker.incrementStat(runId, 'filesProcessed');
        }
        return true; // Mark as successfully processed (no changes needed)
      }

      // Extract sailing date (from startdate or saildate field)
      let sailingDate = data.startdate || data.saildate;
      if (!sailingDate) {
        // Fallback to other possible date fields
        sailingDate = data.embarkDate || data.embarkdate || data.sailingdate || data.sailing_date;
      }
      if (sailingDate && sailingDate.includes('T')) {
        sailingDate = sailingDate.split('T')[0];
      }

      // Calculate return date if we have sailing date and nights
      let returnDate = null;
      if (sailingDate && data.nights) {
        const sailDate = new Date(sailingDate);
        sailDate.setDate(sailDate.getDate() + parseInt(data.nights));
        returnDate = sailDate.toISOString().split('T')[0];
      }

      // Extract port and region information (handle both array and string formats)
      let portIds = '';
      if (data.portids) {
        if (Array.isArray(data.portids)) {
          portIds = data.portids.join(',');
        } else if (typeof data.portids === 'string') {
          portIds = data.portids;
        }
      }

      let regionIds = '';
      if (data.regionids) {
        if (Array.isArray(data.regionids)) {
          regionIds = data.regionids.join(',');
        } else if (typeof data.regionids === 'string') {
          regionIds = data.regionids;
        }
      }

      // Helper function to safely parse integer, returning default for invalid values
      const safeParseInt = (value: any, defaultValue: number | null = 0): number | null => {
        if (value === null || value === undefined || value === '' || value === 'system') {
          return defaultValue;
        }
        // Handle strings like "system" that can't be parsed as integers
        const parsed = parseInt(value);
        return isNaN(parsed) ? defaultValue : parsed;
      };

      // Prepare comprehensive cruise data based on Traveltek fields
      const cruiseData = {
        id: cruiseId,
        cruiseId: data.cruiseid ? data.cruiseid.toString() : cruiseId,
        cruiseLineId: file.lineId,
        shipId: safeParseInt(data.shipid || file.shipId, 0),
        name: data.name || data.title || 'Unknown Cruise',
        voyageCode: data.voyagecode || null,
        itineraryCode: data.itinerarycode || null,
        sailingDate: sailingDate || new Date().toISOString().split('T')[0],
        returnDate: returnDate,
        nights: safeParseInt(data.nights || data.sailnights, 0),
        seaDays: safeParseInt(data.seadays, 0),
        embarkPortId: safeParseInt(data.startportid || data.embarkportid, 0),
        disembarkPortId: safeParseInt(data.endportid || data.disembarkportid, 0),
        portIds: portIds,
        regionIds: regionIds,
        marketId: safeParseInt(data.marketid, null),
        ownerId: safeParseInt(data.ownerid, null),
        noFly: data.nofly === 'Y' || data.nofly === true,
        departUk: data.departuk === true,
        showCruise: data.showcruise !== false, // Default to true unless explicitly false
        lastCached: safeParseInt(data.lastcached, null),
        cachedDate: data.cacheddate || null,
        rawData: this.ensureValidRawData(data),
        updatedAt: new Date(),
      };

      // First, ensure the ship exists before inserting cruise
      // Extract ship data from the cruise JSON
      const shipId = cruiseData.shipId;
      if (shipId && shipId > 0) {
        // Check if we've already processed this ship in this run
        if (!WebhookProcessorOptimizedV2.shipCache.has(shipId)) {
          try {
            const shipData = {
              id: shipId,
              cruiseLineId: file.lineId,
              name: data.shipname || data.shipcontent?.name || `Ship ${shipId}`,
              code: data.shipcode || null,
              niceName: data.shipcontent?.nicename || null,
              shortName: data.shipcontent?.shortname || null,
              maxPassengers: safeParseInt(data.shipcontent?.maxpassengers, null),
              crew: safeParseInt(data.shipcontent?.crew, null),
              tonnage: safeParseInt(data.shipcontent?.tonnage, null),
              totalCabins: safeParseInt(data.shipcontent?.totalcabins, null),
              length: data.shipcontent?.length || null,
              beam: data.shipcontent?.beam || null,
              draft: data.shipcontent?.draft || null,
              speed: data.shipcontent?.speed || null,
              registry: data.shipcontent?.registry || null,
              builtYear: safeParseInt(data.shipcontent?.builtyear, null),
              refurbishedYear: safeParseInt(data.shipcontent?.refurbishedyear, null),
              description: data.shipcontent?.description || null,
              starRating: safeParseInt(data.shipcontent?.starrating, null),
              adultsOnly: data.shipcontent?.adultsonly === true,
              highlights: data.shipcontent?.highlights || null,
              shipClass: data.shipcontent?.shipclass || null,
              defaultShipImage: data.shipcontent?.defaultshipimage || null,
              defaultShipImageHd: data.shipcontent?.defaultshiptopimage || null,
              defaultShipImage2k: data.shipcontent?.defaultshipimage2k || null,
              niceUrl: data.shipcontent?.niceurl || null,
              rawShipContent: data.shipcontent || null,
              isActive: true,
              updatedAt: new Date(),
            };

            // Upsert ship (insert if new, update if exists)
            await db
              .insert(ships)
              .values(shipData)
              .onConflictDoUpdate({
                target: ships.id,
                set: {
                  name: shipData.name,
                  code: shipData.code,
                  niceName: shipData.niceName,
                  shortName: shipData.shortName,
                  maxPassengers: shipData.maxPassengers,
                  crew: shipData.crew,
                  tonnage: shipData.tonnage,
                  totalCabins: shipData.totalCabins,
                  length: shipData.length,
                  beam: shipData.beam,
                  draft: shipData.draft,
                  speed: shipData.speed,
                  registry: shipData.registry,
                  builtYear: shipData.builtYear,
                  refurbishedYear: shipData.refurbishedYear,
                  description: shipData.description,
                  starRating: shipData.starRating,
                  adultsOnly: shipData.adultsOnly,
                  highlights: shipData.highlights,
                  shipClass: shipData.shipClass,
                  defaultShipImage: shipData.defaultShipImage,
                  defaultShipImageHd: shipData.defaultShipImageHd,
                  defaultShipImage2k: shipData.defaultShipImage2k,
                  niceUrl: shipData.niceUrl,
                  rawShipContent: shipData.rawShipContent,
                  updatedAt: new Date(),
                },
              });

            console.log(`[OPTIMIZED-V2] Ensured ship ${shipId} exists: ${shipData.name}`);

            // Mark ship as processed in cache
            WebhookProcessorOptimizedV2.shipCache.set(shipId, true);
          } catch (shipError: any) {
            console.error(
              `[OPTIMIZED-V2] Error creating/updating ship ${shipId}:`,
              shipError.message
            );
            // Continue anyway - maybe the ship already exists
          }
        } else {
          console.log(`[OPTIMIZED-V2] Ship ${shipId} already processed in this run, skipping`);
        }
      }

      // Upsert cruise (insert if new, update if exists)
      // First try to find existing cruise by composite key to prevent duplicates
      // This matches the unique constraint: idx_cruises_unique_sailing
      try {
        // Check if a cruise already exists with this line/ship/date/voyage combination
        const existingCruise = await db.execute(sql`
          SELECT id FROM cruises
          WHERE cruise_line_id = ${cruiseData.cruiseLineId}
            AND ship_id = ${cruiseData.shipId}
            AND sailing_date = ${cruiseData.sailingDate}
            AND COALESCE(voyage_code, '') = COALESCE(${cruiseData.voyageCode}, '')
          LIMIT 1
        `);

        let upsertId = cruiseData.id;

        // If a different cruise exists for this sailing, use that ID instead to update it
        if (existingCruise.length > 0 && existingCruise[0].id !== cruiseData.id) {
          console.log(
            `[OPTIMIZED-V2] Found existing cruise ${existingCruise[0].id} for sailing, updating instead of creating duplicate ${cruiseData.id}`
          );
          upsertId = existingCruise[0].id;
          cruiseData.id = upsertId; // Update the ID to match existing record
        }

        await db
          .insert(cruises)
          .values(cruiseData)
          .onConflictDoUpdate({
            target: cruises.id,
            set: {
              name: cruiseData.name,
              voyageCode: cruiseData.voyageCode,
              itineraryCode: cruiseData.itineraryCode,
              sailingDate: cruiseData.sailingDate,
              returnDate: cruiseData.returnDate,
              nights: cruiseData.nights,
              seaDays: cruiseData.seaDays,
              embarkPortId: cruiseData.embarkPortId,
              disembarkPortId: cruiseData.disembarkPortId,
              portIds: cruiseData.portIds,
              regionIds: cruiseData.regionIds,
              marketId: cruiseData.marketId,
              ownerId: cruiseData.ownerId,
              noFly: cruiseData.noFly,
              departUk: cruiseData.departUk,
              showCruise: cruiseData.showCruise,
              lastCached: cruiseData.lastCached,
              cachedDate: cruiseData.cachedDate,
              rawData: cruiseData.rawData,
              updatedAt: new Date(),
            },
          });

        this.stats.cruisesUpdated++;
        // Update global stats if runId is provided
        if (runId && WebhookProcessorOptimizedV2.statsTracker) {
          await WebhookProcessorOptimizedV2.statsTracker.incrementStat(runId, 'cruisesUpdated');
        }

        // Log what cabin/price data we have
        const hasCabins = !!data.cabins && Object.keys(data.cabins).length > 0;
        const hasPrices = !!data.prices && Object.keys(data.prices).length > 0;
        const priceCodes = [
          data.cheapestinsidepricecode ? 'inside' : null,
          data.cheapestoutsidepricecode ? 'outside' : null,
          data.cheapestbalconypricecode ? 'balcony' : null,
          data.cheapestsuitepricecode ? 'suite' : null,
        ]
          .filter(Boolean)
          .join(',');

        console.log(
          `[OPTIMIZED-V2] Upserted cruise ${cruiseId} (${file.size} bytes) - cabins:${hasCabins}, prices:${hasPrices}, codes:[${priceCodes || 'none'}]`
        );
      } catch (error: any) {
        console.error(`[OPTIMIZED-V2] Error upserting cruise ${cruiseId}:`, error.message);
        console.error('[OPTIMIZED-V2] Cruise data causing error:', {
          id: cruiseData.id,
          marketId: cruiseData.marketId,
          ownerId: cruiseData.ownerId,
          marketIdRaw: data.marketid,
          ownerIdRaw: data.ownerid,
        });
        // Continue processing - don't fail the whole batch
        this.stats.errors.push(`Cruise ${cruiseId}: ${error.message}`);
        return true; // Return true to indicate we processed the file even if there was an error
      }

      // Update pricing if available (pass lineId for Riviera Travel fix)
      await this.updatePricing(cruiseId, data, file.lineId);

      this.stats.filesProcessed++;
      // Update global stats if runId is provided
      if (runId && WebhookProcessorOptimizedV2.statsTracker) {
        await WebhookProcessorOptimizedV2.statsTracker.incrementStat(runId, 'filesProcessed');
      }
      return true; // Successfully processed
    } catch (error) {
      console.error(`[OPTIMIZED-V2] Failed to process ${file.path}:`, error);
      this.stats.errors.push(`${file.path}: ${error}`);
      return false; // Failed to process
    } finally {
      this.releaseFtpConnection(conn);
    }
  }

  private async updatePricing(cruiseId: string, data: any, lineId: number): Promise<void> {
    try {
      // Extract pricing from Traveltek's structure
      let cheapestData: any = {};

      // Helper function to parse and validate prices with Riviera Travel fix
      const parsePriceWithValidation = (value: any, cabinType: string = 'cabin'): number | null => {
        if (!value) return null;
        let parsed = parseFloat(String(value));
        if (isNaN(parsed)) return null;

        // Fix Riviera Travel prices (they come in pence×10 or cents×100 from Traveltek FTP)
        if (lineId === 329) {
          parsed = parsed / 1000;
        }

        // Validate: no negative prices
        if (parsed < 0) {
          console.warn(
            `[PRICE-VALIDATION] Negative ${cabinType} price: $${parsed} for cruise ${cruiseId}, setting to null`
          );
          return null;
        }

        return parsed > 0 ? parsed : null;
      };

      // IMPORTANT: Pricing priority has been updated to fix pricing mismatches
      // The direct cheapestX fields from FTP are the authoritative prices
      // cheapest.combined may contain stale cached data

      // First priority: Direct cheapestX fields from FTP (MOST RELIABLE)
      if (
        data.cheapestinside !== undefined ||
        data.cheapestoutside !== undefined ||
        data.cheapestbalcony !== undefined ||
        data.cheapestsuite !== undefined
      ) {
        // Handle both direct values (strings/numbers) and objects with price property
        const extractPrice = (value: any, cabinType: string): number | null => {
          if (value === undefined || value === null) return null;

          // If it's an object with a price property, extract it
          let rawValue = value;
          if (typeof value === 'object' && value.price !== undefined) {
            rawValue = value.price;
          }

          // Use the unified validation function which handles Riviera fix and negative price validation
          return parsePriceWithValidation(rawValue, cabinType);
        };

        cheapestData = {
          interiorPrice: extractPrice(data.cheapestinside, 'interior'),
          oceanviewPrice: extractPrice(data.cheapestoutside, 'oceanview'),
          balconyPrice: extractPrice(data.cheapestbalcony, 'balcony'),
          suitePrice: extractPrice(data.cheapestsuite, 'suite'),
        };

        // Calculate cheapest overall
        const prices = [
          cheapestData.interiorPrice,
          cheapestData.oceanviewPrice,
          cheapestData.balconyPrice,
          cheapestData.suitePrice,
        ].filter(p => p > 0);
        cheapestData.cheapestPrice = prices.length > 0 ? Math.min(...prices) : null;
      }
      // Second priority: cheapest.combined (only if no direct cheapestX fields)
      else if (data.cheapest && data.cheapest.combined) {
        console.log(
          `[PRICE-WARNING] Using cheapest.combined for cruise ${cruiseId} - may contain cached data`
        );
        cheapestData = {
          // Don't extract cheapestPrice from raw JSON - let database trigger calculate it
          interiorPrice: parsePriceWithValidation(data.cheapest.combined.inside, 'interior'),
          oceanviewPrice: parsePriceWithValidation(data.cheapest.combined.outside, 'oceanview'),
          balconyPrice: parsePriceWithValidation(data.cheapest.combined.balcony, 'balcony'),
          suitePrice: parsePriceWithValidation(data.cheapest.combined.suite, 'suite'),
        };
        // Calculate cheapest overall from cabin prices, not from raw JSON
        const prices = [
          cheapestData.interiorPrice,
          cheapestData.oceanviewPrice,
          cheapestData.balconyPrice,
          cheapestData.suitePrice,
        ].filter(p => p > 0);
        cheapestData.cheapestPrice = prices.length > 0 ? Math.min(...prices) : null;
      }
      // Third priority: cheapest.prices
      else if (data.cheapest && data.cheapest.prices) {
        console.log(
          `[PRICE-WARNING] Using cheapest.prices for cruise ${cruiseId} - may not reflect FTP prices`
        );
        cheapestData = {
          interiorPrice: parsePriceWithValidation(data.cheapest.prices.inside, 'interior'),
          oceanviewPrice: parsePriceWithValidation(data.cheapest.prices.outside, 'oceanview'),
          balconyPrice: parsePriceWithValidation(data.cheapest.prices.balcony, 'balcony'),
          suitePrice: parsePriceWithValidation(data.cheapest.prices.suite, 'suite'),
        };
        // Calculate cheapest overall
        const prices = [
          cheapestData.interiorPrice,
          cheapestData.oceanviewPrice,
          cheapestData.balconyPrice,
          cheapestData.suitePrice,
        ].filter(p => p > 0);
        cheapestData.cheapestPrice = prices.length > 0 ? Math.min(...prices) : null;
      }
      // Fallback: Try to extract from prices/cachedprices structure
      else if (data.prices || data.cachedprices) {
        const priceSource = data.cachedprices || data.prices;
        cheapestData = await this.extractPricesFromNestedStructure(priceSource);
      }

      // Clean up zero values
      Object.keys(cheapestData).forEach(key => {
        if (cheapestData[key] === 0 || cheapestData[key] === null) {
          cheapestData[key] = null;
        }
      });

      // Store the combined pricing structure in raw_json
      // Helper to extract price from either direct value or object with price property
      const getPriceValue = (value: any): string | null => {
        if (!value) return null;
        if (typeof value === 'string' || typeof value === 'number') {
          return value.toString();
        }
        if (typeof value === 'object' && value.price) {
          return value.price.toString();
        }
        return null;
      };

      const combinedPricing = {
        inside:
          data.cheapest?.combined?.inside ||
          data.cheapest?.cachedprices?.inside ||
          getPriceValue(data.cheapestinside) ||
          null,
        outside:
          data.cheapest?.combined?.outside ||
          data.cheapest?.cachedprices?.outside ||
          getPriceValue(data.cheapestoutside) ||
          null,
        balcony:
          data.cheapest?.combined?.balcony ||
          data.cheapest?.cachedprices?.balcony ||
          getPriceValue(data.cheapestbalcony) ||
          null,
        suite:
          data.cheapest?.combined?.suite ||
          data.cheapest?.cachedprices?.suite ||
          getPriceValue(data.cheapestsuite) ||
          null,
        insidepricecode:
          data.cheapest?.combined?.insidepricecode || data.cheapestinsidepricecode || null,
        outsidepricecode:
          data.cheapest?.combined?.outsidepricecode || data.cheapestoutsidepricecode || null,
        balconypricecode:
          data.cheapest?.combined?.balconypricecode || data.cheapestbalconypricecode || null,
        suitepricecode:
          data.cheapest?.combined?.suitepricecode || data.cheapestsuitepricecode || null,
        insidesource: data.cheapest?.combined?.insidesource || 'prices',
        outsidesource: data.cheapest?.combined?.outsidesource || 'prices',
        balconysource: data.cheapest?.combined?.balconysource || 'prices',
        suitesource: data.cheapest?.combined?.suitesource || 'prices',
      };

      // Update cruises table with basic pricing AND combined structure
      if (
        cheapestData.interiorPrice ||
        cheapestData.oceanviewPrice ||
        cheapestData.balconyPrice ||
        cheapestData.suitePrice
      ) {
        // Capture price snapshot BEFORE updating (for historical tracking)
        try {
          const batchId = await priceHistoryService.captureSnapshot(cruiseId, 'webhook_update');
          console.log(
            `[OPTIMIZED-V2] Captured price snapshot for cruise ${cruiseId}, batch: ${batchId}`
          );
        } catch (snapshotError) {
          console.error(
            `[OPTIMIZED-V2] Failed to capture price snapshot for cruise ${cruiseId}:`,
            snapshotError
          );
          // Don't fail the entire update if snapshot fails
        }

        // Get existing raw_json first
        const existingCruise = await db
          .select({ rawData: cruises.rawData })
          .from(cruises)
          .where(eq(cruises.cruiseId, cruiseId))
          .limit(1);

        const currentRawJson = existingCruise[0]?.rawData || {};

        // IMPORTANT: Preserve ALL data from the original file, not just pricing
        // The 'data' parameter contains the complete cruise information including itinerary
        // We should use it as the base and only update pricing-specific fields
        const updatedRawJson = {
          ...data, // Start with the COMPLETE data from FTP file
          cheapest: {
            ...data.cheapest,
            combined: combinedPricing,
            prices: data.cheapest?.prices,
            cachedprices: data.cheapest?.cachedprices,
          },
          // These fields are already in 'data', but we ensure they're present
          prices: data.prices,
          cabins: data.cabins,
          cheapestinside: data.cheapestinside,
          cheapestoutside: data.cheapestoutside,
          cheapestbalcony: data.cheapestbalcony,
          cheapestsuite: data.cheapestsuite,
          cheapestinsidepricecode: data.cheapestinsidepricecode,
          cheapestoutsidepricecode: data.cheapestoutsidepricecode,
          cheapestbalconypricecode: data.cheapestbalconypricecode,
          cheapestsuitepricecode: data.cheapestsuitepricecode,
        };

        await db
          .update(cruises)
          .set({
            interiorPrice:
              cheapestData.interiorPrice !== null ? cheapestData.interiorPrice.toString() : null,
            oceanviewPrice:
              cheapestData.oceanviewPrice !== null ? cheapestData.oceanviewPrice.toString() : null,
            balconyPrice:
              cheapestData.balconyPrice !== null ? cheapestData.balconyPrice.toString() : null,
            suitePrice:
              cheapestData.suitePrice !== null ? cheapestData.suitePrice.toString() : null,
            cheapestPrice:
              cheapestData.cheapestPrice !== null ? cheapestData.cheapestPrice.toString() : null,
            rawData: this.ensureValidRawData(updatedRawJson),
            updatedAt: new Date(),
          })
          .where(eq(cruises.id, cruiseId));

        // Log what cabin/price data we're storing
        const hasCabins = !!data.cabins && Object.keys(data.cabins).length > 0;
        const hasPrices = !!data.prices && Object.keys(data.prices).length > 0;
        const priceCodes = [
          data.cheapestinsidepricecode ? 'inside' : null,
          data.cheapestoutsidepricecode ? 'outside' : null,
          data.cheapestbalconypricecode ? 'balcony' : null,
          data.cheapestsuitepricecode ? 'suite' : null,
        ]
          .filter(Boolean)
          .join(',');

        console.log(
          `[OPTIMIZED-V2] Updated cruise pricing for ${cruiseId} - cabins:${hasCabins}, prices:${hasPrices}, codes:[${priceCodes || 'none'}]`
        );
      }

      // Now update the cheapest_pricing table with full details
      if (
        cheapestData.cheapestPrice ||
        cheapestData.interiorPrice ||
        cheapestData.oceanviewPrice ||
        cheapestData.balconyPrice ||
        cheapestData.suitePrice
      ) {
        // Prepare full cheapest pricing data
        const cheapestPricingData = {
          cruiseId: cruiseId,
          cheapestPrice: cheapestData.cheapestPrice,

          // Interior details
          interiorPrice: cheapestData.interiorPrice,
          interiorTaxes: data.cheapestinside?.taxes || null,
          interiorNcf: data.cheapestinside?.ncf || null,
          interiorGratuity: data.cheapestinside?.gratuity || null,
          interiorFuel: data.cheapestinside?.fuel || null,
          interiorNonComm: data.cheapestinside?.noncomm || null,
          interiorPriceCode: data.cheapestinsidepricecode || null,

          // Oceanview details
          oceanviewPrice: cheapestData.oceanviewPrice,
          oceanviewTaxes: data.cheapestoutside?.taxes || null,
          oceanviewNcf: data.cheapestoutside?.ncf || null,
          oceanviewGratuity: data.cheapestoutside?.gratuity || null,
          oceanviewFuel: data.cheapestoutside?.fuel || null,
          oceanviewNonComm: data.cheapestoutside?.noncomm || null,
          oceanviewPriceCode: data.cheapestoutsidepricecode || null,

          // Balcony details
          balconyPrice: cheapestData.balconyPrice,
          balconyTaxes: data.cheapestbalcony?.taxes || null,
          balconyNcf: data.cheapestbalcony?.ncf || null,
          balconyGratuity: data.cheapestbalcony?.gratuity || null,
          balconyFuel: data.cheapestbalcony?.fuel || null,
          balconyNonComm: data.cheapestbalcony?.noncomm || null,
          balconyPriceCode: data.cheapestbalconypricecode || null,

          // Suite details
          suitePrice: cheapestData.suitePrice,
          suiteTaxes: data.cheapestsuite?.taxes || null,
          suiteNcf: data.cheapestsuite?.ncf || null,
          suiteGratuity: data.cheapestsuite?.gratuity || null,
          suiteFuel: data.cheapestsuite?.fuel || null,
          suiteNonComm: data.cheapestsuite?.noncomm || null,
          suitePriceCode: data.cheapestsuitepricecode || null,

          currency: data.currency || 'USD',
          lastUpdated: new Date(),
        };

        // Upsert into cheapest_pricing table
        await db
          .insert(cheapestPricing)
          .values(cheapestPricingData)
          .onConflictDoUpdate({
            target: cheapestPricing.cruiseId,
            set: {
              ...cheapestPricingData,
              lastUpdated: new Date(),
            },
          });

        console.log(`[OPTIMIZED-V2] Updated cheapest_pricing for cruise ${cruiseId}`);

        // Calculate price changes AFTER updating (for historical tracking)
        try {
          // Get the batch ID from the earlier snapshot capture
          // We'll use the most recent batch for this cruise
          const recentSnapshots = await priceHistoryService.getHistoricalPrices({
            cruiseId: cruiseId,
            limit: 1,
          });

          if (recentSnapshots.length > 0 && recentSnapshots[0].batchId) {
            await priceHistoryService.calculatePriceChanges(recentSnapshots[0].batchId);
            console.log(`[OPTIMIZED-V2] Calculated price changes for cruise ${cruiseId}`);
          }
        } catch (changeError) {
          console.error(
            `[OPTIMIZED-V2] Failed to calculate price changes for cruise ${cruiseId}:`,
            changeError
          );
          // Don't fail the entire update if price change calculation fails
        }
      }
    } catch (error) {
      console.error(`[OPTIMIZED-V2] Failed to update pricing for ${cruiseId}:`, error);
    }
  }

  // Helper function to extract prices from nested rate/cabin/occupancy structure
  private async extractPricesFromNestedStructure(
    priceData: any,
    cruiseLineId?: number
  ): Promise<any> {
    const result = {
      interiorPrice: null as number | null,
      oceanviewPrice: null as number | null,
      balconyPrice: null as number | null,
      suitePrice: null as number | null,
      cheapestPrice: null as number | null,
    };

    if (!priceData || typeof priceData !== 'object') {
      return result;
    }

    // Check if this is NCL (cruise line ID 17) and fix pricing if needed
    const isNCL = cruiseLineId === 17;
    if (isNCL) {
      priceData = processNCLPricingData(priceData, cruiseLineId);
    }

    // Iterate through rate codes
    for (const rateCode in priceData) {
      const cabins = priceData[rateCode];
      if (!cabins || typeof cabins !== 'object') continue;

      // Iterate through cabin codes
      for (const cabinCode in cabins) {
        const occupancies = cabins[cabinCode];
        if (!occupancies || typeof occupancies !== 'object') continue;

        // Find the cheapest price for this cabin
        let cabinPrice = null;
        for (const occupancy in occupancies) {
          const priceInfo = occupancies[occupancy];

          // For NCL, use our special extraction logic
          if (isNCL && priceInfo) {
            const nclPrice = getNCLCheapestPrice(priceInfo);
            if (nclPrice && nclPrice > 0 && (!cabinPrice || nclPrice < cabinPrice)) {
              cabinPrice = nclPrice;
            }
          } else if (priceInfo && priceInfo.price) {
            const price = parseFloat(priceInfo.price);
            if (price > 0 && (!cabinPrice || price < cabinPrice)) {
              cabinPrice = price;
            }
          }
        }

        if (!cabinPrice) continue;

        // Categorize cabin based on code or type
        const cabinUpper = cabinCode.toUpperCase();
        const cabinType = occupancies['101']?.cabintype?.toLowerCase() || '';

        if (
          cabinUpper.startsWith('I') ||
          cabinType.includes('interior') ||
          cabinType.includes('inside')
        ) {
          if (!result.interiorPrice || cabinPrice < result.interiorPrice) {
            result.interiorPrice = cabinPrice;
          }
        } else if (
          cabinUpper.startsWith('O') ||
          cabinType.includes('ocean') ||
          cabinType.includes('outside')
        ) {
          if (!result.oceanviewPrice || cabinPrice < result.oceanviewPrice) {
            result.oceanviewPrice = cabinPrice;
          }
        } else if (
          cabinUpper.startsWith('B') ||
          cabinType.includes('balcony') ||
          cabinType.includes('verandah')
        ) {
          if (!result.balconyPrice || cabinPrice < result.balconyPrice) {
            result.balconyPrice = cabinPrice;
          }
        } else if (
          cabinUpper.startsWith('S') ||
          cabinType.includes('suite') ||
          cabinType.includes('penthouse')
        ) {
          if (!result.suitePrice || cabinPrice < result.suitePrice) {
            result.suitePrice = cabinPrice;
          }
        }
      }
    }

    // Calculate overall cheapest
    const allPrices = [
      result.interiorPrice,
      result.oceanviewPrice,
      result.balconyPrice,
      result.suitePrice,
    ].filter(p => p !== null && p > 0) as number[];

    if (allPrices.length > 0) {
      result.cheapestPrice = Math.min(...allPrices);
    }

    return result;
  }

  private async takeSnapshot(lineId: number) {
    try {
      console.log(`[OPTIMIZED-V2] Taking price snapshot for line ${lineId}`);

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

      let snapshotCount = 0;

      // Create snapshots for each cruise with pricing
      for (const cruise of cruisesWithPricing) {
        if (cruise.cruiseId && cruise.cheapestPrice) {
          try {
            // Cast cruise ID to integer for the database
            const cruiseIdInt = parseInt(cruise.cruiseId as string, 10);
            if (isNaN(cruiseIdInt)) {
              console.warn(
                `[OPTIMIZED-V2] Skipping snapshot for non-numeric cruise ID: ${cruise.cruiseId}`
              );
              continue;
            }

            await db.insert(priceSnapshots).values({
              lineId: lineId,
              cruiseId: cruise.cruiseId as string,
              snapshotData: {
                // Store all pricing data in the JSONB column
                snapshotType: 'before',
                staticPrice: cruise.cheapestPrice,
                cachedPrice: cruise.cheapestPrice,
                cheapestCabinPrice: cruise.cheapestPrice,
                // Granular cabin type pricing
                interiorPrice: cruise.interiorPrice,
                oceanviewPrice: cruise.oceanviewPrice,
                balconyPrice: cruise.balconyPrice,
                suitePrice: cruise.suitePrice,
                // Also store the cheapest overall
                cheapestPrice: cruise.cheapestPrice,
                // Meta information
                timestamp: new Date().toISOString(),
                source: 'webhook_processor_v2',
              },
              metadata: {
                lineId: lineId,
                source: 'webhook_processor_v2',
              },
              priceChangeDetected: false,
            });
            snapshotCount++;
          } catch (error) {
            console.error(
              `[OPTIMIZED-V2] Failed to create snapshot for cruise ${cruise.cruiseId}:`,
              error
            );
          }
        }
      }

      console.log(`[OPTIMIZED-V2] Created ${snapshotCount} price snapshots for line ${lineId}`);
      this.stats.priceSnapshotsCreated = snapshotCount;
    } catch (error) {
      console.error(`[OPTIMIZED-V2] Failed to take snapshots for line ${lineId}:`, error);
      // Don't throw - snapshots are not critical to webhook processing
    }
  }

  /**
   * Track batch completion and send Slack notification when all batches are complete
   */
  private async trackBatchCompletion(
    lineId: number,
    runId: string,
    results: { processed: number; failed: number; updated: number },
    batchNumber: number,
    totalBatches: number,
    totalFilesInRun?: number
  ): Promise<void> {
    if (!this.processingJobs.has(runId)) {
      this.processingJobs.set(runId, {
        lineId,
        startTime: new Date(),
        totalFiles: totalFilesInRun || 0,
        processedFiles: 0,
        successful: 0,
        failed: 0,
        errors: [],
        completedBatches: new Set<number>(),
        totalBatches: totalBatches,
      });
    }

    const jobTracking = this.processingJobs.get(runId)!;

    // Update tracking
    jobTracking.processedFiles += results.processed;
    jobTracking.successful += results.updated;
    jobTracking.failed += results.failed;

    // Mark this batch as completed
    jobTracking.completedBatches.add(batchNumber);

    // Update Redis stats for accurate aggregation
    if (WebhookProcessorOptimizedV2.statsTracker) {
      await WebhookProcessorOptimizedV2.statsTracker.incrementStat(
        runId,
        'filesProcessed',
        results.processed
      );
      await WebhookProcessorOptimizedV2.statsTracker.incrementStat(
        runId,
        'cruisesUpdated',
        results.updated
      );
    }

    console.log(
      `[OPTIMIZED-V2] Batch ${batchNumber}/${totalBatches} complete for line ${lineId}. ` +
        `Progress: ${jobTracking.processedFiles}/${jobTracking.totalFiles} files (${Math.round((jobTracking.processedFiles / jobTracking.totalFiles) * 100)}%) - ` +
        `Completed batches: ${jobTracking.completedBatches.size}/${jobTracking.totalBatches}`
    );

    // Run cleanup every 5 batches or on the last batch to prevent memory buildup
    if (batchNumber % 5 === 0 || batchNumber === totalBatches) {
      console.log(`[OPTIMIZED-V2] Running intermediate cleanup after batch ${batchNumber}...`);
      await this.runPostBatchCleanup();
    }

    // Check if all batches have been processed (since they can complete out of order)
    const allBatchesCompleted = jobTracking.completedBatches.size === jobTracking.totalBatches;

    // Check if all files have been processed
    const allFilesProcessed =
      jobTracking.totalFiles > 0 && jobTracking.processedFiles >= jobTracking.totalFiles;

    // Log detailed status for debugging
    console.log(
      `[OPTIMIZED-V2] Batch ${batchNumber}/${totalBatches} completion check - ` +
        `Files: ${jobTracking.processedFiles}/${jobTracking.totalFiles} (${Math.round((jobTracking.processedFiles / jobTracking.totalFiles) * 100)}%) - ` +
        `Batches completed: ${jobTracking.completedBatches.size}/${jobTracking.totalBatches} - ` +
        `All batches done: ${allBatchesCompleted} - All files done: ${allFilesProcessed}`
    );

    // Only proceed with completion check if all batches are done OR all files are processed
    if (!allBatchesCompleted && !allFilesProcessed) {
      console.log(
        `[OPTIMIZED-V2] Not ready for completion check (waiting for more batches), returning early`
      );
      return; // Not ready for completion check yet
    }

    // Either last batch or all files processed - wait for queue to clear
    console.log(
      `[OPTIMIZED-V2] Batch processing milestone reached (batch ${batchNumber}/${totalBatches}), ` +
        `checking for completion...`
    );

    // Wait up to 60 seconds for queue to clear, checking every 5 seconds
    let attemptsLeft = 12; // 12 attempts * 5 seconds = 60 seconds max
    let queueEmpty = false;

    while (attemptsLeft > 0) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const activeCount = await WebhookProcessorOptimizedV2.webhookQueue.getActiveCount();
      const waitingCount = await WebhookProcessorOptimizedV2.webhookQueue.getWaitingCount();
      const delayedCount = await WebhookProcessorOptimizedV2.webhookQueue.getDelayedCount();

      console.log(
        `[OPTIMIZED-V2] Queue check (${13 - attemptsLeft}/12) - ` +
          `Active: ${activeCount}, Waiting: ${waitingCount}, Delayed: ${delayedCount}`
      );

      // Check global stats to see actual progress
      if (WebhookProcessorOptimizedV2.statsTracker) {
        const currentStats = await WebhookProcessorOptimizedV2.statsTracker.getStats(runId);
        console.log(
          `[OPTIMIZED-V2] Global progress: ${currentStats.filesProcessed}/${jobTracking.totalFiles} files`
        );

        // If all files are processed globally, we're done
        if (currentStats.filesProcessed >= jobTracking.totalFiles) {
          queueEmpty = true;
          break;
        }
      }

      if (activeCount === 0 && waitingCount === 0 && delayedCount === 0) {
        queueEmpty = true;
        break;
      }

      attemptsLeft--;
    }

    if (queueEmpty) {
      // All processing complete
      const endTime = new Date();
      const processingTimeMs = endTime.getTime() - jobTracking.startTime.getTime();

      // Get global stats from Redis (aggregated from all workers)
      let globalStats = {
        filesProcessed: 0,
        cruisesUpdated: 0,
        skippedUnchanged: 0,
        priceSnapshotsCreated: 0,
        errors: [] as string[],
      };

      if (WebhookProcessorOptimizedV2.statsTracker) {
        globalStats = await WebhookProcessorOptimizedV2.statsTracker.getStats(runId);
        console.log(`[OPTIMIZED-V2] Retrieved global stats from Redis:`, {
          filesProcessed: globalStats.filesProcessed,
          cruisesUpdated: globalStats.cruisesUpdated,
          skippedUnchanged: globalStats.skippedUnchanged,
        });
      }

      // Send Slack notification with comprehensive global stats
      const result: WebhookProcessingResult = {
        successful: globalStats.cruisesUpdated || jobTracking.successful,
        failed: jobTracking.failed,
        skippedUnchanged: globalStats.skippedUnchanged || this.stats.skippedUnchanged,
        errors: jobTracking.errors,
        startTime: jobTracking.startTime,
        endTime,
        processingTimeMs,
        totalCruises:
          globalStats.filesProcessed || jobTracking.totalFiles || jobTracking.processedFiles,
        priceSnapshotsCreated:
          globalStats.priceSnapshotsCreated || this.stats.priceSnapshotsCreated,
        changeLog: this.stats.changeLog.slice(0, 20), // Include first 20 changes for reference
        // Add batch processing details
        batchDetails: {
          totalBatches,
          filesPerBatch: Math.ceil((jobTracking.totalFiles || 0) / totalBatches),
          completionRate: Math.round(
            (globalStats.filesProcessed / (jobTracking.totalFiles || 1)) * 100
          ),
        },
      };

      await slackService.notifyWebhookProcessingCompleted(
        {
          eventType: 'cruise_line_update',
          lineId,
          timestamp: endTime.toISOString(),
        },
        result
      );

      // Clean up tracking
      this.processingJobs.delete(runId);

      console.log(
        `[OPTIMIZED-V2] All processing complete for line ${lineId}. ` +
          `Final stats: ${globalStats.cruisesUpdated} successful, ${jobTracking.failed} failed, ` +
          `${globalStats.skippedUnchanged} skipped (unchanged), ` +
          `${globalStats.priceSnapshotsCreated} snapshots created, ${processingTimeMs}ms total time`
      );

      // Clean up global stats from Redis
      if (WebhookProcessorOptimizedV2.statsTracker) {
        await WebhookProcessorOptimizedV2.statsTracker.cleanupStats(runId);
      }

      // Log change summary if we have any
      if (this.stats.changeLog.length > 0) {
        const changeSummary: Record<string, number> = {};
        this.stats.changeLog.forEach(log => {
          log.changes.forEach(change => {
            changeSummary[change] = (changeSummary[change] || 0) + 1;
          });
        });
        console.log(`[CHANGE-SUMMARY] Changes detected:`, JSON.stringify(changeSummary));
      }
    } else {
      // Queue didn't clear in time - log warning but still send notification with what we have
      console.warn(
        `[OPTIMIZED-V2] WARNING: Queue did not clear within 60 seconds for line ${lineId}. ` +
          `Sending completion notification anyway.`
      );

      const endTime = new Date();
      const processingTimeMs = endTime.getTime() - jobTracking.startTime.getTime();

      // Get global stats from Redis even if queue didn't clear
      let globalStats = {
        filesProcessed: 0,
        cruisesUpdated: 0,
        skippedUnchanged: 0,
        priceSnapshotsCreated: 0,
        errors: [] as string[],
      };

      if (WebhookProcessorOptimizedV2.statsTracker) {
        globalStats = await WebhookProcessorOptimizedV2.statsTracker.getStats(runId);
        console.log(`[OPTIMIZED-V2] Retrieved partial global stats from Redis:`, {
          filesProcessed: globalStats.filesProcessed,
          cruisesUpdated: globalStats.cruisesUpdated,
          skippedUnchanged: globalStats.skippedUnchanged,
        });
      }

      const result: WebhookProcessingResult = {
        successful: globalStats.cruisesUpdated || jobTracking.successful,
        failed: jobTracking.failed,
        skippedUnchanged: globalStats.skippedUnchanged || this.stats.skippedUnchanged,
        errors: [...jobTracking.errors, { error: 'Queue did not clear within timeout period' }],
        startTime: jobTracking.startTime,
        endTime,
        processingTimeMs,
        totalCruises:
          globalStats.filesProcessed || jobTracking.totalFiles || jobTracking.processedFiles,
        priceSnapshotsCreated:
          globalStats.priceSnapshotsCreated || this.stats.priceSnapshotsCreated,
        changeLog: this.stats.changeLog.slice(0, 20),
        // Add batch details even for timeout case
        batchDetails: {
          totalBatches,
          filesPerBatch: Math.ceil((jobTracking.totalFiles || 0) / totalBatches),
          completionRate: Math.round(
            (globalStats.filesProcessed / (jobTracking.totalFiles || 1)) * 100
          ),
        },
      };

      await slackService.notifyWebhookProcessingCompleted(
        {
          eventType: 'cruise_line_update',
          lineId,
          timestamp: endTime.toISOString(),
        },
        result
      );

      // Clean up tracking
      this.processingJobs.delete(runId);

      // Clean up global stats from Redis
      if (WebhookProcessorOptimizedV2.statsTracker) {
        await WebhookProcessorOptimizedV2.statsTracker.cleanupStats(runId);
      }
    }

    // Run post-batch cleanup to optimize memory
    await this.runPostBatchCleanup();
  }

  /**
   * Run cleanup after batch processing to optimize memory usage
   */
  private async runPostBatchCleanup() {
    try {
      console.log('[OPTIMIZED-V2] Running post-batch cleanup for memory optimization...');

      // 1. Clean up old departed cruises (more aggressive)
      // Only delete cruises that don't have any references from quote_requests
      const departedCleanup = await db.execute(sql`
        DELETE FROM cruises
        WHERE sailing_date < NOW() - INTERVAL '7 days'
        AND updated_at < NOW() - INTERVAL '3 days'
        AND NOT EXISTS (
          SELECT 1 FROM quote_requests WHERE quote_requests.cruise_id = cruises.id
        )
        RETURNING id;
      `);

      if (departedCleanup.rowCount && departedCleanup.rowCount > 0) {
        console.log(`[OPTIMIZED-V2] Cleaned up ${departedCleanup.rowCount} old departed cruises`);
      }

      // 2. Clean up stale cruises that haven't been updated (likely removed from inventory)
      // Only delete cruises that don't have any references from quote_requests
      const staleCleanup = await db.execute(sql`
        DELETE FROM cruises
        WHERE updated_at < NOW() - INTERVAL '7 days'
        AND (sailing_date IS NULL OR sailing_date > NOW() + INTERVAL '365 days')
        AND NOT EXISTS (
          SELECT 1 FROM quote_requests WHERE quote_requests.cruise_id = cruises.id
        )
        RETURNING id;
      `);

      if (staleCleanup.rowCount && staleCleanup.rowCount > 0) {
        console.log(`[OPTIMIZED-V2] Cleaned up ${staleCleanup.rowCount} stale cruises`);
      }

      // 3. Clean up orphaned pricing data
      const pricingCleanup = await db.execute(sql`
        DELETE FROM pricing p
        WHERE NOT EXISTS (
          SELECT 1 FROM cruises c WHERE c.id = p.cruise_id
        )
        RETURNING id;
      `);

      if (pricingCleanup.rowCount && pricingCleanup.rowCount > 0) {
        console.log(
          `[OPTIMIZED-V2] Cleaned up ${pricingCleanup.rowCount} orphaned pricing records`
        );
      }

      // 4. Clean up orphaned itinerary data
      const itineraryCleanup = await db.execute(sql`
        DELETE FROM itineraries i
        WHERE NOT EXISTS (
          SELECT 1 FROM cruises c WHERE c.id = i.cruise_id
        )
        RETURNING id;
      `);

      if (itineraryCleanup.rowCount && itineraryCleanup.rowCount > 0) {
        console.log(
          `[OPTIMIZED-V2] Cleaned up ${itineraryCleanup.rowCount} orphaned itinerary records`
        );
      }

      // 5. Clean up orphaned cabin categories (linked to ships, not cruises)
      const cabinCleanup = await db.execute(sql`
        DELETE FROM cabin_categories cc
        WHERE NOT EXISTS (
          SELECT 1 FROM ships s WHERE s.id = cc.ship_id
        )
        RETURNING ship_id, cabin_code;
      `);

      if (cabinCleanup.rowCount && cabinCleanup.rowCount > 0) {
        console.log(`[OPTIMIZED-V2] Cleaned up ${cabinCleanup.rowCount} orphaned cabin categories`);
      }

      // 6. Run VACUUM ANALYZE on main tables (non-blocking)
      await db.execute(sql`VACUUM (ANALYZE, VERBOSE OFF) cruises;`);
      await db.execute(sql`VACUUM (ANALYZE, VERBOSE OFF) pricing;`);
      await db.execute(sql`VACUUM (ANALYZE, VERBOSE OFF) itineraries;`);
      await db.execute(sql`VACUUM (ANALYZE, VERBOSE OFF) cabin_categories;`);
      console.log('[OPTIMIZED-V2] Ran VACUUM ANALYZE on main tables');

      // 4. Clear Redis memory for completed jobs
      if (WebhookProcessorOptimizedV2.webhookQueue) {
        const completedJobs = await WebhookProcessorOptimizedV2.webhookQueue.getCompleted(0, 1000);
        if (completedJobs.length > 500) {
          // Keep only last 200 completed jobs
          const jobsToRemove = completedJobs.slice(200);
          await Promise.all(jobsToRemove.map(job => job.remove()));
          console.log(
            `[OPTIMIZED-V2] Cleaned up ${jobsToRemove.length} old completed jobs from Redis`
          );
        }
      }

      // 5. Clear caches to prevent memory buildup
      if (WebhookProcessorOptimizedV2.shipCache.size > 0) {
        const shipCacheSize = WebhookProcessorOptimizedV2.shipCache.size;
        WebhookProcessorOptimizedV2.shipCache.clear();
        console.log(`[OPTIMIZED-V2] Cleared ship cache (${shipCacheSize} entries)`);
      }

      if (WebhookProcessorOptimizedV2.checksumCache.size > 1000) {
        const checksumCacheSize = WebhookProcessorOptimizedV2.checksumCache.size;
        WebhookProcessorOptimizedV2.checksumCache.clear();
        console.log(`[OPTIMIZED-V2] Cleared checksum cache (${checksumCacheSize} entries)`);
      }

      // 6. Reset stats for next run
      this.stats = {
        filesProcessed: 0,
        cruisesUpdated: 0,
        skippedUnchanged: 0,
        errors: [],
        priceSnapshotsCreated: 0,
        changeLog: [],
      };

      console.log('[OPTIMIZED-V2] Post-batch cleanup completed successfully');
    } catch (error) {
      console.error('[OPTIMIZED-V2] Error during post-batch cleanup:', error);
      // Don't throw - cleanup errors shouldn't break the main flow
    }
  }
}
