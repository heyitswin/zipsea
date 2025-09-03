#!/usr/bin/env ts-node

/**
 * Clean Up Batch Sync Flags Script
 * 
 * This script removes the needs_price_update flag approach and cleans up
 * any remaining flags since we're now using real-time processing.
 */

import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import { logger } from '../config/logger';
import { slackService } from '../services/slack.service';

async function cleanupBatchFlags(): Promise<void> {
  logger.info('🧹 Starting batch sync flags cleanup...');
  
  try {
    // Check current state
    const currentStats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_cruises,
        COUNT(*) FILTER (WHERE needs_price_update = true) as flagged_for_update,
        COUNT(*) FILTER (WHERE needs_price_update = false OR needs_price_update IS NULL) as not_flagged,
        COUNT(*) FILTER (WHERE price_update_requested_at IS NOT NULL) as has_request_timestamp
      FROM cruises
    `);

    const stats = currentStats[0];
    logger.info('📊 Current flag state:', stats);

    // Clear all needs_price_update flags
    const clearFlagsResult = await db.execute(sql`
      UPDATE cruises 
      SET 
        needs_price_update = false,
        price_update_requested_at = NULL
      WHERE needs_price_update = true 
        OR price_update_requested_at IS NOT NULL
    `);

    const updatedCount = clearFlagsResult.rowCount || 0;

    logger.info(`✅ Cleared batch sync flags for ${updatedCount} cruises`);

    // Verify cleanup
    const verificationStats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_cruises,
        COUNT(*) FILTER (WHERE needs_price_update = true) as still_flagged,
        COUNT(*) FILTER (WHERE price_update_requested_at IS NOT NULL) as still_has_timestamp
      FROM cruises
    `);

    const verification = verificationStats[0];
    
    if (verification.still_flagged === 0 && verification.still_has_timestamp === 0) {
      logger.info('✅ All batch sync flags successfully cleared');
      
      // Send success notification to Slack
      await slackService.notifyCustomMessage({
        title: '🧹 Batch Sync Flags Cleaned Up',
        message: `Successfully cleared needs_price_update flags for ${updatedCount} cruises`,
        details: {
          before: stats,
          after: verification,
          clearedFlags: updatedCount,
          note: 'System now uses real-time webhook processing instead of batch flags'
        }
      });

    } else {
      logger.error('❌ Cleanup verification failed', verification);
      throw new Error(`Still have ${verification.still_flagged} flagged cruises and ${verification.still_has_timestamp} with timestamps`);
    }

    // Optional: Clean up old webhook_events that relied on batch processing
    const oldWebhookCleanup = await db.execute(sql`
      DELETE FROM webhook_events 
      WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
        AND processed = false
    `);

    const cleanedWebhooks = oldWebhookCleanup.rowCount || 0;
    if (cleanedWebhooks > 0) {
      logger.info(`🗑️ Cleaned up ${cleanedWebhooks} old unprocessed webhook events`);
    }

    logger.info('🎉 Batch sync flags cleanup completed successfully!');

  } catch (error) {
    logger.error('❌ Error during batch sync flags cleanup:', error);
    
    // Send error notification to Slack
    await slackService.notifySyncError(
      error instanceof Error ? error.message : 'Unknown error',
      'Batch sync flags cleanup'
    );
    
    throw error;
  }
}

/**
 * Show current batch flag status without making changes
 */
async function showBatchFlagStatus(): Promise<void> {
  logger.info('📊 Checking current batch sync flag status...');

  try {
    // Overall stats
    const overallStats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_cruises,
        COUNT(*) FILTER (WHERE needs_price_update = true) as needs_update,
        COUNT(*) FILTER (WHERE needs_price_update = false) as up_to_date,
        COUNT(*) FILTER (WHERE needs_price_update IS NULL) as null_flags,
        COUNT(*) FILTER (WHERE price_update_requested_at IS NOT NULL) as has_request_time,
        MAX(price_update_requested_at) as latest_request,
        MIN(price_update_requested_at) as oldest_request
      FROM cruises
    `);

    // Stats by cruise line
    const byLineStats = await db.execute(sql`
      SELECT 
        cl.name as cruise_line_name,
        c.cruise_line_id,
        COUNT(*) as total_cruises,
        COUNT(*) FILTER (WHERE c.needs_price_update = true) as needs_update,
        MAX(c.price_update_requested_at) as latest_request
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.needs_price_update = true 
        OR c.price_update_requested_at IS NOT NULL
      GROUP BY cl.name, c.cruise_line_id
      ORDER BY needs_update DESC
      LIMIT 20
    `);

    const overall = overallStats[0];
    
    logger.info('📊 Overall Batch Flag Status:', {
      totalCruises: overall.total_cruises,
      needsUpdate: overall.needs_update,
      upToDate: overall.up_to_date,
      nullFlags: overall.null_flags,
      hasRequestTime: overall.has_request_time,
      oldestRequest: overall.oldest_request,
      latestRequest: overall.latest_request
    });

    if (byLineStats.length > 0) {
      logger.info('📋 Cruise Lines with Batch Flags:', byLineStats.map(line => ({
        cruiseLineName: line.cruise_line_name,
        lineId: line.cruise_line_id,
        totalCruises: line.total_cruises,
        needsUpdate: line.needs_update,
        latestRequest: line.latest_request
      })));
    }

    // Send status to Slack
    await slackService.notifyCustomMessage({
      title: '📊 Batch Sync Flag Status Report',
      message: `${overall.needs_update} cruises still flagged for batch updates out of ${overall.total_cruises} total`,
      details: {
        overall,
        topLinesWithFlags: byLineStats.slice(0, 10),
        recommendation: overall.needs_update > 0 ? 
          'Run cleanup-batch-flags script to clear old flags and switch to real-time processing' :
          'No batch flags found - system is clean for real-time processing'
      }
    });

  } catch (error) {
    logger.error('❌ Error checking batch flag status:', error);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case 'status':
        await showBatchFlagStatus();
        break;
      case 'cleanup':
        await cleanupBatchFlags();
        break;
      default:
        logger.info(`
Usage: 
  npm run cleanup-batch-flags status  - Show current flag status
  npm run cleanup-batch-flags cleanup - Clear all batch sync flags

This script helps transition from batch sync flags to real-time webhook processing.
        `);
        break;
    }

  } catch (error) {
    logger.error('❌ Script execution failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { cleanupBatchFlags, showBatchFlagStatus };