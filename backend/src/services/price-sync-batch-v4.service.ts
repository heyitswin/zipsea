/**
 * Price Sync Batch Service V4
 * Uses comprehensive FTP sync to download ALL cruise data for updated lines
 */

import { logger } from '../config/logger';
import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import { ftpComprehensiveSyncService } from './ftp-comprehensive-sync.service';
import { slackService } from './slack.service';
import { v4 as uuidv4 } from 'uuid';

interface SyncResult {
  linesProcessed: number;
  totalFilesFound: number;
  totalFilesProcessed: number;
  totalCruisesCreated: number;
  totalCruisesUpdated: number;
  totalPricesUpdated: number;
  totalErrors: number;
  skippedLines: number;
  duration: number;
  details: any[];
}

export class PriceSyncBatchServiceV4 {
  private readonly MAX_LINES_PER_RUN = 3; // Process max 3 lines per cron run
  private readonly workerId: string;

  constructor() {
    this.workerId = `worker-${uuidv4().slice(0, 8)}`;
  }

  /**
   * Main entry point for batch price sync
   */
  async syncBatch(): Promise<SyncResult> {
    const startTime = Date.now();
    
    logger.info(`🚀 Starting batch price sync V4 (comprehensive)`, {
      workerId: this.workerId,
      maxPerRun: this.MAX_LINES_PER_RUN
    });

    const result: SyncResult = {
      linesProcessed: 0,
      totalFilesFound: 0,
      totalFilesProcessed: 0,
      totalCruisesCreated: 0,
      totalCruisesUpdated: 0,
      totalPricesUpdated: 0,
      totalErrors: 0,
      skippedLines: 0,
      duration: 0,
      details: []
    };

    try {
      // Get cruise lines that need price updates
      const linesToSync = await this.getLinesToSync();
      
      if (linesToSync.length === 0) {
        logger.info('No cruise lines need price updates');
        return result;
      }

      const linesToProcess = linesToSync.slice(0, this.MAX_LINES_PER_RUN);
      const skipped = linesToSync.slice(this.MAX_LINES_PER_RUN);
      
      result.skippedLines = skipped.length;
      
      logger.info(`📋 Processing ${linesToProcess.length} cruise lines`, {
        cruiseLines: linesToProcess,
        skipped: skipped.length
      });

      // Send Slack notification - starting
      await slackService.notifyCustomMessage({
        title: `🔄 Starting batch price sync V4`,
        message: `Processing ${linesToProcess.length} cruise lines (${skipped.length} deferred)`,
        details: {
          cruiseLines: linesToProcess,
          workerId: this.workerId,
          maxPerRun: this.MAX_LINES_PER_RUN
        }
      });

      // Process each cruise line with comprehensive sync
      for (const lineId of linesToProcess) {
        logger.info(`\n🚢 Starting comprehensive sync for cruise line ${lineId}`);
        
        try {
          // Acquire lock for this line
          const lockId = await this.acquireLock(lineId);
          if (!lockId) {
            logger.warn(`Could not acquire lock for line ${lineId}, skipping`);
            result.skippedLines++;
            continue;
          }

          // Run comprehensive sync for this line
          const lineResult = await ftpComprehensiveSyncService.syncCruiseLine(lineId);
          
          // Update results
          result.linesProcessed++;
          result.totalFilesFound += lineResult.filesFound;
          result.totalFilesProcessed += lineResult.filesProcessed;
          result.totalCruisesCreated += lineResult.cruisesCreated;
          result.totalCruisesUpdated += lineResult.cruisesUpdated;
          result.totalPricesUpdated += lineResult.pricesUpdated;
          result.totalErrors += lineResult.errors;
          
          result.details.push({
            lineId,
            ...lineResult
          });

          // Release lock
          await this.releaseLock(lockId, lineResult);

          // Clear needs_price_update flag for this line
          await db.execute(sql`
            UPDATE cruises
            SET needs_price_update = false
            WHERE cruise_line_id = ${lineId}
              AND needs_price_update = true
          `);

          logger.info(`✅ Completed sync for line ${lineId}:`, {
            filesProcessed: lineResult.filesProcessed,
            cruisesCreated: lineResult.cruisesCreated,
            cruisesUpdated: lineResult.cruisesUpdated,
            pricesUpdated: lineResult.pricesUpdated
          });

        } catch (error) {
          logger.error(`❌ Error syncing line ${lineId}:`, error);
          result.totalErrors++;
        }
      }

      result.duration = Date.now() - startTime;

      // Send final notification
      const statusIcon = result.totalErrors > 0 ? '⚠️' : '✅';
      await slackService.notifyCustomMessage({
        title: `${statusIcon} Price sync V4 completed`,
        message: `Created: ${result.totalCruisesCreated} | Updated: ${result.totalCruisesUpdated} | Errors: ${result.totalErrors}`,
        details: {
          filesFound: result.totalFilesFound,
          filesProcessed: result.totalFilesProcessed,
          cruisesCreated: result.totalCruisesCreated,
          cruisesUpdated: result.totalCruisesUpdated,
          pricesUpdated: result.totalPricesUpdated,
          errors: result.totalErrors,
          duration: result.duration,
          skippedLines: result.skippedLines,
          workerId: this.workerId,
          perLineDetails: result.details
        }
      });

      logger.info(`✅ Batch sync V4 completed in ${Math.round(result.duration / 1000)}s`, result);

    } catch (error) {
      logger.error('❌ Fatal error in batch sync:', error);
      result.totalErrors++;
      
      await slackService.notifyCustomMessage({
        title: '❌ Fatal error in batch sync V4',
        message: (error as Error).message,
        details: {
          service: 'PriceSyncBatchV4',
          workerId: this.workerId,
          error: (error as Error).stack
        }
      });
    }

    return result;
  }

