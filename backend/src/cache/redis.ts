import { createClient, RedisClientType } from 'redis';
import { env, redisConfig } from '../config/environment';
import logger, { cacheLogger, logCacheOperation } from '../config/logger';

class RedisClient {
  private client: RedisClientType;
  private isConnected = false;

  constructor() {
    // Only create client if REDIS_URL is configured
    if (env.REDIS_URL) {
      this.client = createClient({
        url: env.REDIS_URL,
        ...redisConfig,
      }) as RedisClientType;

      this.setupEventHandlers();
    } else {
      cacheLogger.warn('Redis URL not configured - cache disabled');
      this.client = null as any;
    }
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      cacheLogger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      cacheLogger.info('Redis client ready to receive commands');
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      cacheLogger.error('Redis client error', { error });
    });

    this.client.on('end', () => {
      this.isConnected = false;
      cacheLogger.info('Redis client connection ended');
    });

    this.client.on('reconnecting', () => {
      cacheLogger.info('Redis client reconnecting');
    });
  }

  async connect(): Promise<void> {
    if (!this.client) {
      cacheLogger.warn('Redis client not initialized - skipping connection');
      return;
    }
    try {
      await this.client.connect();
      cacheLogger.info('Redis connection established successfully');
    } catch (error) {
      cacheLogger.error('Failed to connect to Redis', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      await this.client.quit();
      this.isConnected = false;
      cacheLogger.info('Redis connection closed');
    } catch (error) {
      cacheLogger.error('Error closing Redis connection', { error });
    }
  }

  async ping(): Promise<string> {
    if (!this.client) return 'PONG';
    return await this.client.ping();
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      const value = await this.client.get(key);
      logCacheOperation(value ? 'hit' : 'miss', key);
      return value;
    } catch (error) {
      cacheLogger.error('Redis GET error', { key, error });
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.client) return;
    try {
      if (ttl) {
        await this.client.setEx(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
      logCacheOperation('set', key, ttl);
    } catch (error) {
      cacheLogger.error('Redis SET error', { key, ttl, error });
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
      logCacheOperation('del', key);
    } catch (error) {
      cacheLogger.error('Redis DEL error', { key, error });
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      cacheLogger.error('Redis EXISTS error', { key, error });
      return false;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.client) return [];
    try {
      // Use SCAN instead of KEYS for better performance
      const keys: string[] = [];
      let cursor = 0;
      
      do {
        const result = await this.client.scan(cursor, {
          MATCH: pattern,
          COUNT: 100
        });
        cursor = result.cursor;
        keys.push(...result.keys);
      } while (cursor !== 0);
      
      return keys;
    } catch (error) {
      cacheLogger.error('Redis SCAN error', { pattern, error });
      return [];
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.client) return -1;
    try {
      return await this.client.ttl(key);
    } catch (error) {
      cacheLogger.error('Redis TTL error', { key, error });
      return -1;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.expire(key, seconds);
    } catch (error) {
      cacheLogger.error('Redis EXPIRE error', { key, seconds, error });
    }
  }

  async flushAll(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.flushAll();
      cacheLogger.info('Redis cache flushed');
    } catch (error) {
      cacheLogger.error('Redis FLUSHALL error', { error });
    }
  }

  async mGet(keys: string[]): Promise<(string | null)[]> {
    if (!this.client) return keys.map(() => null);
    try {
      return await this.client.mGet(keys);
    } catch (error) {
      cacheLogger.error('Redis MGET error', { keys, error });
      return keys.map(() => null);
    }
  }

  async mSet(keyValuePairs: Record<string, string>): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.mSet(keyValuePairs);
    } catch (error) {
      cacheLogger.error('Redis MSET error', { keyValuePairs, error });
    }
  }

  async hGet(key: string, field: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      return await this.client.hGet(key, field);
    } catch (error) {
      cacheLogger.error('Redis HGET error', { key, field, error });
      return null;
    }
  }

  async hSet(key: string, field: string, value: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.hSet(key, field, value);
    } catch (error) {
      cacheLogger.error('Redis HSET error', { key, field, error });
    }
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    if (!this.client) return {};
    try {
      return await this.client.hGetAll(key);
    } catch (error) {
      cacheLogger.error('Redis HGETALL error', { key, error });
      return {};
    }
  }

  async hDel(key: string, field: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.hDel(key, field);
    } catch (error) {
      cacheLogger.error('Redis HDEL error', { key, field, error });
    }
  }

  async sadd(key: string, members: string[]): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.sAdd(key, members);
    } catch (error) {
      cacheLogger.error('Redis SADD error', { key, members, error });
    }
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.client) return [];
    try {
      return await this.client.sMembers(key);
    } catch (error) {
      cacheLogger.error('Redis SMEMBERS error', { key, error });
      return [];
    }
  }

  async srem(key: string, members: string[]): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.sRem(key, members);
    } catch (error) {
      cacheLogger.error('Redis SREM error', { key, members, error });
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  getClient(): RedisClientType {
    return this.client;
  }
}

// Create singleton instance
const redisClient = new RedisClient();

export default redisClient;
export { RedisClient };