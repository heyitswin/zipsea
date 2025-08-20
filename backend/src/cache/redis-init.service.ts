import redisClient from './redis';
import { env } from '../config/environment';
import { cacheLogger } from '../config/logger';

export class RedisInitService {
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.performInitialization();
    return this.initPromise;
  }

  private async performInitialization(): Promise<void> {
    try {
      if (!env.REDIS_URL) {
        cacheLogger.warn('Redis URL not configured - running without cache');
        this.initialized = true;
        return;
      }

      cacheLogger.info('Initializing Redis connection...');
      
      // Connect to Redis with timeout
      const connectPromise = redisClient.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 10000)
      );

      await Promise.race([connectPromise, timeoutPromise]);

      // Verify connection with ping
      await redisClient.ping();
      
      this.initialized = true;
      cacheLogger.info('Redis initialized successfully');

      // Log initial health info
      const healthInfo = await redisClient.getHealthInfo();
      cacheLogger.info('Redis initial health check', healthInfo);

    } catch (error) {
      cacheLogger.error('Failed to initialize Redis connection', { 
        error: error instanceof Error ? error.message : error 
      });
      
      // Don't throw - allow application to continue without cache
      this.initialized = true; // Mark as initialized to prevent retry loops
    }
  }

  async healthCheck(): Promise<{
    redis: {
      connected: boolean;
      healthy: boolean;
      metrics?: any;
      error?: string;
    };
  }> {
    try {
      if (!env.REDIS_URL) {
        return {
          redis: {
            connected: false,
            healthy: true, // Consider healthy if not configured
          }
        };
      }

      const isConnected = redisClient.isHealthy();
      
      if (!isConnected) {
        return {
          redis: {
            connected: false,
            healthy: false,
            error: 'Redis connection lost'
          }
        };
      }

      // Try a ping to verify the connection is working
      await redisClient.ping();
      const healthInfo = await redisClient.getHealthInfo();

      return {
        redis: {
          connected: true,
          healthy: true,
          metrics: healthInfo.metrics,
          ...healthInfo.serverInfo && { serverInfo: healthInfo.serverInfo }
        }
      };

    } catch (error) {
      return {
        redis: {
          connected: false,
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown Redis error'
        }
      };
    }
  }

  async shutdown(): Promise<void> {
    try {
      cacheLogger.info('Shutting down Redis connection...');
      await redisClient.disconnect();
      cacheLogger.info('Redis connection closed');
    } catch (error) {
      cacheLogger.error('Error during Redis shutdown', { error });
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async getMetrics() {
    try {
      return redisClient.getMetrics();
    } catch (error) {
      cacheLogger.error('Failed to get Redis metrics', { error });
      return null;
    }
  }

  resetMetrics(): void {
    try {
      redisClient.resetMetrics();
      cacheLogger.info('Redis metrics reset');
    } catch (error) {
      cacheLogger.error('Failed to reset Redis metrics', { error });
    }
  }
}

// Singleton instance
export const redisInitService = new RedisInitService();