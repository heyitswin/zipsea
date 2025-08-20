import { createClient, RedisClientType, RedisClientOptions } from 'redis';
import { env, redisConfig } from '../config/environment';
import logger, { cacheLogger, logCacheOperation } from '../config/logger';

class RedisClient {
  private client: RedisClientType;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private metrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    connectTime: 0,
    totalOperations: 0,
  };

  constructor() {
    // Only create client if REDIS_URL is configured
    if (env.REDIS_URL) {
      this.createClient();
    } else {
      cacheLogger.warn('Redis URL not configured - cache disabled');
      this.client = null as any;
    }
  }

  private createClient(): void {
    const options: RedisClientOptions = {
      url: env.REDIS_URL,
      socket: {
        connectTimeout: 5000,
        lazyConnect: true,
        reconnectStrategy: (retries) => {
          if (retries >= this.maxReconnectAttempts) {
            cacheLogger.error(`Redis reconnection failed after ${retries} attempts`);
            return new Error('Redis reconnection failed');
          }
          
          const delay = Math.min(this.reconnectDelay * Math.pow(2, retries), 10000);
          cacheLogger.info(`Retrying Redis connection in ${delay}ms (attempt ${retries + 1})`);
          return delay;
        },
      },
      // Connection pooling and performance settings
      ...redisConfig,
    };

    this.client = createClient(options) as RedisClientType;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    const connectStart = Date.now();

    this.client.on('connect', () => {
      this.metrics.connectTime = Date.now() - connectStart;
      cacheLogger.info('Redis client connected', { 
        connectTime: this.metrics.connectTime,
        url: env.REDIS_URL?.replace(/redis:\/\/[^@]+@/, 'redis://****@')
      });
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      cacheLogger.info('Redis client ready to receive commands');
      this.logConnectionHealth();
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      this.metrics.errors++;
      cacheLogger.error('Redis client error', { 
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n'),
        reconnectAttempts: this.reconnectAttempts
      });
    });

    this.client.on('end', () => {
      this.isConnected = false;
      cacheLogger.info('Redis client connection ended');
    });

    this.client.on('reconnecting', () => {
      this.reconnectAttempts++;
      cacheLogger.info('Redis client reconnecting', { 
        attempt: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts
      });
    });

    // Connection timeout handling
    this.client.on('disconnect', (reason) => {
      this.isConnected = false;
      cacheLogger.warn('Redis client disconnected', { reason });
    });
  }

  private async logConnectionHealth(): Promise<void> {
    try {
      const info = await this.client.info('server');
      const memory = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');
      
      cacheLogger.info('Redis health check', {
        serverInfo: info.split('\r\n').find(line => line.startsWith('redis_version')),
        memoryInfo: memory.split('\r\n').find(line => line.startsWith('used_memory_human')),
        keyspaceInfo: keyspace.split('\r\n').find(line => line.startsWith('db0'))
      });
    } catch (error) {
      cacheLogger.warn('Could not retrieve Redis health info', { error });
    }
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
    if (!this.client || !this.isConnected) return null;
    
    const startTime = Date.now();
    this.metrics.totalOperations++;
    
    try {
      const value = await this.client.get(key);
      const opTime = Date.now() - startTime;
      
      if (value) {
        this.metrics.hits++;
        logCacheOperation('hit', key, undefined, opTime);
      } else {
        this.metrics.misses++;
        logCacheOperation('miss', key, undefined, opTime);
      }
      
      return value;
    } catch (error) {
      this.metrics.errors++;
      cacheLogger.error('Redis GET error', { 
        key, 
        error: error instanceof Error ? error.message : error,
        opTime: Date.now() - startTime 
      });
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.client || !this.isConnected) return;
    
    const startTime = Date.now();
    this.metrics.totalOperations++;
    this.metrics.sets++;
    
    try {
      if (ttl) {
        await this.client.setEx(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
      
      const opTime = Date.now() - startTime;
      logCacheOperation('set', key, ttl, opTime);
    } catch (error) {
      this.metrics.errors++;
      cacheLogger.error('Redis SET error', { 
        key, 
        ttl, 
        error: error instanceof Error ? error.message : error,
        opTime: Date.now() - startTime 
      });
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client || !this.isConnected) return;
    
    const startTime = Date.now();
    this.metrics.totalOperations++;
    this.metrics.deletes++;
    
    try {
      await this.client.del(key);
      const opTime = Date.now() - startTime;
      logCacheOperation('del', key, undefined, opTime);
    } catch (error) {
      this.metrics.errors++;
      cacheLogger.error('Redis DEL error', { 
        key, 
        error: error instanceof Error ? error.message : error,
        opTime: Date.now() - startTime 
      });
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

  // Get performance metrics
  getMetrics() {
    const hitRate = this.metrics.totalOperations > 0 
      ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 100
      : 0;

    return {
      ...this.metrics,
      hitRate: parseFloat(hitRate.toFixed(2)),
      errorRate: this.metrics.totalOperations > 0 
        ? (this.metrics.errors / this.metrics.totalOperations) * 100
        : 0,
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  // Reset metrics (useful for monitoring)
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      connectTime: this.metrics.connectTime, // Keep connect time
      totalOperations: 0,
    };
  }

  // Get comprehensive health information
  async getHealthInfo(): Promise<{
    connected: boolean;
    metrics: ReturnType<typeof this.getMetrics>;
    serverInfo?: any;
  }> {
    const healthInfo: any = {
      connected: this.isConnected,
      metrics: this.getMetrics(),
    };

    if (this.isConnected && this.client) {
      try {
        const info = await this.client.info();
        const memory = await this.client.info('memory');
        const keyspace = await this.client.info('keyspace');
        
        healthInfo.serverInfo = {
          version: this.extractInfoValue(info, 'redis_version'),
          uptime: this.extractInfoValue(info, 'uptime_in_seconds'),
          connectedClients: this.extractInfoValue(info, 'connected_clients'),
          usedMemory: this.extractInfoValue(memory, 'used_memory_human'),
          maxMemory: this.extractInfoValue(memory, 'maxmemory_human'),
          keyCount: this.extractInfoValue(keyspace, 'db0')?.match(/keys=(\d+)/)?.[1] || '0',
        };
      } catch (error) {
        cacheLogger.warn('Could not retrieve Redis server info', { error });
      }
    }

    return healthInfo;
  }

  private extractInfoValue(info: string, key: string): string | undefined {
    const line = info.split('\r\n').find(line => line.startsWith(key + ':'));
    return line?.split(':')[1];
  }

  // Compression utilities (for large data sets)
  async setCompressed(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.client || !this.isConnected) return;
    
    try {
      // Simple JSON compression - in production, consider using actual compression libraries
      const compressed = JSON.stringify(value);
      await this.set(key, compressed, ttl);
    } catch (error) {
      cacheLogger.error('Redis SET compressed error', { key, ttl, error });
    }
  }

  async getCompressed<T>(key: string): Promise<T | null> {
    if (!this.client || !this.isConnected) return null;
    
    try {
      const value = await this.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      cacheLogger.error('Redis GET compressed error', { key, error });
      return null;
    }
  }

  // Bulk operations for better performance
  async mGetCompressed<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.client || !this.isConnected) return keys.map(() => null);
    
    try {
      const values = await this.mGet(keys);
      return values.map(value => {
        if (!value) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      cacheLogger.error('Redis MGET compressed error', { keys, error });
      return keys.map(() => null);
    }
  }
}

// Create singleton instance
const redisClient = new RedisClient();

export default redisClient;
export { RedisClient };