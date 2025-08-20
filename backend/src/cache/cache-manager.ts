import redisClient from './redis';
import { cacheTTL } from '../config/environment';
import { cacheLogger } from '../config/logger';

export interface CacheOptions {
  ttl?: number;
  compress?: boolean;
  namespace?: string;
  fallback?: boolean; // Whether to use fallback strategies
  maxSize?: number; // Maximum size in bytes for compression decisions
}

export class CacheManager {
  private defaultTTL = 3600; // 1 hour
  private namespace = 'zipsea';
  private fallbackCache = new Map<string, { value: any; expires: number }>(); // In-memory fallback
  private maxFallbackSize = 1000; // Maximum items in fallback cache
  private compressionThreshold = 1024; // Compress values larger than 1KB

  constructor(private redis = redisClient) {
    // Clean up fallback cache periodically
    setInterval(() => {
      this.cleanupFallbackCache();
    }, 60000); // Every minute
  }

  // Generate cache key with namespace
  private getKey(key: string, namespace?: string): string {
    const ns = namespace || this.namespace;
    return `${ns}:${key}`;
  }

  // Generic get method with JSON parsing and fallback
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const fullKey = this.getKey(key, options.namespace);
    
    try {
      // Try Redis first
      if (this.redis.isHealthy()) {
        const value = options.compress 
          ? await this.redis.getCompressed<T>(fullKey)
          : await this.getFromRedis<T>(fullKey);
        
        if (value !== null) {
          return value;
        }
      }

      // Fall back to in-memory cache if enabled and Redis failed
      if (options.fallback !== false) {
        return this.getFromFallback<T>(fullKey);
      }

      return null;
    } catch (error) {
      cacheLogger.error('Cache get error', { key, fullKey, error });
      
      // Try fallback cache on error
      if (options.fallback !== false) {
        return this.getFromFallback<T>(fullKey);
      }
      
      return null;
    }
  }

  private async getFromRedis<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  }

  private getFromFallback<T>(key: string): T | null {
    const cached = this.fallbackCache.get(key);
    if (!cached) return null;
    
    if (Date.now() > cached.expires) {
      this.fallbackCache.delete(key);
      return null;
    }
    
    return cached.value as T;
  }

  // Generic set method with JSON serialization, compression, and fallback
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.getKey(key, options.namespace);
    const ttl = options.ttl || this.defaultTTL;
    
    try {
      // Try Redis first
      if (this.redis.isHealthy()) {
        if (options.compress) {
          await this.redis.setCompressed(fullKey, value, ttl);
        } else {
          // Auto-compress large values
          const serialized = JSON.stringify(value);
          const shouldCompress = serialized.length > (options.maxSize || this.compressionThreshold);
          
          if (shouldCompress) {
            await this.redis.setCompressed(fullKey, value, ttl);
          } else {
            await this.redis.set(fullKey, serialized, ttl);
          }
        }
      }

      // Also store in fallback cache if enabled
      if (options.fallback !== false) {
        this.setToFallback(fullKey, value, ttl);
      }

    } catch (error) {
      cacheLogger.error('Cache set error', { key, fullKey, options, error });
      
      // Try fallback cache on Redis error
      if (options.fallback !== false) {
        this.setToFallback(fullKey, value, ttl);
      }
    }
  }

  private setToFallback<T>(key: string, value: T, ttlSeconds: number): void {
    try {
      // Ensure we don't exceed max fallback cache size
      if (this.fallbackCache.size >= this.maxFallbackSize) {
        this.evictOldestFromFallback();
      }
      
      const expires = Date.now() + (ttlSeconds * 1000);
      this.fallbackCache.set(key, { value, expires });
    } catch (error) {
      cacheLogger.warn('Failed to set fallback cache', { key, error });
    }
  }

  private evictOldestFromFallback(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;
    
    for (const [key, { expires }] of this.fallbackCache.entries()) {
      if (expires < oldestTime) {
        oldestTime = expires;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.fallbackCache.delete(oldestKey);
    }
  }

  private cleanupFallbackCache(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, { expires }] of this.fallbackCache.entries()) {
      if (now > expires) {
        this.fallbackCache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      cacheLogger.debug(`Cleaned up ${cleanedCount} expired entries from fallback cache`);
    }
  }

  // Delete cache entry
  async del(key: string, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.getKey(key, options.namespace);
    
    try {
      // Delete from Redis
      if (this.redis.isHealthy()) {
        await this.redis.del(fullKey);
      }
      
      // Delete from fallback cache
      this.fallbackCache.delete(fullKey);
    } catch (error) {
      cacheLogger.error('Cache delete error', { key, fullKey, error });
      
      // Still try to delete from fallback
      this.fallbackCache.delete(fullKey);
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

  // Delete a single key (alias for del)
  async delete(key: string, options: CacheOptions = {}): Promise<void> {
    return this.del(key, options);
  }

  // Delete keys matching a pattern
  async deletePattern(pattern: string, options: CacheOptions = {}): Promise<void> {
    return this.invalidatePattern(pattern, options);
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

  // Get comprehensive cache statistics
  async getStats(): Promise<{
    redis: {
      connected: boolean;
      keyCount: number;
      memoryUsage: string;
      metrics?: any;
    };
    fallback: {
      keyCount: number;
      memoryEstimate: string;
    };
    performance: {
      hitRate: number;
      totalOperations: number;
    };
  }> {
    try {
      const redisHealthInfo = await this.redis.getHealthInfo();
      const redisMetrics = this.redis.getMetrics();
      
      const fallbackSize = this.fallbackCache.size;
      const fallbackMemoryEstimate = this.estimateFallbackMemoryUsage();
      
      return {
        redis: {
          connected: this.redis.isHealthy(),
          keyCount: parseInt(redisHealthInfo.serverInfo?.keyCount || '0'),
          memoryUsage: redisHealthInfo.serverInfo?.usedMemory || 'unknown',
          metrics: redisMetrics,
        },
        fallback: {
          keyCount: fallbackSize,
          memoryEstimate: `~${Math.round(fallbackMemoryEstimate / 1024)}KB`,
        },
        performance: {
          hitRate: redisMetrics.hitRate || 0,
          totalOperations: redisMetrics.totalOperations || 0,
        },
      };
    } catch (error) {
      cacheLogger.error('Cache stats error', { error });
      return {
        redis: {
          connected: false,
          keyCount: 0,
          memoryUsage: 'unknown',
        },
        fallback: {
          keyCount: this.fallbackCache.size,
          memoryEstimate: '0KB',
        },
        performance: {
          hitRate: 0,
          totalOperations: 0,
        },
      };
    }
  }

  private estimateFallbackMemoryUsage(): number {
    let totalSize = 0;
    for (const [key, { value }] of this.fallbackCache.entries()) {
      // Rough estimation of memory usage
      totalSize += key.length * 2; // UTF-16 characters
      totalSize += JSON.stringify(value).length * 2;
      totalSize += 100; // Overhead for object properties
    }
    return totalSize;
  }

  // Cache warming functionality
  async warmCache(warmingFunctions: Array<{
    key: string;
    fetcher: () => Promise<any>;
    ttl?: number;
    namespace?: string;
  }>): Promise<{ successful: number; failed: number }> {
    cacheLogger.info(`Starting cache warming for ${warmingFunctions.length} entries`);
    
    let successful = 0;
    let failed = 0;
    
    // Process in parallel batches
    const batchSize = 5;
    for (let i = 0; i < warmingFunctions.length; i += batchSize) {
      const batch = warmingFunctions.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(async ({ key, fetcher, ttl, namespace }) => {
          try {
            const fullKey = this.getKey(key, namespace);
            
            // Check if already cached
            const existing = await this.get(fullKey);
            if (existing !== null) {
              cacheLogger.debug(`Cache warming skipped for ${key} - already cached`);
              return;
            }
            
            // Fetch and cache the data
            const data = await fetcher();
            await this.set(key, data, { 
              ttl: ttl || this.defaultTTL,
              namespace,
              fallback: true,
              compress: JSON.stringify(data).length > this.compressionThreshold
            });
            
            successful++;
            cacheLogger.debug(`Cache warmed for key: ${key}`);
          } catch (error) {
            failed++;
            cacheLogger.warn(`Cache warming failed for key: ${key}`, { error });
          }
        })
      );
      
      // Small delay between batches to avoid overwhelming the system
      if (i + batchSize < warmingFunctions.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    cacheLogger.info(`Cache warming completed: ${successful} successful, ${failed} failed`);
    return { successful, failed };
  }

  // Preload popular searches and data
  async preloadPopularData(): Promise<void> {
    cacheLogger.info('Starting popular data preload');
    
    try {
      // This would be called with actual popular queries from analytics
      const popularWarmingTasks = [
        {
          key: 'popular_destinations',
          fetcher: async () => {
            // Placeholder - would fetch popular destinations
            return [];
          },
          ttl: 7200, // 2 hours
        },
        {
          key: 'search_filters',
          fetcher: async () => {
            // Placeholder - would fetch search filters
            return {};
          },
          ttl: 7200,
        },
      ];
      
      await this.warmCache(popularWarmingTasks);
    } catch (error) {
      cacheLogger.error('Failed to preload popular data', { error });
    }
  }
}

// Specialized cache managers for different data types
export class SearchCacheManager extends CacheManager {
  constructor() {
    super();
  }

  async getCruiseSearch(searchKey: string) {
    return this.get(`search:cruise:${searchKey}`, { 
      ttl: cacheTTL.search,
      fallback: true,
      compress: true, // Search results can be large
    });
  }

  async setCruiseSearch(searchKey: string, results: any) {
    return this.set(`search:cruise:${searchKey}`, results, { 
      ttl: cacheTTL.search,
      fallback: true,
      compress: true,
    });
  }

  async getSearchFilters() {
    return this.get('search:filters', {
      ttl: cacheTTL.search * 2, // Cache filters longer
      fallback: true,
    });
  }

  async setSearchFilters(filters: any) {
    return this.set('search:filters', filters, {
      ttl: cacheTTL.search * 2,
      fallback: true,
    });
  }

  async getPopularCruises(limit: number = 10) {
    return this.get(`popular:cruises:${limit}`, {
      ttl: cacheTTL.search,
      fallback: true,
      compress: true,
    });
  }

  async setPopularCruises(limit: number, cruises: any) {
    return this.set(`popular:cruises:${limit}`, cruises, {
      ttl: cacheTTL.search,
      fallback: true,
      compress: true,
    });
  }

  async invalidateCruiseSearches() {
    return this.invalidatePattern('search:cruise:*');
  }

  async invalidateAllSearchCaches() {
    await Promise.all([
      this.invalidatePattern('search:*'),
      this.invalidatePattern('popular:*'),
    ]);
  }
}

export class CruiseCacheManager extends CacheManager {
  constructor() {
    super();
  }

  async getCruiseDetails(cruiseId: number) {
    return this.get(`cruise:${cruiseId}`, { 
      ttl: cacheTTL.cruiseDetails,
      fallback: true,
      compress: true, // Cruise details can be large with images, itinerary, etc.
    });
  }

  async setCruiseDetails(cruiseId: number, details: any) {
    return this.set(`cruise:${cruiseId}`, details, { 
      ttl: cacheTTL.cruiseDetails,
      fallback: true,
      compress: true,
    });
  }

  async getCruisePricing(cruiseId: number, cabinType?: string) {
    const key = cabinType 
      ? `pricing:${cruiseId}:${cabinType}`
      : `pricing:${cruiseId}`;
    
    return this.get(key, { 
      ttl: cacheTTL.pricing,
      fallback: true, // Pricing is critical - use fallback
    });
  }

  async setCruisePricing(cruiseId: number, pricing: any, cabinType?: string) {
    const key = cabinType 
      ? `pricing:${cruiseId}:${cabinType}`
      : `pricing:${cruiseId}`;
      
    return this.set(key, pricing, { 
      ttl: cacheTTL.pricing,
      fallback: true,
    });
  }

  async getCruiseItinerary(cruiseId: number) {
    return this.get(`itinerary:${cruiseId}`, {
      ttl: cacheTTL.cruiseDetails,
      fallback: true,
    });
  }

  async setCruiseItinerary(cruiseId: number, itinerary: any) {
    return this.set(`itinerary:${cruiseId}`, itinerary, {
      ttl: cacheTTL.cruiseDetails,
      fallback: true,
    });
  }

  async getCruiseAlternatives(cruiseId: number) {
    return this.get(`alternatives:${cruiseId}`, {
      ttl: cacheTTL.search, // Alternatives change more frequently
      fallback: true,
      compress: true,
    });
  }

  async setCruiseAlternatives(cruiseId: number, alternatives: any) {
    return this.set(`alternatives:${cruiseId}`, alternatives, {
      ttl: cacheTTL.search,
      fallback: true,
      compress: true,
    });
  }

  async invalidateCruise(cruiseId: number) {
    await Promise.all([
      this.del(`cruise:${cruiseId}`),
      this.del(`pricing:${cruiseId}`),
      this.del(`itinerary:${cruiseId}`),
      this.del(`alternatives:${cruiseId}`),
      // Also invalidate cabin-specific pricing
      this.invalidatePattern(`pricing:${cruiseId}:*`),
    ]);
  }

  async invalidateCruisePricing(cruiseId: number) {
    await Promise.all([
      this.del(`pricing:${cruiseId}`),
      this.invalidatePattern(`pricing:${cruiseId}:*`),
    ]);
  }

  // Batch operations for better performance
  async getCruisesBatch(cruiseIds: number[]) {
    const keys = cruiseIds.map(id => `cruise:${id}`);
    return this.mget(keys, {
      fallback: true,
      compress: true,
    });
  }

  async warmCruiseCache(cruiseId: number, fetchers: {
    details?: () => Promise<any>;
    pricing?: () => Promise<any>;
    itinerary?: () => Promise<any>;
    alternatives?: () => Promise<any>;
  }) {
    const tasks = [];
    
    if (fetchers.details) {
      tasks.push({
        key: `cruise:${cruiseId}`,
        fetcher: fetchers.details,
        ttl: cacheTTL.cruiseDetails,
      });
    }
    
    if (fetchers.pricing) {
      tasks.push({
        key: `pricing:${cruiseId}`,
        fetcher: fetchers.pricing,
        ttl: cacheTTL.pricing,
      });
    }
    
    if (fetchers.itinerary) {
      tasks.push({
        key: `itinerary:${cruiseId}`,
        fetcher: fetchers.itinerary,
        ttl: cacheTTL.cruiseDetails,
      });
    }
    
    if (fetchers.alternatives) {
      tasks.push({
        key: `alternatives:${cruiseId}`,
        fetcher: fetchers.alternatives,
        ttl: cacheTTL.search,
      });
    }
    
    return this.warmCache(tasks);
  }
}

// Create singleton instances
export const cacheManager = new CacheManager();
export const searchCache = new SearchCacheManager();
export const cruiseCache = new CruiseCacheManager();

export default cacheManager;