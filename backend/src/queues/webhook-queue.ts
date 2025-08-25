import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { logger } from '../config/logger';
import { env } from '../config/environment';
import { traveltekWebhookService } from '../services/traveltek-webhook.service';
import { slackService } from '../services/slack.service';
import IORedis from 'ioredis';

// Check if Redis is configured
const REDIS_AVAILABLE = env.REDIS_URL || env.REDIS_HOST;

let redisConnection: IORedis | null = null;

if (REDIS_AVAILABLE) {
  try {
    // Redis connection configuration
    if (env.REDIS_URL) {
      redisConnection = new IORedis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    } else {
      redisConnection = new IORedis({
        host: env.REDIS_HOST || 'localhost',
        port: env.REDIS_PORT || 6379,
        password: env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    }
    logger.info('✅ Redis connection established for BullMQ');
  } catch (error) {
    logger.error('❌ Failed to connect to Redis, queues disabled:', error);
    redisConnection = null;
  }
} else {
  logger.warn('⚠️ Redis not configured, webhook queuing disabled');
}

// Define job data types
export interface WebhookJobData {
  webhookId: string;
  eventType: string;
  lineId?: string;
  payload: any;
  timestamp: string;
}

export interface CruiseUpdateJobData {
  cruiseId: number;
  cruiseCode: string;
  filePath: string;
  webhookEventId: number;
  batchId: string;
  lineId: string;
}

// Create queues (only if Redis is available)
export const webhookQueue = redisConnection ? new Queue<WebhookJobData>('webhook-processing', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 100, // Keep max 100 completed jobs
    },
    removeOnFail: {
      age: 24 * 3600, // Keep failed jobs for 24 hours
    },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
}) : null;

export const cruiseUpdateQueue = redisConnection ? new Queue<CruiseUpdateJobData>('cruise-updates', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: {
      age: 3600,
      count: 500,
    },
    removeOnFail: {
      age: 24 * 3600,
    },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
}) : null;

// Webhook processing worker - handles main webhook orchestration (only if Redis available)
const webhookWorker = redisConnection ? new Worker<WebhookJobData>(
  'webhook-processing',
  async (job: Job<WebhookJobData>) => {
    const { webhookId, eventType, lineId, payload, timestamp } = job.data;
    const startTime = Date.now();
    
    logger.info(`🚀 Processing webhook job ${webhookId}`, {
      eventType,
      lineId,
      jobId: job.id,
    });

    try {
      // Update job progress
      await job.updateProgress(10);

      // Process based on event type
      let result;
      switch (eventType) {
        case 'cruiseline_pricing_updated':
          result = await traveltekWebhookService.handleStaticPricingUpdate(payload);
          break;
        case 'live_pricing_updated':
          result = await traveltekWebhookService.handleLivePricingUpdate(payload);
          break;
        default:
          result = await traveltekWebhookService.handleGenericWebhook(payload);
      }

      await job.updateProgress(100);

      const processingTime = Date.now() - startTime;
      logger.info(`✅ Webhook job completed ${webhookId}`, {
        processingTime,
        result,
        jobId: job.id,
      });

      // Send Slack notification for completion
      if (result && result.success) {
        await slackService.notifyWebhookProcessingCompleted(
          {
            eventType,
            lineId: parseInt(lineId || '0'),
            timestamp: timestamp
          },
          {
            successful: result.cruisesUpdated || 0,
            failed: result.cruisesFailed || 0,
            errors: [],
            startTime: new Date(startTime),
            endTime: new Date(),
            processingTimeMs: processingTime,
            totalCruises: result.cruisesProcessed || 0,
            priceSnapshotsCreated: result.snapshotsCreated || 0
          }
        );
      }

      return result;
    } catch (error) {
      logger.error(`❌ Webhook job failed ${webhookId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        jobId: job.id,
      });

      // Send Slack notification for error
      await slackService.notifySyncError(
        error instanceof Error ? error.message : 'Unknown error',
        `Webhook processing failed for ${lineId || 'Unknown'}`
      );

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 webhooks in parallel
    limiter: {
      max: 10,
      duration: 60000, // Max 10 webhooks per minute
    },
  }
) : null;

// Cruise update worker - handles individual cruise updates (only if Redis available)
const cruiseUpdateWorker = redisConnection ? new Worker<CruiseUpdateJobData>(
  'cruise-updates',
  async (job: Job<CruiseUpdateJobData>) => {
    const { cruiseId, cruiseCode, filePath, webhookEventId, batchId, lineId } = job.data;
    
    logger.debug(`Processing cruise update ${cruiseCode}`, {
      cruiseId,
      jobId: job.id,
    });

    try {
      // Process cruise update
      const result = await traveltekWebhookService.processCruiseUpdate({
        cruiseId,
        cruiseCode,
        filePath,
        webhookEventId,
        batchId,
      });

      return result;
    } catch (error) {
      logger.error(`Failed to process cruise update ${cruiseCode}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        cruiseId,
        jobId: job.id,
      });
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 20, // Process up to 20 cruise updates in parallel
    limiter: {
      max: 50,
      duration: 1000, // Max 50 cruise updates per second
    },
  }
) : null;

