import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { logger } from '../config/logger';
import { env } from '../config/environment';
import { traveltekWebhookService } from '../services/traveltek-webhook.service';
import { slackService } from '../services/slack.service';
import IORedis from 'ioredis';

// Redis connection configuration
const redisConnection = new IORedis({
  host: env.REDIS_HOST || 'localhost',
  port: env.REDIS_PORT || 6379,
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

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

// Create queues
export const webhookQueue = new Queue<WebhookJobData>('webhook-processing', {
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
});

export const cruiseUpdateQueue = new Queue<CruiseUpdateJobData>('cruise-updates', {
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
});

// Webhook processing worker - handles main webhook orchestration
const webhookWorker = new Worker<WebhookJobData>(
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
        await slackService.notifyWebhookProcessingCompleted({
          webhookId,
          lineId: lineId || 'Unknown',
          cruisesProcessed: result.cruisesProcessed || 0,
          cruisesUpdated: result.cruisesUpdated || 0,
          cruisesFailed: result.cruisesFailed || 0,
          processingTimeMs: processingTime,
          snapshotsCreated: result.snapshotsCreated || 0,
        });
      }

      return result;
    } catch (error) {
      logger.error(`❌ Webhook job failed ${webhookId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        jobId: job.id,
      });

      // Send Slack notification for error
      await slackService.notifySyncError({
        error: error instanceof Error ? error : new Error('Unknown error'),
        context: `Webhook processing failed for ${lineId || 'Unknown'}`,
        details: { webhookId, eventType },
      });

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
);

// Cruise update worker - handles individual cruise updates
const cruiseUpdateWorker = new Worker<CruiseUpdateJobData>(
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
);

// Queue event listeners for monitoring
const webhookQueueEvents = new QueueEvents('webhook-processing', {
  connection: redisConnection,
});

const cruiseQueueEvents = new QueueEvents('cruise-updates', {
  connection: redisConnection,
});

// Monitor webhook queue events
webhookQueueEvents.on('completed', ({ jobId, returnvalue }) => {
  logger.debug(`Webhook job ${jobId} completed`, { returnvalue });
});

webhookQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Webhook job ${jobId} failed`, { failedReason });
});

// Monitor cruise update queue events
cruiseQueueEvents.on('completed', ({ jobId }) => {
  logger.debug(`Cruise update job ${jobId} completed`);
});

cruiseQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Cruise update job ${jobId} failed`, { failedReason });
});

// Error handlers for workers
webhookWorker.on('error', (error) => {
  logger.error('Webhook worker error', { error });
});

cruiseUpdateWorker.on('error', (error) => {
  logger.error('Cruise update worker error', { error });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down queue workers...');
  await webhookWorker.close();
  await cruiseUpdateWorker.close();
  await webhookQueue.close();
  await cruiseUpdateQueue.close();
  await redisConnection.quit();
});

// Queue management functions
export const getQueueStats = async () => {
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
  await Promise.all([
    webhookQueue.clean(0, 1000, 'completed'),
    cruiseUpdateQueue.clean(0, 1000, 'completed'),
  ]);
};

export const retryFailedJobs = async () => {
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