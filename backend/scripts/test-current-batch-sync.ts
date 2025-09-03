#!/usr/bin/env tsx
/**
 * Test current batch sync behavior to verify the recent updates
 */

import { logger } from '../src/config/logger';
import { priceSyncBatchServiceV5 } from '../src/services/price-sync-batch-v5.service';

async function testBatchSync() {
  logger.info('🧪 Testing current batch sync behavior...');

  try {
    // Run a single batch sync to test the new limits and flag clearing
    const result = await priceSyncBatchServiceV5.syncBatch();
    
    logger.info('✅ Batch sync test completed successfully!', {
      linesProcessed: result.linesProcessed,
      totalCruisesProcessed: result.processedCruiseIds.length,
      totalFilesProcessed: result.totalFilesProcessed,
      totalCruisesUpdated: result.totalCruisesUpdated,
      totalPricesUpdated: result.totalPricesUpdated,
      totalErrors: result.totalErrors,
      skippedLines: result.skippedLines,
      durationMs: result.duration,
      processedCruiseIds: result.processedCruiseIds.slice(0, 10) // Show first 10 IDs
    });

    // Check if the updates worked as expected
    logger.info('📊 Processing summary:');
    logger.info(`  Lines processed: ${result.linesProcessed} (max allowed: 10)`);
    logger.info(`  Files processed: ${result.totalFilesProcessed}`);
    logger.info(`  Cruises updated: ${result.totalCruisesUpdated}`);
    logger.info(`  Price snapshots: ${result.totalPricesUpdated}`);
    logger.info(`  Tracked cruise IDs: ${result.processedCruiseIds.length}`);
    logger.info(`  Errors: ${result.totalErrors}`);
    logger.info(`  Duration: ${(result.duration / 1000).toFixed(2)}s`);

    if (result.processedCruiseIds.length > 0) {
      logger.info(`✅ Flag clearing worked - processed ${result.processedCruiseIds.length} cruise IDs`);
    } else {
      logger.warn('⚠️ No cruise IDs were processed - flag clearing logic may not be triggered');
    }

  } catch (error) {
    logger.error('❌ Test batch sync failed:', error);
  } finally {
    process.exit(0);
  }
}

testBatchSync().catch(console.error);