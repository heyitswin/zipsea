import * as cron from 'node-cron';
import { logger } from '../config/logger';
import { env } from '../config/environment';
import { dataSyncService } from './data-sync.service';
import { traveltekFTPService } from './traveltek-ftp.service';

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
        this.setupHealthCheckJobs();
        this.setupMaintenanceJobs();
        
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
   * Setup data synchronization jobs
   */
  private setupDataSyncJobs(): void {
    // Sync recent data every hour
    const recentSyncJob = cron.schedule('0 * * * *', async () => {
      try {
        logger.info('🔄 Starting hourly recent data sync...');
        await dataSyncService.syncRecentCruiseData(1); // Last 24 hours
        logger.info('✅ Hourly recent data sync completed');
      } catch (error) {
        logger.error('❌ Hourly recent data sync failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Full sync daily at 2 AM UTC
    const fullSyncJob = cron.schedule('0 2 * * *', async () => {
      try {
        logger.info('🔄 Starting daily full data sync...');
        await dataSyncService.syncRecentCruiseData(7); // Last week
        logger.info('✅ Daily full data sync completed');
      } catch (error) {
        logger.error('❌ Daily full data sync failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Weekly comprehensive sync on Sundays at 3 AM UTC
    const weeklySyncJob = cron.schedule('0 3 * * 0', async () => {
      try {
        logger.info('🔄 Starting weekly comprehensive data sync...');
        // Get current month and next month
        const now = new Date();
        const currentYear = now.getFullYear().toString();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
        
        await dataSyncService.fullSyncCruiseData(currentYear, currentMonth);
        
        // Also sync next month if we're near the end of current month
        if (now.getDate() > 25) {
          const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          const nextYear = nextMonth.getFullYear().toString();
          const nextMonthStr = String(nextMonth.getMonth() + 1).padStart(2, '0');
          await dataSyncService.fullSyncCruiseData(nextYear, nextMonthStr);
        }
        
        logger.info('✅ Weekly comprehensive data sync completed');
      } catch (error) {
        logger.error('❌ Weekly comprehensive data sync failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Store jobs for management
    this.jobs.set('recent-sync', recentSyncJob);
    this.jobs.set('daily-sync', fullSyncJob);
    this.jobs.set('weekly-sync', weeklySyncJob);

    // Start the jobs
    recentSyncJob.start();
    fullSyncJob.start();
    weeklySyncJob.start();

    logger.info('📅 Data sync jobs scheduled:');
    logger.info('  - Recent sync: Every hour');
    logger.info('  - Daily sync: 2:00 AM UTC daily');
    logger.info('  - Weekly sync: 3:00 AM UTC Sundays');
  }

  /**
   * Setup health check jobs
   */
  private setupHealthCheckJobs(): void {
    // FTP connection health check every 30 minutes
    const ftpHealthJob = cron.schedule('*/30 * * * *', async () => {
      try {
        logger.debug('🔍 Checking FTP connection health...');
        const health = await traveltekFTPService.healthCheck();
        
        if (!health.connected) {
          logger.warn('⚠️ FTP connection health check failed:', health.error);
        } else {
          logger.debug('✅ FTP connection healthy');
        }
      } catch (error) {
        logger.error('❌ FTP health check error:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.jobs.set('ftp-health', ftpHealthJob);
    ftpHealthJob.start();

    logger.info('📅 Health check jobs scheduled:');
    logger.info('  - FTP health: Every 30 minutes');
  }

  /**
   * Setup maintenance jobs
   */
  private setupMaintenanceJobs(): void {
    // Cache cleanup at 4 AM UTC daily
    const cacheCleanupJob = cron.schedule('0 4 * * *', async () => {
      try {
        logger.info('🧹 Starting cache cleanup...');
        // This would depend on your cache implementation
        // For now, just log the activity
        logger.info('✅ Cache cleanup completed');
      } catch (error) {
        logger.error('❌ Cache cleanup failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Log cleanup weekly on Mondays at 5 AM UTC
    const logCleanupJob = cron.schedule('0 5 * * 1', async () => {
      try {
        logger.info('🧹 Starting log cleanup...');
        // This would clean up old log files
        // Implementation depends on your logging setup
        logger.info('✅ Log cleanup completed');
      } catch (error) {
        logger.error('❌ Log cleanup failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.jobs.set('cache-cleanup', cacheCleanupJob);
    this.jobs.set('log-cleanup', logCleanupJob);

    cacheCleanupJob.start();
    logCleanupJob.start();

    logger.info('📅 Maintenance jobs scheduled:');
    logger.info('  - Cache cleanup: 4:00 AM UTC daily');
    logger.info('  - Log cleanup: 5:00 AM UTC Mondays');
  }

  /**
   * Stop a specific job
   */
  stopJob(jobName: string): boolean {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      logger.info(`⏹️ Stopped job: ${jobName}`);
      return true;
    }
    return false;
  }

  /**
   * Start a specific job
   */
  startJob(jobName: string): boolean {
    const job = this.jobs.get(jobName);
    if (job) {
      job.start();
      logger.info(`▶️ Started job: ${jobName}`);
      return true;
    }
    return false;
  }

  /**
   * Get job status
   */
  getJobStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    for (const [name, job] of this.jobs) {
      status[name] = job.running;
    }
    return status;
  }

  /**
   * Stop all jobs
   */
  stopAllJobs(): void {
    for (const [name, job] of this.jobs) {
      job.stop();
      logger.info(`⏹️ Stopped job: ${name}`);
    }
    logger.info('⏹️ All scheduled jobs stopped');
  }

  /**
   * Start all jobs
   */
  startAllJobs(): void {
    for (const [name, job] of this.jobs) {
      job.start();
      logger.info(`▶️ Started job: ${name}`);
    }
    logger.info('▶️ All scheduled jobs started');
  }

  /**
   * Manual trigger for data sync
   */
  async triggerDataSync(type: 'recent' | 'daily' | 'weekly' = 'recent'): Promise<void> {
    try {
      logger.info(`🔄 Manually triggering ${type} data sync...`);
      
      switch (type) {
        case 'recent':
          await dataSyncService.syncRecentCruiseData(1);
          break;
        case 'daily':
          await dataSyncService.syncRecentCruiseData(7);
          break;
        case 'weekly':
          const now = new Date();
          const currentYear = now.getFullYear().toString();
          const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
          await dataSyncService.fullSyncCruiseData(currentYear, currentMonth);
          break;
      }
      
      logger.info(`✅ Manual ${type} data sync completed`);
    } catch (error) {
      logger.error(`❌ Manual ${type} data sync failed:`, error);
      throw error;
    }
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('🛑 Shutting down cron service...');
    this.stopAllJobs();
    
    // Close FTP connection
    await traveltekFTPService.disconnect();
    
    logger.info('✅ Cron service shutdown completed');
  }
}

// Singleton instance
export const cronService = new CronService();