  /**
   * Get cruise lines that need price sync
   */
  private async getLinesToSync(): Promise<number[]> {
    const result = await db.execute(sql`
      SELECT DISTINCT cruise_line_id
      FROM cruises
      WHERE needs_price_update = true
        AND sailing_date >= CURRENT_DATE
      ORDER BY cruise_line_id
    `);

    return result.map(row => row.cruise_line_id as number);
  }

  /**
   * Acquire lock for a cruise line
   */
  private async acquireLock(lineId: number): Promise<number | null> {
    try {
      // Check for existing lock
      const existing = await db.execute(sql`
        SELECT id FROM sync_locks
        WHERE cruise_line_id = ${lineId}
          AND lock_type = 'comprehensive_sync'
          AND status = 'processing'
      `);

      if (existing.length > 0) {
        return null;
      }

      // Create new lock
      const lockResult = await db.execute(sql`
        INSERT INTO sync_locks (
          cruise_line_id,
          lock_type,
          locked_by,
          status
        ) VALUES (
          ${lineId},
          'comprehensive_sync',
          ${this.workerId},
          'processing'
        )
        RETURNING id
      `);

      return lockResult[0]?.id || null;
    } catch (error) {
      logger.error(`Error acquiring lock for line ${lineId}:`, error);
      return null;
    }
  }

  /**
   * Release lock after processing
   */
  private async releaseLock(lockId: number, result: any): Promise<void> {
    try {
      await db.execute(sql`
        UPDATE sync_locks
        SET 
          status = 'completed',
          completed_at = CURRENT_TIMESTAMP,
          cruises_processed = ${result.cruisesCreated + result.cruisesUpdated},
          error_count = ${result.errors}
        WHERE id = ${lockId}
      `);
    } catch (error) {
      logger.error(`Error releasing lock ${lockId}:`, error);
    }
  }
}

// Export singleton instance
export const priceSyncBatchServiceV4 = new PriceSyncBatchServiceV4();