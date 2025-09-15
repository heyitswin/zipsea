/**
 * Global stats tracker for webhook processing using Redis
 * Ensures accurate stats across multiple worker instances
 */

import Redis from 'ioredis';

export interface WebhookStats {
  filesProcessed: number;
  cruisesUpdated: number;
  skippedUnchanged: number;
  priceSnapshotsCreated: number;
  errors: string[];
}

export class WebhookStatsTracker {
  private redis: Redis;
  private keyPrefix = 'webhook:stats:';

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  /**
   * Initialize stats for a new run
   */
  async initStats(runId: string): Promise<void> {
    const key = `${this.keyPrefix}${runId}`;
    await this.redis.hmset(key, {
      filesProcessed: 0,
      cruisesUpdated: 0,
      skippedUnchanged: 0,
      priceSnapshotsCreated: 0,
      errors: JSON.stringify([]),
    });
    // Set expiration to 1 hour
    await this.redis.expire(key, 3600);
  }

  /**
   * Increment a specific stat
   */
  async incrementStat(runId: string, stat: keyof WebhookStats, amount: number = 1): Promise<void> {
    const key = `${this.keyPrefix}${runId}`;
    if (stat === 'errors') {
      throw new Error('Use addError method for errors');
    }
    await this.redis.hincrby(key, stat, amount);
  }

  /**
   * Add an error to the error list
   */
  async addError(runId: string, error: string): Promise<void> {
    const key = `${this.keyPrefix}${runId}`;
    const currentErrors = await this.redis.hget(key, 'errors');
    const errors = currentErrors ? JSON.parse(currentErrors) : [];
    errors.push(error);
    await this.redis.hset(key, 'errors', JSON.stringify(errors));
  }

  /**
   * Get all stats for a run
   */
  async getStats(runId: string): Promise<WebhookStats> {
    const key = `${this.keyPrefix}${runId}`;
    const stats = await this.redis.hgetall(key);

    if (!stats || Object.keys(stats).length === 0) {
      return {
        filesProcessed: 0,
        cruisesUpdated: 0,
        skippedUnchanged: 0,
        priceSnapshotsCreated: 0,
        errors: [],
      };
    }

    return {
      filesProcessed: parseInt(stats.filesProcessed || '0', 10),
      cruisesUpdated: parseInt(stats.cruisesUpdated || '0', 10),
      skippedUnchanged: parseInt(stats.skippedUnchanged || '0', 10),
      priceSnapshotsCreated: parseInt(stats.priceSnapshotsCreated || '0', 10),
      errors: JSON.parse(stats.errors || '[]'),
    };
  }

  /**
   * Track a corrupted file
   */
  async trackCorruptedFile(runId: string, filePath: string): Promise<void> {
    const key = `${this.keyPrefix}${runId}:corrupted`;
    await this.redis.sadd(key, filePath);
    // Set expiration to 24 hours for corrupted file tracking
    await this.redis.expire(key, 86400);
  }

  /**
   * Get list of corrupted files for a run
   */
  async getCorruptedFiles(runId: string): Promise<string[]> {
    const key = `${this.keyPrefix}${runId}:corrupted`;
    return await this.redis.smembers(key);
  }

  /**
   * Clean up stats for a run
   */
  async cleanupStats(runId: string): Promise<void> {
    const key = `${this.keyPrefix}${runId}`;
    const corruptedKey = `${this.keyPrefix}${runId}:corrupted`;
    await this.redis.del(key);
    await this.redis.del(corruptedKey);
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}
