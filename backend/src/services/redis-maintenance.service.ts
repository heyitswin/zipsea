import { Queue } from 'bullmq';
import Redis from 'ioredis';
import cron from 'node-cron';

export class RedisMaintenanceService {
  private redis: Redis;
  private webhookQueue: Queue;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.webhookQueue = new Queue('webhook-processor', {
      connection: {
        host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
        port: process.env.REDIS_URL ? parseInt(new URL(process.env.REDIS_URL).port) || 6379 : 6379,
        password: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).password : undefined,
      },
    });
  }

  startMaintenanceCron() {
    // Run cleanup every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      console.log('[Redis Maintenance] Starting scheduled cleanup...');
      await this.cleanupOldJobs();
      await this.checkMemoryUsage();
    });

    // Check memory every hour
    cron.schedule('0 * * * *', async () => {
      await this.checkMemoryUsage();
    });

    console.log('[Redis Maintenance] Cron jobs scheduled');
  }

  async cleanupOldJobs() {
    try {
      // Clean completed jobs older than 12 hours
      const cleaned = await this.webhookQueue.clean(
        12 * 60 * 60 * 1000, // 12 hours
        500, // limit
        'completed'
      );

      // Clean failed jobs older than 3 days
      const cleanedFailed = await this.webhookQueue.clean(
        3 * 24 * 60 * 60 * 1000, // 3 days
        500,
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

      // Alert if approaching limit
      if (percentage > 70) {
        console.warn(`[Redis Maintenance] ⚠️ Memory usage above 70%! Running emergency cleanup...`);
        await this.emergencyCleanup();
      }
    } catch (error) {
      console.error('[Redis Maintenance] Memory check error:', error);
    }
  }

  async emergencyCleanup() {
    try {
      // More aggressive cleanup when memory is high
      await this.webhookQueue.clean(
        6 * 60 * 60 * 1000, // 6 hours
        1000,
        'completed'
      );

      await this.webhookQueue.clean(
        24 * 60 * 60 * 1000, // 1 day
        1000,
        'failed'
      );

      console.log('[Redis Maintenance] Emergency cleanup completed');
    } catch (error) {
      console.error('[Redis Maintenance] Emergency cleanup error:', error);
    }
  }

  async shutdown() {
    await this.webhookQueue.close();
    this.redis.disconnect();
  }
}

// Export singleton instance
export const redisMaintenanceService = new RedisMaintenanceService();
