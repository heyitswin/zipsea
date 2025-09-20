import { env } from '../config/environment'; // Load environment variables first
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import cron from 'node-cron';

export class RedisMaintenanceService {
  private redis: Redis;
  private webhookQueue: Queue;
  private initialized = false;

  constructor() {
    this.initializeWithRetry();
  }

  private async initializeWithRetry(retries = 5) {
    for (let i = 0; i < retries; i++) {
      try {
        this.redis = new Redis(env.REDIS_URL!, {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          retryStrategy: times => {
            const delay = Math.min(times * 50, 2000);
            console.log(`[Redis Maintenance] Retry attempt ${times}, waiting ${delay}ms`);
            return delay;
          },
        });

        // Wait for Redis to be ready
        await this.redis.ping();
        console.log('[Redis Maintenance] Redis connection established');

        this.webhookQueue = new Queue('webhook-processor', {
          connection: {
            host: env.REDIS_URL ? new URL(env.REDIS_URL).hostname : 'localhost',
            port: env.REDIS_URL ? parseInt(new URL(env.REDIS_URL).port) || 6379 : 6379,
            password: env.REDIS_URL ? new URL(env.REDIS_URL).password : undefined,
          },
        });

        this.initialized = true;
        break;
      } catch (error) {
        console.error(
          `[Redis Maintenance] Failed to initialize (attempt ${i + 1}/${retries}):`,
          error
        );
        if (i === retries - 1) {
          console.error(
            '[Redis Maintenance] Max retries reached. Service will run without Redis maintenance.'
          );
        } else {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
        }
      }
    }
  }

  startMaintenanceCron() {
    if (!this.initialized) {
      console.log('[Redis Maintenance] Service not initialized, skipping cron setup');
      return;
    }

    // Run cleanup daily at 3 AM (noeviction policy means this is just for efficiency, not critical)
    cron.schedule('0 3 * * *', async () => {
      if (!this.initialized) return;
      console.log('[Redis Maintenance] Starting daily cleanup...');
      await this.cleanupOldJobs();
      await this.checkMemoryUsage();
    });

    console.log('[Redis Maintenance] Daily cleanup scheduled for 3 AM');
  }

  async cleanupOldJobs() {
    if (!this.initialized) return;
    try {
      // Clean completed jobs older than 24 hours (less aggressive since noeviction is enabled)
      const cleaned = await this.webhookQueue.clean(
        24 * 60 * 60 * 1000, // 24 hours
        1000, // higher limit for daily cleanup
        'completed'
      );

      // Clean failed jobs older than 7 days
      const cleanedFailed = await this.webhookQueue.clean(
        7 * 24 * 60 * 60 * 1000, // 7 days
        1000,
        'failed'
      );

      console.log(
        `[Redis Maintenance] Cleaned ${cleaned.length} completed, ${cleanedFailed.length} failed jobs`
      );
    } catch (error) {
      console.error('[Redis Maintenance] Cleanup error:', error);
    }
  }

  async checkMemoryUsage() {
    if (!this.initialized) return;
    try {
      const info = await this.redis.info('memory');
      const lines = info.split('\r\n');
      const stats: any = {};

      lines.forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = value;
        }
      });

      const usedMemory = parseInt(stats.used_memory) / 1024 / 1024; // MB
      const maxMemory = 375; // Starter plan limit
      const percentage = (usedMemory / maxMemory) * 100;

      console.log(
        `[Redis Maintenance] Memory: ${usedMemory.toFixed(1)}MB / ${maxMemory}MB (${percentage.toFixed(1)}%)`
      );

      // Log warning if approaching limit (no emergency cleanup needed with noeviction)
      if (percentage > 85) {
        console.warn(`[Redis Maintenance] ⚠️ Memory usage above 85% (${usedMemory.toFixed(1)}MB)`);
        console.log('[Redis Maintenance] Consider running manual cleanup if needed');
      }
    } catch (error) {
      console.error('[Redis Maintenance] Memory check error:', error);
    }
  }

  async shutdown() {
    if (this.webhookQueue) {
      await this.webhookQueue.close();
    }
    if (this.redis) {
      this.redis.disconnect();
    }
  }
}

// Export singleton instance
export const redisMaintenanceService = new RedisMaintenanceService();
