import { Database } from '../db/connection';
import { CacheManager } from '../cache/cache-manager';
import logger from '../config/logger';

/**
 * Base service class providing common functionality
 * All service classes should extend this for consistency
 */
export abstract class BaseService {
  constructor(
    protected db: Database,
    protected cache?: CacheManager
  ) {}

  /**
   * Execute database transaction with error handling
   */
  protected async executeTransaction<T>(
    operation: (tx: Database) => Promise<T>
  ): Promise<T> {
    try {
      return await this.db.transaction(operation);
    } catch (error) {
      logger.error('Transaction failed', { 
        service: this.constructor.name,
        error 
      });
      throw error;
    }
  }

  /**
   * Cache-aware data retrieval
   */
  protected async getFromCacheOrDb<T>(
    cacheKey: string,
    dbOperation: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    if (!this.cache) {
      return dbOperation();
    }

    return this.cache.getOrSet(cacheKey, dbOperation, { ttl });
  }

  /**
   * Invalidate related cache entries
   */
  protected async invalidateCache(pattern: string): Promise<void> {
    if (this.cache) {
      await this.cache.invalidatePattern(pattern);
    }
  }

  /**
   * Log service operations
   */
  protected log(level: 'info' | 'error' | 'warn' | 'debug', message: string, meta?: any) {
    logger[level](message, {
      service: this.constructor.name,
      ...meta
    });
  }
}

export default BaseService;