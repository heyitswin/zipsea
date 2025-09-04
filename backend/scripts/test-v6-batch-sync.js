#!/usr/bin/env node

/**
 * Test the v6 batch sync service
 * This script manually triggers the batch sync to test the new implementation
 */

require('dotenv').config();
const { priceSyncBatchServiceV6 } = require('../dist/services/price-sync-batch-v6.service');

const logger = {
  info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args)
};

async function testV6BatchSync() {
  logger.info('🧪 TESTING V6 BATCH SYNC SERVICE');
  logger.info('='.repeat(80));

  try {
    logger.info('\n📋 Starting manual batch sync test...');
    logger.info('This will process cruises flagged with needs_price_update=true');

    const startTime = Date.now();

    // Run the batch sync
    const result = await priceSyncBatchServiceV6.syncBatch();

    const duration = Date.now() - startTime;

    // Display results
    logger.info('\n' + '='.repeat(80));
    logger.info('📊 BATCH SYNC RESULTS');
    logger.info('='.repeat(80));

    logger.info(`\n✅ Sync completed in ${Math.round(duration / 1000)} seconds`);
    logger.info(`\n📈 Statistics:`);
    logger.info(`  - Lines processed: ${result.linesProcessed}`);
    logger.info(`  - Files found: ${result.totalFilesFound}`);
    logger.info(`  - Files processed: ${result.totalFilesProcessed}`);
    logger.info(`  - Cruises created: ${result.totalCruisesCreated}`);
    logger.info(`  - Cruises updated: ${result.totalCruisesUpdated}`);
    logger.info(`  - Prices updated: ${result.totalPricesUpdated}`);
    logger.info(`  - Errors: ${result.totalErrors}`);
    logger.info(`  - Cruises processed: ${result.processedCruiseIds.length}`);
    logger.info(`  - Remaining cruises: ${result.remainingCruises}`);

    if (result.details && result.details.length > 0) {
      logger.info(`\n📝 Line Details:`);
      result.details.forEach(detail => {
        logger.info(`  Line ${detail.lineId}:`);
        logger.info(`    - Files: ${detail.filesProcessed}/${detail.filesFound}`);
        logger.info(`    - Created: ${detail.cruisesCreated}`);
        logger.info(`    - Updated: ${detail.cruisesUpdated}`);
        logger.info(`    - Remaining: ${detail.remainingCruises || 0}`);
      });
    }

    if (result.remainingCruises > 0) {
      logger.warn(`\n⚠️ ${result.remainingCruises} cruises still need processing`);
      logger.info('These will be processed in the next batch run');
    } else {
      logger.info('\n✅ All flagged cruises have been processed!');
    }

    // Show sample of processed cruise IDs
    if (result.processedCruiseIds.length > 0) {
      logger.info(`\n🎯 Sample processed cruise IDs (first 10):`);
      result.processedCruiseIds.slice(0, 10).forEach(id => {
        logger.info(`  - ${id}`);
      });
    }

    logger.info('\n' + '='.repeat(80));
    logger.info('🎉 TEST COMPLETED SUCCESSFULLY');
    logger.info('='.repeat(80));

  } catch (error) {
    logger.error('❌ Test failed:', error.message);
    if (error.stack) {
      logger.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testV6BatchSync().catch(error => {
  logger.error('❌ Unhandled error:', error);
  process.exit(1);
});
