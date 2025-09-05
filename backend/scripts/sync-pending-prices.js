#!/usr/bin/env node

/**
 * Cron job script to sync pending price updates
 * Runs every 5 minutes via Render cron job
 * Now includes pause flag check to prevent conflicts during FTP sync
 */

require('dotenv').config();
const { priceSyncBatchService } = require('../dist/services/price-sync-batch.service');
const { queuePriceSync } = require('../dist/queues/price-sync-queue');
const logger = require('../dist/config/logger').default;
const { Client } = require('pg');

async function checkBatchSyncPaused() {
  const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn('No database URL found - continuing with batch sync');
    return false;
  }

  const dbClient = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    await dbClient.connect();
    const result = await dbClient.query(`
      SELECT flag_value FROM system_flags WHERE flag_name = 'batch_sync_paused'
    `);

    if (result.rows.length > 0 && result.rows[0].flag_value === true) {
      return true;
    }
    return false;
  } catch (error) {
    // If system_flags table doesn't exist or query fails, continue normally
    logger.warn('Could not check batch sync pause status:', error.message);
    return false;
  } finally {
    await dbClient.end();
  }
}

async function run() {
  const startTime = Date.now();
  logger.info('🕐 Starting scheduled price sync job');

  try {
    // Check if batch sync is paused
    const isPaused = await checkBatchSyncPaused();
    if (isPaused) {
      logger.info('🛑 Batch sync is paused - skipping processing');
      process.exit(0);
    }

    // Try to queue the job first (if Redis available)
    // This allows for better monitoring and retry logic
    try {
      await queuePriceSync({
        source: 'cron',
        priority: 1,
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
        errors: result.errors.length,
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
