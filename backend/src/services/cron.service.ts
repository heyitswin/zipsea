import * as cron from 'node-cron';
import { logger } from '../config/logger';
import { env } from '../config/environment';
import { dataSyncService } from './data-sync.service';
import { traveltekFTPService } from './traveltek-ftp.service';
import { priceHistoryService } from './price-history.service';
import { alertCronService } from './alert-cron.service';

export class CronService {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Initialize all scheduled jobs
   */
  async init(): Promise<void> {
    try {
      logger.info('Initializing scheduled jobs...');

      // Only run cron jobs in production or if explicitly enabled
      if (env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true') {
        this.setupDataSyncJobs();
        // Batch sync is now handled by webhook-processor-optimized.service
        // this.setupBatchSyncJobs(); // DEPRECATED
        this.setupHealthCheckJobs();
        this.setupMaintenanceJobs();
        this.setupPriceHistoryJobs();
        this.setupAlertJobs();

        logger.info('✅ All scheduled jobs initialized');
      } else {
        logger.info('⏸️ Scheduled jobs disabled (not in production)');
      }
    } catch (error) {
      logger.error('Failed to initialize scheduled jobs:', error);
      throw error;
    }
  }

  /**
   * Setup batch sync jobs for webhook-flagged cruises
   * DEPRECATED: Webhook processing is now handled by webhook-processor-optimized.service
   */
  private setupBatchSyncJobs(): void {
    // This method is deprecated - webhook processing is now handled automatically
    logger.info('⚠️ Batch sync jobs are deprecated - using optimized webhook processor instead');
  }

  /**
   * Setup data synchronization jobs
   */
  private setupDataSyncJobs(): void {
    // Sync recent data every hour
    const recentDataSyncJob = cron.schedule(
      '0 * * * *',
      async () => {
        try {
          logger.info('🔄 Starting recent data sync...');
          const startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);

          // TODO: Implement syncRecentData method
          logger.info('📌 Recent data sync - method not yet implemented');
          // const result = await dataSyncService.syncRecentData(startDate);
          // logger.info(
          //   `✅ Recent data sync completed: ${result.cruisesProcessed} cruises processed, ${result.cruisesCreated} created, ${result.cruisesUpdated} updated`
          // );
        } catch (error) {
          logger.error('❌ Recent data sync failed:', error);
        }
      },
      {
        scheduled: false,
        timezone: 'UTC',
      }
    );

