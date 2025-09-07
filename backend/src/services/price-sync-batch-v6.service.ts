/**
 * Price Sync Batch Service V6
 * Improved version that only clears flags for fully synced cruises
 */

import { logger } from '../config/logger';
import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import { ftpConnectionPool } from './ftp-connection-pool.service';
import { enhancedSlackService } from './slack-enhanced.service';
import { v4 as uuidv4 } from 'uuid';
import { Writable } from 'stream';

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
  processedCruiseIds: string[];
  remainingCruises: number; // Track how many cruises still need sync
}

export class PriceSyncBatchServiceV6 {
  private readonly MAX_LINES_PER_RUN = 10;
  private readonly MONTHS_TO_SYNC = 24; // Sync 2 years ahead
  private readonly MAX_FILES_PER_BATCH = 1000; // Process in smaller batches
  private readonly FILE_DOWNLOAD_TIMEOUT = 10000; // 10 seconds per file
  private readonly workerId: string;

  constructor() {
    this.workerId = `worker-${uuidv4().slice(0, 8)}`;
  }

  async syncBatch(): Promise<SyncResult> {
    const startTime = Date.now();

    logger.info(`🚀 Starting batch price sync V6 (improved flag handling)`, {
      workerId: this.workerId,
      maxPerRun: this.MAX_LINES_PER_RUN,
      monthsToSync: this.MONTHS_TO_SYNC,
      maxFilesPerBatch: this.MAX_FILES_PER_BATCH,
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
      details: [],
      processedCruiseIds: [],
      remainingCruises: 0,
    };

    try {
      // Get cruise lines that need updates
      const linesToSync = await this.getLinesToSync();

      if (linesToSync.length === 0) {
        logger.info('No cruise lines need price updates');
        return result;
      }

      const linesToProcess = linesToSync.slice(0, this.MAX_LINES_PER_RUN);
      result.skippedLines = linesToSync.length - linesToProcess.length;

      // Get total pending count for notification
      const pendingResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM cruises
        WHERE needs_price_update = true
      `);
      const totalPending = Number(pendingResult[0]?.total || 0);

      logger.info(`📋 Processing ${linesToProcess.length} cruise lines`, {
        cruiseLines: linesToProcess,
        skipped: result.skippedLines,
        totalPending,
      });

      // Send Slack notification
      await enhancedSlackService.notifySyncStatus('Batch Price Sync', 'started', {
        totalLines: linesToProcess.length,
        totalCruises: totalPending,
        lineNames: linesToProcess.map(id => `Line ${id}`),
        syncId: `batch_${Date.now()}`,
      });

      // Process each cruise line
      for (const lineId of linesToProcess) {
        try {
          const lineResult = await this.syncCruiseLineInBatches(lineId);

          result.linesProcessed++;
          result.totalFilesFound += lineResult.filesFound;
          result.totalFilesProcessed += lineResult.filesProcessed;
          result.totalCruisesCreated += lineResult.cruisesCreated;
          result.totalCruisesUpdated += lineResult.cruisesUpdated;
          result.totalPricesUpdated += lineResult.pricesUpdated;
          result.totalErrors += lineResult.errors;
          result.remainingCruises += lineResult.remainingCruises || 0;

          // Collect processed cruise IDs
          result.processedCruiseIds.push(...lineResult.processedCruiseIds);

          result.details.push({
            lineId,
            ...lineResult,
          });
        } catch (error) {
          logger.error(`❌ Error syncing line ${lineId}:`, error);
          result.totalErrors++;
        }
      }

      result.duration = Date.now() - startTime;

      // Check remaining cruises needing updates
      const remainingCount = await this.getRemainingSyncCount();
      result.remainingCruises = remainingCount;

      // Send completion notification
      const statusIcon = result.remainingCruises > 0 ? '⏳' : '✅';
      const statusMessage =
        result.remainingCruises > 0
          ? `Batch complete - ${result.remainingCruises} cruises still pending`
          : 'All flagged cruises processed!';

      await enhancedSlackService.notifySyncStatus(
        'Batch Price Sync',
        result.totalErrors > 0 ? 'failed' : 'completed',
        {
          syncId: `batch_${startTime}`,
          totalLines: result.linesProcessed,
          totalCruises: result.processedCruiseIds.length,
          successfulUpdates: result.totalCruisesUpdated,
          newCruisesCreated: result.totalCruisesCreated,
          errors: result.totalErrors,
          duration: Math.round(result.duration / 1000),
          remainingCruises: result.remainingCruises,
        }
      );

      logger.info(`✅ Batch sync V6 completed in ${Math.round(result.duration / 1000)}s`, result);
    } catch (error) {
      logger.error('❌ Fatal error in batch sync:', error);
      result.totalErrors++;
    }

    return result;
  }

  /**
   * Sync a single cruise line in batches
   */
  private async syncCruiseLineInBatches(lineId: number): Promise<any> {
    const result = {
      filesFound: 0,
      filesProcessed: 0,
      cruisesCreated: 0,
      cruisesUpdated: 0,
      pricesUpdated: 0,
      errors: 0,
      processedCruiseIds: [] as string[],
      remainingCruises: 0,
    };

    let connection: any = null;

    try {
      // Get cruises needing sync for this line
      const cruisesToSync = await this.getCruisesNeedingSync(lineId);
      logger.info(`🎯 Line ${lineId} has ${cruisesToSync.length} cruises needing sync`);

      if (cruisesToSync.length === 0) {
        return result;
      }

      // Get FTP connection
      connection = await Promise.race([
        ftpConnectionPool.getConnection(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('FTP connection timeout')), 30000)
        ),
      ]);

      logger.info(`🔗 Got FTP connection for line ${lineId}`);

      // Process in batches
      let batchStart = 0;
      while (
        batchStart < cruisesToSync.length &&
        result.filesProcessed < this.MAX_FILES_PER_BATCH
      ) {
        const batchEnd = Math.min(batchStart + this.MAX_FILES_PER_BATCH, cruisesToSync.length);
        const batch = cruisesToSync.slice(batchStart, batchEnd);

        logger.info(
          `📦 Processing batch ${batchStart}-${batchEnd} of ${cruisesToSync.length} for line ${lineId}`
        );

        for (const cruise of batch) {
          if (result.filesProcessed >= this.MAX_FILES_PER_BATCH) {
            logger.info(`Reached batch limit for line ${lineId}`);
            break;
          }

          const success = await this.processCruise(connection, cruise, lineId, result);
          if (success) {
            // Only clear flag for successfully processed cruises
            await this.clearCruiseFlag(cruise.id);
            result.processedCruiseIds.push(cruise.id);
          }
        }

        batchStart = batchEnd;
      }

      // Calculate remaining
      result.remainingCruises = cruisesToSync.length - result.processedCruiseIds.length;

      logger.info(`✅ Line ${lineId} batch complete:`, {
        processed: result.filesProcessed,
        remaining: result.remainingCruises,
        successRate:
          result.filesProcessed > 0
            ? `${Math.round((result.filesProcessed / cruisesToSync.length) * 100)}%`
            : '0%',
      });
    } catch (error) {
      logger.error(`Error syncing line ${lineId}:`, error);
      result.errors++;
    } finally {
      if (connection) {
        ftpConnectionPool.releaseConnection(connection);
      }
    }

    return result;
  }

  /**
   * Process a single cruise file
   */
  private async processCruise(
    connection: any,
    cruise: any,
    lineId: number,
    result: any
  ): Promise<boolean> {
    try {
      const year = new Date(cruise.sailing_date).getFullYear();
      const month = String(new Date(cruise.sailing_date).getMonth() + 1).padStart(2, '0');
      const filePath = `${year}/${month}/${lineId}/${cruise.ship_id}/${cruise.cruise_id}.json`;

      result.filesFound++;

      const cruiseData = await this.downloadAndParseCruise(connection, filePath);

      if (cruiseData) {
        const upsertResult = await this.upsertCruise(cruiseData, lineId, cruise.ship_id);
        result.filesProcessed++;

        if (upsertResult.created) {
          result.cruisesCreated++;
        } else {
          result.cruisesUpdated++;
        }

        if (upsertResult.priceUpdated) {
          result.pricesUpdated++;
        }

        return true; // Success
      }

      return false; // Failed to download/parse
    } catch (err) {
      result.errors++;
      logger.debug(`Error processing cruise ${cruise.cruise_id}:`, err);
      return false;
    }
  }

  /**
   * Clear the needs_price_update flag for a single cruise
   */
  private async clearCruiseFlag(cruiseId: string): Promise<void> {
    await db.execute(sql`
      UPDATE cruises
      SET needs_price_update = false
      WHERE id = ${cruiseId}
    `);
  }

  /**
   * Get cruises needing sync for a specific line
   */
  private async getCruisesNeedingSync(lineId: number): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT c.id, c.cruise_id, c.sailing_date, s.id as ship_id
      FROM cruises c
      JOIN ships s ON c.ship_id = s.id
      WHERE s.cruise_line_id = ${lineId}
        AND c.needs_price_update = true
        AND c.sailing_date >= CURRENT_DATE
        AND c.is_active = true
      ORDER BY c.sailing_date
      LIMIT 5000
    `);

    return result;
  }

  /**
   * Get total remaining cruises needing sync
   */
  private async getRemainingSyncCount(): Promise<number> {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM cruises
      WHERE needs_price_update = true
        AND sailing_date >= CURRENT_DATE
        AND is_active = true
    `);

    return parseInt(result[0].count) || 0;
  }

  /**
   * Get cruise lines needing sync
   */
  private async getLinesToSync(): Promise<number[]> {
    const result = await db.execute(sql`
      SELECT DISTINCT s.cruise_line_id
      FROM cruises c
      JOIN ships s ON c.ship_id = s.id
      WHERE c.needs_price_update = true
        AND c.sailing_date >= CURRENT_DATE
        AND c.is_active = true
      ORDER BY s.cruise_line_id
    `);

    return result.map(row => row.cruise_line_id as number);
  }

  /**
   * Download and parse cruise file with timeout
   */
  private async downloadAndParseCruise(connection: any, filePath: string): Promise<any> {
    try {
      const chunks: Buffer[] = [];
      const writableStream = new Writable({
        write(chunk: Buffer, encoding: string, callback: Function) {
          chunks.push(chunk);
          callback();
        },
      });

      await Promise.race([
        connection.downloadTo(writableStream, filePath),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Download timeout')), this.FILE_DOWNLOAD_TIMEOUT)
        ),
      ]);

      const buffer = Buffer.concat(chunks);
      const content = buffer.toString();
      return JSON.parse(content);
    } catch (err) {
      return null;
    }
  }

  /**
   * Upsert cruise data
   */
  private async upsertCruise(data: any, lineId: number, shipId: number): Promise<any> {
    const cruiseId = String(data.codetocruiseid);

    // First ensure ship exists
    try {
      await db.execute(sql`
        INSERT INTO ships (id, cruise_line_id, name, code, is_active)
        VALUES (
          ${shipId},
          ${lineId},
          ${data.shipcontent?.name || `Ship ${shipId}`},
          ${data.shipcontent?.code || `S${shipId}`},
          true
        )
        ON CONFLICT (id) DO UPDATE SET
          cruise_line_id = EXCLUDED.cruise_line_id,
          updated_at = CURRENT_TIMESTAMP
      `);
    } catch (err) {
      logger.debug(`Ship ${shipId} creation/update handled`);
    }

    // Extract prices
    const prices = {
      interior: data.cheapestinside ? parseFloat(String(data.cheapestinside)) : null,
      oceanview: data.cheapestoutside ? parseFloat(String(data.cheapestoutside)) : null,
      balcony: data.cheapestbalcony ? parseFloat(String(data.cheapestbalcony)) : null,
      suite: data.cheapestsuite ? parseFloat(String(data.cheapestsuite)) : null,
    };

    const validPrices = [prices.interior, prices.oceanview, prices.balcony, prices.suite].filter(
      p => p !== null && p > 0
    ) as number[];
    const cheapestPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

    // Upsert cruise
    const upsertResult = await db.execute(sql`
      INSERT INTO cruises (
        id,
        cruise_id,
        cruise_line_id,
        ship_id,
        name,
        sailing_date,
        nights,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price,
        is_active
      ) VALUES (
        ${cruiseId},
        ${String(data.cruiseid)},
        ${lineId},
        ${shipId},
        ${data.cruisename || 'Unknown Cruise'},
        ${new Date(data.saildate)},
        ${parseInt(data.nights) || 0},
        ${prices.interior},
        ${prices.oceanview},
        ${prices.balcony},
        ${prices.suite},
        ${cheapestPrice},
        true
      )
      ON CONFLICT (id) DO UPDATE SET
        interior_price = EXCLUDED.interior_price,
        oceanview_price = EXCLUDED.oceanview_price,
        balcony_price = EXCLUDED.balcony_price,
        suite_price = EXCLUDED.suite_price,
        cheapest_price = EXCLUDED.cheapest_price,
        updated_at = CURRENT_TIMESTAMP
    `);

    return {
      created: false, // Simplified for now
      priceUpdated: true,
      cruiseId: cruiseId,
    };
  }
}

export const priceSyncBatchServiceV6 = new PriceSyncBatchServiceV6();
