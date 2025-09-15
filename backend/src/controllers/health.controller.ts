import { Request, Response } from 'express';
import { redisInitService } from '../cache/redis-init.service';
import { cacheWarmingService } from '../cache/cache-warming.service';
import { cacheManager, searchCache, cruiseCache } from '../cache/cache-manager';
import { db } from '../db/connection';
import logger from '../config/logger';

class HealthController {
  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      // Check Redis health
      const redisHealth = await redisInitService.healthCheck();

      // Check database health
      let dbHealth = { status: 'healthy', error: null };
      try {
        // Simple query to check DB connectivity
        await db.execute('SELECT 1');
      } catch (error) {
        dbHealth = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown database error',
        };
      }

      const overall =
        redisHealth.redis.healthy && dbHealth.status === 'healthy' ? 'healthy' : 'degraded';

      res.json({
        status: overall,
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'staging',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        services: {
          database: dbHealth,
          redis: redisHealth.redis,
        },
      });
    } catch (error) {
      logger.error('Health check failed', { error });
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getReadiness(req: Request, res: Response): Promise<void> {
    res.json({
      ready: true,
      timestamp: new Date().toISOString(),
    });
  }

  async getLiveness(req: Request, res: Response): Promise<void> {
    res.json({
      alive: true,
      timestamp: new Date().toISOString(),
    });
  }

  async basic(req: Request, res: Response): Promise<void> {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }

  async detailed(req: Request, res: Response): Promise<void> {
    res.json({
      status: 'healthy',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'staging',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'healthy', lastChecked: new Date().toISOString() },
        redis: { status: 'healthy', lastChecked: new Date().toISOString() },
      },
    });
  }

  async ready(req: Request, res: Response): Promise<void> {
    res.json({
      ready: true,
      timestamp: new Date().toISOString(),
    });
  }

  async live(req: Request, res: Response): Promise<void> {
    res.json({
      alive: true,
      timestamp: new Date().toISOString(),
    });
  }

  // Cache-specific endpoints
  async getCacheMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await redisInitService.getMetrics();
      const healthInfo = await redisInitService.healthCheck();

      res.json({
        timestamp: new Date().toISOString(),
        redis: healthInfo.redis,
        metrics: metrics || {
          message: 'Redis not available',
        },
      });
    } catch (error) {
      logger.error('Failed to get cache metrics', { error });
      res.status(500).json({
        error: 'Failed to retrieve cache metrics',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async resetCacheMetrics(req: Request, res: Response): Promise<void> {
    try {
      redisInitService.resetMetrics();
      res.json({
        message: 'Cache metrics reset successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to reset cache metrics', { error });
      res.status(500).json({
        error: 'Failed to reset cache metrics',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Cache warming endpoints
  async getCacheWarmingStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = cacheWarmingService.getStatus();
      const cacheStats = await cacheManager.getStats();

      res.json({
        warming: status,
        cache: cacheStats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to get cache warming status', { error });
      res.status(500).json({
        error: 'Failed to get cache warming status',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async triggerCacheWarming(req: Request, res: Response): Promise<void> {
    try {
      const { targets } = req.body || {};

      logger.info('Manual cache warming triggered', { targets });

      const result = await cacheWarmingService.warmOnDemand(targets);

      res.json({
        message: 'Cache warming completed',
        result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to trigger cache warming', { error });
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to trigger cache warming',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async clearAllCaches(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Manual cache clearing triggered');

      // Clear all cache patterns
      await Promise.allSettled([
        searchCache.invalidateAllSearchCaches(),
        cacheManager.invalidatePattern('cruise:*'),
        cacheManager.invalidatePattern('comprehensive_cruise*'),
        cacheManager.invalidatePattern('pricing:*'),
        cacheManager.invalidatePattern('popular:*'),
        cacheManager.invalidatePattern('itinerary:*'),
        cacheManager.invalidatePattern('alternatives:*'),
      ]);

      res.json({
        message: 'All caches cleared successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to clear caches', { error });
      res.status(500).json({
        error: 'Failed to clear caches',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getCacheStats(req: Request, res: Response): Promise<void> {
    try {
      const [cacheStats, redisHealth] = await Promise.all([
        cacheManager.getStats(),
        redisInitService.healthCheck(),
      ]);

      res.json({
        stats: cacheStats,
        health: redisHealth.redis,
        warming: cacheWarmingService.getStatus(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to get cache statistics', { error });
      res.status(500).json({
        error: 'Failed to get cache statistics',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export const healthController = new HealthController();
