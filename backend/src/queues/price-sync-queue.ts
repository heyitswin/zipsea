import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/environment';
import { priceSyncBatchService } from '../services/price-sync-batch.service';
import logger from '../config/logger';

// Redis connection for queue
const REDIS_AVAILABLE = env.REDIS_URL || env.REDIS_HOST;
let redisConnection: IORedis | null = null;

if (REDIS_AVAILABLE) {
  try {
    if (env.REDIS_URL) {
      redisConnection = new IORedis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    } else if (env.REDIS_HOST && env.REDIS_PORT) {
      redisConnection = new IORedis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    }
    logger.info('✅ Redis connected for price sync queue');
  } catch (error) {
    logger.error('Failed to connect to Redis for price sync queue:', error);
    redisConnection = null;
  }
}

// Create queue only if Redis is available
export const priceSyncQueue = redisConnection ? new Queue('price-sync', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 100, // Keep max 100 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
}) : null;

// Create worker only if Redis is available
export const priceSyncWorker = redisConnection ? new Worker(
  'price-sync',
  async (job: Job) => {
    logger.info(`🔄 Processing price sync job ${job.id}`, job.data);
    
    try {
      const result = await priceSyncBatchService.syncPendingPriceUpdates();
      
      logger.info(`✅ Price sync job ${job.id} completed`, result);
      
      return result;
    } catch (error) {
      logger.error(`❌ Price sync job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Only one sync job at a time
    limiter: {
      max: 1,
      duration: 60000, // Max 1 job per minute
    },
  }
) : null;

// Worker event handlers
if (priceSyncWorker) {
  priceSyncWorker.on('completed', (job) => {
    logger.info(`✅ Price sync job ${job.id} completed successfully`);
  });

  priceSyncWorker.on('failed', (job, err) => {
    logger.error(`❌ Price sync job ${job?.id} failed:`, err);
  });

  priceSyncWorker.on('error', (err) => {
    logger.error('Price sync worker error:', err);
  });
}

/**
 * Queue a price sync job
 */
export async function queuePriceSync(data: { source: string; priority?: number } = { source: 'manual' }): Promise<void> {
  if (!priceSyncQueue) {
    logger.warn('Cannot queue price sync - Redis not available');
    // Fallback: run directly without queue
    await priceSyncBatchService.syncPendingPriceUpdates();
    return;
  }

  try {
    const job = await priceSyncQueue.add(
      'sync-prices',
      {
        ...data,
        timestamp: new Date().toISOString()
      },
      {
        priority: data.priority || 0,
        delay: 0
      }
    );
    
    logger.info(`📋 Queued price sync job ${job.id}`);
  } catch (error) {
    logger.error('Failed to queue price sync:', error);
    // Fallback: run directly
    await priceSyncBatchService.syncPendingPriceUpdates();
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  if (!priceSyncQueue) {
    return { available: false };
  }

  const [waiting, active, completed, failed] = await Promise.all([
    priceSyncQueue.getWaitingCount(),
    priceSyncQueue.getActiveCount(),
    priceSyncQueue.getCompletedCount(),
    priceSyncQueue.getFailedCount(),
  ]);

  return {
    available: true,
    waiting,
    active,
    completed,
    failed,
  };
}

// Graceful shutdown
export async function closePriceSyncQueue(): Promise<void> {
  if (priceSyncWorker) {
    await priceSyncWorker.close();
  }
  if (priceSyncQueue) {
    await priceSyncQueue.close();
  }
  if (redisConnection) {
    redisConnection.disconnect();
  }
}