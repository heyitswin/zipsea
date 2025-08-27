#!/usr/bin/env ts-node

import { priceSyncBatchServiceV2 } from '../services/price-sync-batch-v2.service';
import { slackService } from '../services/slack.service';
import logger from '../config/logger';

/**
 * Manual trigger for batch sync process
 * This simulates what the cron job should do
 */
async function triggerBatchSync() {
  logger.info('🚀 Manually triggering batch sync process...');
  
  const startTime = Date.now();
  
  try {
    // Run the batch sync
    const result = await priceSyncBatchServiceV2.syncPendingPriceUpdates();
    
    const duration = Date.now() - startTime;
    
    logger.info('✅ Batch sync completed:', {
      filesFound: result.filesFound,
      filesProcessed: result.filesProcessed,
      cruisesUpdated: result.cruisesUpdated,
      cruisesNotFound: result.cruisesNotFound,
      errors: result.errors,
      durationMs: duration
    });
    
    // Send summary via Slack
    await slackService.notifyCustomMessage({
      title: '🧪 Manual Batch Sync Test Complete',
      message: `Processed ${result.filesProcessed}/${result.filesFound} files, updated ${result.cruisesUpdated} cruises`,
      details: {
        ...result,
        manualTrigger: true,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('❌ Batch sync failed:', error);
    
    await slackService.notifyCustomMessage({
      title: '❌ Manual Batch Sync Failed',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        manualTrigger: true,
        timestamp: new Date().toISOString()
      }
    });
    
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the batch sync
triggerBatchSync().catch(console.error);