import { Request, Response } from 'express';
import { env } from '../config/environment';
import { db } from '../db/connection';
import { cacheManager } from '../cache/cache-manager';
import { sql } from 'drizzle-orm';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
}

interface DetailedHealthStatus extends HealthStatus {
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    traveltek: ServiceHealth;
  };
  memory: {
    used: string;
    total: string;
    percentage: string;
  };
  cpu: {
    usage: string;
  };
}

interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'checking';
  responseTime?: number;
  error?: string;
  lastChecked: string;
}

class HealthController {
  // Basic health check
  async basic(req: Request, res: Response): Promise<void> {
    const health: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: env.NODE_ENV,
    };

    res.status(200).json(health);
  }

  // Detailed health check with service dependencies
  async detailed(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    // Check all services
    const [dbHealth, redisHealth, traveltekHealth] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkTraveltek(),
    ]);

    // Memory information
    const memUsage = process.memoryUsage();
    const memory = {
      used: this.formatBytes(memUsage.heapUsed),
      total: this.formatBytes(memUsage.heapTotal),
      percentage: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2) + '%',
    };

    // CPU usage (approximation)
    const cpu = {
      usage: process.cpuUsage().user.toString(),
    };

    const health: DetailedHealthStatus = {
      status: this.determineOverallStatus([
        dbHealth.status === 'fulfilled' ? dbHealth.value : { status: 'unhealthy' as const },
        redisHealth.status === 'fulfilled' ? redisHealth.value : { status: 'unhealthy' as const },
        traveltekHealth.status === 'fulfilled' ? traveltekHealth.value : { status: 'unhealthy' as const },
      ]),
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: env.NODE_ENV,
      services: {
        database: dbHealth.status === 'fulfilled' ? dbHealth.value : this.createErrorService(dbHealth.reason),
        redis: redisHealth.status === 'fulfilled' ? redisHealth.value : this.createErrorService(redisHealth.reason),
        traveltek: traveltekHealth.status === 'fulfilled' ? traveltekHealth.value : this.createErrorService(traveltekHealth.reason),
      },
      memory,
      cpu,
    };

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
  }

  // Readiness probe - checks if the application is ready to receive traffic
  async ready(req: Request, res: Response): Promise<void> {
    try {
      // Check critical dependencies
      await Promise.all([
        this.checkDatabase(),
        this.checkRedis(),
      ]);

      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Liveness probe - checks if the application is alive
  async live(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }

  // Private helper methods
  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      // Simple SELECT 1 to check database connectivity
      await db.execute(sql`SELECT 1`);
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown database error',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private async checkRedis(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      // Check Redis connectivity through cache manager
      await cacheManager.set('health:check', 'ok', { ttl: 1 });
      await cacheManager.get('health:check');
      await cacheManager.delete('health:check');
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown Redis error',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private async checkTraveltek(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      // TODO: Replace with actual Traveltek FTP connection check
      // This is a simple connectivity test
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown Traveltek error',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private determineOverallStatus(services: ServiceHealth[]): 'healthy' | 'unhealthy' | 'degraded' {
    const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;
    
    if (unhealthyCount === 0) {
      return 'healthy';
    } else if (unhealthyCount === services.length) {
      return 'unhealthy';
    } else {
      return 'degraded';
    }
  }

  private createErrorService(error: any): ServiceHealth {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString(),
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const healthController = new HealthController();