// Queue event listeners for monitoring (only if Redis available)
const webhookQueueEvents = redisConnection ? new QueueEvents('webhook-processing', {
  connection: redisConnection,
}) : null;

const cruiseQueueEvents = redisConnection ? new QueueEvents('cruise-updates', {
  connection: redisConnection,
}) : null;

// Monitor webhook queue events
if (webhookQueueEvents) {
  webhookQueueEvents.on('completed', ({ jobId, returnvalue }) => {
  logger.debug(`Webhook job ${jobId} completed`, { returnvalue });
  });

  webhookQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Webhook job ${jobId} failed`, { failedReason });
  });
}

// Monitor cruise update queue events
if (cruiseQueueEvents) {
  cruiseQueueEvents.on('completed', ({ jobId }) => {
  logger.debug(`Cruise update job ${jobId} completed`);
  });

  cruiseQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Cruise update job ${jobId} failed`, { failedReason });
  });
}

// Error handlers for workers
if (webhookWorker) {
  webhookWorker.on('error', (error) => {
  logger.error('Webhook worker error', { error });
  });
}

if (cruiseUpdateWorker) {
  cruiseUpdateWorker.on('error', (error) => {
  logger.error('Cruise update worker error', { error });
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down queue workers...');
  if (webhookWorker) await webhookWorker.close();
  if (cruiseUpdateWorker) await cruiseUpdateWorker.close();
  if (webhookQueue) await webhookQueue.close();
  if (cruiseUpdateQueue) await cruiseUpdateQueue.close();
  if (redisConnection) await redisConnection.quit();
});

// Queue management functions
export const getQueueStats = async () => {
  if (!webhookQueue || !cruiseUpdateQueue) {
    return {
      webhook: { active: 0, completed: 0, failed: 0, waiting: 0, delayed: 0 },
      cruiseUpdates: { active: 0, completed: 0, failed: 0, waiting: 0, delayed: 0 },
    };
  }
  
  const [webhookStats, cruiseStats] = await Promise.all([
    webhookQueue.getJobCounts(),
    cruiseUpdateQueue.getJobCounts(),
  ]);

  return {
    webhook: webhookStats,
    cruiseUpdates: cruiseStats,
  };
};

export const clearCompletedJobs = async () => {
  if (!webhookQueue || !cruiseUpdateQueue) {
    return;
  }
  
  await Promise.all([
    webhookQueue.clean(0, 1000, 'completed'),
    cruiseUpdateQueue.clean(0, 1000, 'completed'),
  ]);
};

export const retryFailedJobs = async () => {
  if (!webhookQueue || !cruiseUpdateQueue) {
    return {
      webhookRetried: 0,
      cruiseRetried: 0,
    };
  }
  
  const [webhookFailed, cruiseFailed] = await Promise.all([
    webhookQueue.getFailed(0, 100),
    cruiseUpdateQueue.getFailed(0, 100),
  ]);

  for (const job of webhookFailed) {
    await job.retry();
  }

  for (const job of cruiseFailed) {
    await job.retry();
  }

  return {
    webhookRetried: webhookFailed.length,
    cruiseRetried: cruiseFailed.length,
  };
};