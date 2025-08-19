import redisClient from './redis';
import { cacheTTL } from '../config/environment';
import { cacheLogger } from '../config/logger';

export interface CacheOptions {
  ttl?: number;
  compress?: boolean;
  namespace?: string;
}

export class CacheManager {
  private defaultTTL = 3600; // 1 hour
  private namespace = 'zipsea';

  constructor(private redis = redisClient) {}

  // Generate cache key with namespace
  private getKey(key: string, namespace?: string): string {
    const ns = namespace || this.namespace;
    return `${ns}:${key}`;
  }

  // Generic get method with JSON parsing
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const fullKey = this.getKey(key, options.namespace);
      const value = await this.redis.get(fullKey);
      
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      cacheLogger.error('Cache get error', { key, error });
      return null;
    }
  }

  // Generic set method with JSON serialization
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const fullKey = this.getKey(key, options.namespace);
      const serializedValue = JSON.stringify(value);
      const ttl = options.ttl || this.defaultTTL;
      
      await this.redis.set(fullKey, serializedValue, ttl);
    } catch (error) {
      cacheLogger.error('Cache set error', { key, options, error });
    }
  }

  // Delete cache entry
  async del(key: string, options: CacheOptions = {}): Promise<void> {
    try {
      const fullKey = this.getKey(key, options.namespace);
      await this.redis.del(fullKey);
    } catch (error) {
      cacheLogger.error('Cache delete error', { key, error });
    }
  }

  // Check if key exists
  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const fullKey = this.getKey(key, options.namespace);
      return await this.redis.exists(fullKey);
    } catch (error) {
      cacheLogger.error('Cache exists error', { key, error });
      return false;
    }
  }

  // Get multiple keys
  async mget<T>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    try {
      const fullKeys = keys.map(key => this.getKey(key, options.namespace));
      const values = await this.redis.mGet(fullKeys);
      
      return values.map(value => {
        if (!value) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      cacheLogger.error('Cache mget error', { keys, error });
      return keys.map(() => null);
    }
  }

  // Cache with fallback function
  async getOrSet<T>(
    key: string,
    fallbackFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key, options);
      if (cached !== null) {
        return cached;
      }

      // If not in cache, execute fallback function
      const value = await fallbackFn();
      
      // Store in cache for next time
      await this.set(key, value, options);
      
      return value;
    } catch (error) {
      cacheLogger.error('Cache getOrSet error', { key, error });
      // If cache fails, still return the fallback value
      return await fallbackFn();
    }
  }

  // Invalidate cache pattern with batch processing
  async invalidatePattern(pattern: string, options: CacheOptions = {}): Promise<void> {
    try {
      const fullPattern = this.getKey(pattern, options.namespace);
      const keys = await this.redis.keys(fullPattern);
      
      if (keys.length > 0) {
        // Process in batches to avoid overwhelming Redis
        const batchSize = 100;
        for (let i = 0; i < keys.length; i += batchSize) {
          const batch = keys.slice(i, i + batchSize);
          await Promise.allSettled(batch.map(key => this.redis.del(key)));
        }
        cacheLogger.info('Cache pattern invalidated', { pattern, keysCount: keys.length });
      }
    } catch (error) {
      cacheLogger.error('Cache invalidate pattern error', { pattern, error });
    }
  }

  // Refresh cache entry
  async refresh<T>(
    key: string,
    fallbackFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    try {
      const value = await fallbackFn();
      await this.set(key, value, options);
      return value;
    } catch (error) {
      cacheLogger.error('Cache refresh error', { key, error });
      throw error;
    }
  }

  // Get cache statistics
  async getStats(): Promise<{
    connected: boolean;
    keyCount: number;
    memoryUsage: string;
  }> {
    try {
      const info = await this.redis.getClient().info('keyspace');
      const keys = await this.redis.keys(`${this.namespace}:*`);
      
      return {
        connected: this.redis.isHealthy(),
        keyCount: keys.length,
        memoryUsage: info,
      };
    } catch (error) {
      cacheLogger.error('Cache stats error', { error });
      return {
        connected: false,
        keyCount: 0,
        memoryUsage: 'unknown',
      };
    }
  }
}

// Specialized cache managers for different data types
export class SearchCacheManager extends CacheManager {
  constructor() {
    super();
  }

  async getCruiseSearch(searchKey: string) {
    return this.get(`search:cruise:${searchKey}`, { ttl: cacheTTL.search });
  }

  async setCruiseSearch(searchKey: string, results: any) {
    return this.set(`search:cruise:${searchKey}`, results, { ttl: cacheTTL.search });
  }

  async invalidateCruiseSearches() {
    return this.invalidatePattern('search:cruise:*');
  }
}

export class CruiseCacheManager extends CacheManager {
  constructor() {
    super();
  }

  async getCruiseDetails(cruiseId: number) {
    return this.get(`cruise:${cruiseId}`, { ttl: cacheTTL.cruiseDetails });
  }

  async setCruiseDetails(cruiseId: number, details: any) {
    return this.set(`cruise:${cruiseId}`, details, { ttl: cacheTTL.cruiseDetails });
  }

  async getCruisePricing(cruiseId: number) {
    return this.get(`pricing:${cruiseId}`, { ttl: cacheTTL.pricing });
  }

  async setCruisePricing(cruiseId: number, pricing: any) {
    return this.set(`pricing:${cruiseId}`, pricing, { ttl: cacheTTL.pricing });
  }

  async invalidateCruise(cruiseId: number) {
    await this.del(`cruise:${cruiseId}`);
    await this.del(`pricing:${cruiseId}`);
  }
}

// Create singleton instances
export const cacheManager = new CacheManager();
export const searchCache = new SearchCacheManager();
export const cruiseCache = new CruiseCacheManager();

export default cacheManager;