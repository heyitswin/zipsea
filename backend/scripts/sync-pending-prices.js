#!/usr/bin/env node

/**
 * Cron job script to sync pending price updates
 * Runs every 5 minutes via Render cron job
 */

require('dotenv').config();
const { priceSyncBatchService } = require('../dist/services/price-sync-batch.service');
const { queuePriceSync } = require('../dist/queues/price-sync-queue');
const logger = require('../dist/config/logger').default;

async function run() {
  const startTime = Date.now();
  logger.info('🕐 Starting scheduled price sync job');
  
  try {
    // Try to queue the job first (if Redis available)
    // This allows for better monitoring and retry logic
    try {
      await queuePriceSync({ 
        source: 'cron',
        priority: 1 
      });
      logger.info('✅ Price sync job queued successfully');
    } catch (queueError) {
      // If queueing fails, run directly
      logger.warn('Could not queue job, running directly:', queueError.message);
      const result = await priceSyncBatchService.syncPendingPriceUpdates();
      
      const duration = Date.now() - startTime;
      logger.info(`✅ Price sync completed in ${duration}ms`, {
        created: result.created,
        updated: result.updated,
        failed: result.failed,
        errors: result.errors.length
      });
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('❌ Price sync job failed:', error);
    process.exit(1);
  }
}

// Run the sync
run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});