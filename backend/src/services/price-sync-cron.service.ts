import * as cron from 'node-cron';
import { logger } from '../config/logger';
import { env } from '../config/environment';
import { priceSyncBatchServiceV2 } from './price-sync-batch-v2.service';

export class PriceSyncCronService {
  private job: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Initialize the price sync cron job
   * Runs every 5 minutes as required
   */
  async init(): Promise<void> {
    try {
      logger.info('Initializing price sync cron job...');

      // Only run in production or if explicitly enabled
      if (env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true' || process.env.ENABLE_PRICE_SYNC_CRON === 'true') {
        
        // Run every 5 minutes
        this.job = cron.schedule('*/5 * * * *', async () => {
          if (this.isRunning) {
            logger.warn('⏭️ Price sync already running, skipping this cycle');
            return;
          }

          this.isRunning = true;
          try {
            logger.info('🔄 Starting scheduled price sync...');
            const result = await priceSyncBatchServiceV2.syncPendingPriceUpdates();
            
            if (result.cruisesUpdated > 0) {
              logger.info(`✅ Price sync completed: ${result.cruisesUpdated} cruises updated`);
            } else if (result.filesFound === 0) {
              logger.info('✅ Price sync completed: No pending updates');
            } else {
              logger.warn(`⚠️ Price sync completed: ${result.filesFound} files found but ${result.cruisesNotFound} cruises not matched`);
            }
          } catch (error) {
            logger.error('❌ Price sync failed:', error);
          } finally {
            this.isRunning = false;
          }
        }, {
          scheduled: false,
          timezone: 'UTC'
        });

        // Start the job
        this.job.start();
        
        logger.info('📅 Price sync job scheduled: Every 5 minutes');
        
        // Run once immediately on startup to catch any pending updates
        this.triggerSync().catch(err => {
          logger.error('Failed to run initial price sync:', err);
        });
        
      } else {
        logger.info('⏸️ Price sync cron job disabled (not in production)');
      }
    } catch (error) {
      logger.error('Failed to initialize price sync cron job:', error);
      throw error;
    }
  }

  /**
   * Manually trigger a price sync
   */
  async triggerSync(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Price sync already in progress');
      return;
    }

    this.isRunning = true;
    try {
      logger.info('🔄 Manually triggering price sync...');
      const result = await priceSyncBatchServiceV2.syncPendingPriceUpdates();
      
      logger.info('✅ Manual price sync completed', {
        filesFound: result.filesFound,
        filesProcessed: result.filesProcessed,
        cruisesUpdated: result.cruisesUpdated,
        cruisesNotFound: result.cruisesNotFound,
        errors: result.errors,
        durationSeconds: (result.duration / 1000).toFixed(1)
      });
    } catch (error) {
      logger.error('❌ Manual price sync failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Stop the cron job
   */
  stop(): void {
    if (this.job) {
      this.job.stop();
      logger.info('⏹️ Price sync cron job stopped');
    }
  }

  /**
   * Start the cron job
   */
  start(): void {
    if (this.job) {
      this.job.start();
      logger.info('▶️ Price sync cron job started');
    }
  }

  /**
   * Get job status
   */
  getStatus(): { 
    isScheduled: boolean; 
    isRunning: boolean; 
    nextRun?: Date;
  } {
    return {
      isScheduled: this.job !== null,
      isRunning: this.isRunning,
      nextRun: this.job ? this.getNextRunTime() : undefined
    };
  }

  /**
   * Calculate next run time (approximately)
   */
  private getNextRunTime(): Date {
    const now = new Date();
    const minutes = now.getMinutes();
    const nextMinutes = Math.ceil(minutes / 5) * 5;
    
    if (nextMinutes === 60) {
      now.setHours(now.getHours() + 1);
      now.setMinutes(0);
    } else {
      now.setMinutes(nextMinutes);
    }
    
    now.setSeconds(0);
    now.setMilliseconds(0);
    
    return now;
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('🛑 Shutting down price sync cron service...');
    
    // Stop the job
    this.stop();
    
    // Wait for any running sync to complete
    if (this.isRunning) {
      logger.info('Waiting for running sync to complete...');
      
      // Wait up to 30 seconds for sync to complete
      const maxWait = 30000;
      const startWait = Date.now();
      
      while (this.isRunning && (Date.now() - startWait) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (this.isRunning) {
        logger.warn('Force stopping price sync after timeout');
      }
    }
    
    logger.info('✅ Price sync cron service shutdown completed');
  }
}

// Singleton instance
export const priceSyncCronService = new PriceSyncCronService();