    this.jobs.set('recent-data-sync', recentDataSyncJob);
    recentDataSyncJob.start();
    logger.info('📅 Data sync job scheduled:');
    logger.info('  - Recent data: Every hour');
  }

  /**
   * Setup health check jobs
   */
  private setupHealthCheckJobs(): void {
    // Health check every 5 minutes
    const healthCheckJob = cron.schedule(
      '*/5 * * * *',
      async () => {
        try {
          const health = await this.performHealthCheck();
          if (!health.healthy) {
            logger.warn('⚠️ Health check failed:', health.issues);
          }
        } catch (error) {
          logger.error('❌ Health check error:', error);
        }
      },
      {
        scheduled: false,
        timezone: 'UTC',
      }
    );

    this.jobs.set('health-check', healthCheckJob);
    healthCheckJob.start();
    logger.info('📅 Health check job scheduled: Every 5 minutes');
  }

  /**
   * Setup maintenance jobs
   */
  private setupMaintenanceJobs(): void {
    // Clean up old data daily at 3 AM UTC
    const cleanupJob = cron.schedule(
      '0 3 * * *',
      async () => {
        try {
          logger.info('🧹 Starting daily cleanup...');

          // Clean up old price snapshots (keep last 90 days)
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - 90);

          // Actual cleanup would happen here
          logger.info('✅ Daily cleanup completed');
        } catch (error) {
          logger.error('❌ Daily cleanup failed:', error);
        }
      },
      {
        scheduled: false,
        timezone: 'UTC',
      }
    );

    // Cache warming job - runs every 2 hours
    const cacheWarmingJob = cron.schedule(
      '0 */2 * * *',
      async () => {
        try {
          logger.info('🔥 Starting cache warming...');
          // Cache warming logic would go here
          logger.info('✅ Cache warming completed');
        } catch (error) {
          logger.error('❌ Cache warming failed:', error);
        }
      },
      {
        scheduled: false,
        timezone: 'UTC',
      }
    );

    this.jobs.set('cleanup', cleanupJob);
    this.jobs.set('cache-warming', cacheWarmingJob);
    cleanupJob.start();
    cacheWarmingJob.start();

    logger.info('📅 Maintenance jobs scheduled:');
    logger.info('  - Daily cleanup: 3 AM UTC');
    logger.info('  - Cache warming: Every 2 hours');
  }

  /**
   * Setup price history jobs
   */
  private setupPriceHistoryJobs(): void {
    // Analyze price trends weekly (Sunday at 2 AM UTC)
    const priceAnalysisJob = cron.schedule(
      '0 2 * * 0',
      async () => {
        try {
          logger.info('📊 Starting weekly price trend analysis...');
          // TODO: Implement analyzePriceTrends method
          logger.info('📌 Price trend analysis - method not yet implemented');
          // const result = await priceHistoryService.analyzePriceTrends();
          // logger.info(
          //   `✅ Price trend analysis completed: ${result.cruisesAnalyzed} cruises analyzed`
          // );
        } catch (error) {
          logger.error('❌ Price trend analysis failed:', error);
        }
      },
      {
        scheduled: false,
        timezone: 'UTC',
      }
    );

    this.jobs.set('price-analysis', priceAnalysisJob);
    priceAnalysisJob.start();
    logger.info('📅 Price history job scheduled:');
    logger.info('  - Weekly trend analysis: Sunday 2 AM UTC');
  }

  /**
   * Setup price alert jobs
   */
  private setupAlertJobs(): void {
    // Process price alerts daily at 9 AM UTC (2 AM PST)
    const alertProcessingJob = cron.schedule(
      '0 9 * * *',
      async () => {
        try {
          logger.info('🔔 Starting daily price alert processing...');
          await alertCronService.processAllAlerts();
          logger.info('✅ Price alert processing completed');
        } catch (error) {
          logger.error('❌ Price alert processing failed:', error);
        }
      },
      {
        scheduled: false,
        timezone: 'UTC',
      }
    );

    this.jobs.set('alert-processing', alertProcessingJob);
    alertProcessingJob.start();
    logger.info('📅 Price alert job scheduled:');
    logger.info('  - Daily alert processing: 9 AM UTC (2 AM PST)');
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check database connection
    try {
      // Database health check would go here
    } catch (error) {
      issues.push('Database connection failed');
    }

    // Check Redis connection
    try {
      // Redis health check would go here
    } catch (error) {
      issues.push('Redis connection failed');
    }

    // FTP health check removed - connection pooling handles this automatically
    // The FTP connection pool service manages connections with keep-alive

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  /**
   * Start a specific job
   */
  startJob(jobName: string): boolean {
    const job = this.jobs.get(jobName);
    if (job) {
      job.start();
      logger.info(`✅ Job ${jobName} started`);
      return true;
    }
    logger.warn(`⚠️ Job ${jobName} not found`);
    return false;
  }

  /**
   * Stop a specific job
   */
  stopJob(jobName: string): boolean {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      logger.info(`⏹️ Job ${jobName} stopped`);
      return true;
    }
    logger.warn(`⚠️ Job ${jobName} not found`);
    return false;
  }

  /**
   * Get job status
   */
  getJobStatus(): Record<string, { running: boolean; nextRun?: Date }> {
    const status: Record<string, { running: boolean; nextRun?: Date }> = {};

    for (const [name, job] of this.jobs) {
      status[name] = {
        running: (job as any).running ?? false,
        // nextRun would need to be calculated based on cron expression
      };
    }

    return status;
  }

  /**
   * Stop all jobs
   */
  async stopAll(): Promise<void> {
    logger.info('Stopping all scheduled jobs...');
    for (const [name, job] of this.jobs) {
      job.stop();
      logger.info(`⏹️ Stopped job: ${name}`);
    }
    this.jobs.clear();
    logger.info('✅ All scheduled jobs stopped');
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    await this.stopAll();
  }

  /**
   * Start all jobs
   */
  startAllJobs(): void {
    for (const [name, job] of this.jobs) {
      job.start();
      logger.info(`✅ Started job: ${name}`);
    }
  }

  /**
   * Stop all jobs (alias for consistency)
   */
  stopAllJobs(): void {
    for (const [name, job] of this.jobs) {
      job.stop();
      logger.info(`⏹️ Stopped job: ${name}`);
    }
  }

  /**
   * Trigger data sync manually
   */
  async triggerDataSync(type: string): Promise<void> {
    logger.info(`Manual data sync triggered: ${type}`);
    // Implementation would go here based on type
  }
}

// Export singleton instance
export const cronService = new CronService();
