/**
 * Price Sync Batch Service V5
 * Optimized version with timeouts and limited scope
 */

import { logger } from '../config/logger';
import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import { ftpConnectionPool } from './ftp-connection-pool.service';
import { slackService } from './slack.service';
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
  processedCruiseIds: string[]; // Track all processed cruise IDs
}

export class PriceSyncBatchServiceV5 {
  private readonly MAX_LINES_PER_RUN = 10; // Doubled from 5 to 10
  private readonly MONTHS_TO_SYNC = 24; // Sync 2 years ahead for cruise bookings
  private readonly MAX_FILES_PER_LINE = 2000; // Increased to handle more months
  private readonly FILE_DOWNLOAD_TIMEOUT = 10000; // 10 seconds per file
  private readonly workerId: string;

  constructor() {
    this.workerId = `worker-${uuidv4().slice(0, 8)}`;
  }

  async syncBatch(): Promise<SyncResult> {
    const startTime = Date.now();
    
    logger.info(`🚀 Starting batch price sync V5 (optimized)`, {
      workerId: this.workerId,
      maxPerRun: this.MAX_LINES_PER_RUN,
      monthsToSync: this.MONTHS_TO_SYNC
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
      processedCruiseIds: []
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
      
      logger.info(`📋 Processing ${linesToProcess.length} cruise lines`, {
        cruiseLines: linesToProcess,
        skipped: result.skippedLines
      });

      // Send Slack notification
      await slackService.notifyCustomMessage({
        title: `🔄 Starting batch price sync V5`,
        message: `Processing ${linesToProcess.length} lines (all future cruises - ${this.MONTHS_TO_SYNC} months)`,
        details: {
          cruiseLines: linesToProcess,
          workerId: this.workerId
        }
      });

      // Process each cruise line
      for (const lineId of linesToProcess) {
        try {
          const lineResult = await this.syncCruiseLineOptimized(lineId);
          
          result.linesProcessed++;
          result.totalFilesFound += lineResult.filesFound;
          result.totalFilesProcessed += lineResult.filesProcessed;
          result.totalCruisesCreated += lineResult.cruisesCreated;
          result.totalCruisesUpdated += lineResult.cruisesUpdated;
          result.totalPricesUpdated += lineResult.pricesUpdated;
          result.totalErrors += lineResult.errors;
          
          // Collect processed cruise IDs
          result.processedCruiseIds.push(...lineResult.processedCruiseIds);
          
          result.details.push({
            lineId,
            ...lineResult
          });

          // Only clear needs_price_update flag for cruises that were ACTUALLY processed
          if (lineResult.processedCruiseIds.length > 0) {
            logger.info(`Clearing needs_price_update flag for ${lineResult.processedCruiseIds.length} processed cruises from line ${lineId}`);
            
            // Clear flags in batches to avoid SQL parameter limits
            const batchSize = 1000;
            for (let i = 0; i < lineResult.processedCruiseIds.length; i += batchSize) {
              const batch = lineResult.processedCruiseIds.slice(i, i + batchSize);
              const placeholders = batch.map(() => '?').join(',');
              
              await db.execute(sql`
                UPDATE cruises
                SET needs_price_update = false
                WHERE id IN (${sql.raw(batch.map(id => `'${id}'`).join(','))})
                  AND needs_price_update = true
              `);
            }
          } else {
            logger.info(`No cruises were processed for line ${lineId}, keeping needs_price_update flags intact`);
          }

        } catch (error) {
          logger.error(`❌ Error syncing line ${lineId}:`, error);
          result.totalErrors++;
        }
      }

      result.duration = Date.now() - startTime;

      // Send completion notification
      const statusIcon = result.totalErrors > 0 ? '⚠️' : '✅';
      await slackService.notifyCustomMessage({
        title: `${statusIcon} Price sync V5 completed`,
        message: `Created: ${result.totalCruisesCreated} | Updated: ${result.totalCruisesUpdated} | Processed: ${result.processedCruiseIds.length} cruises | Errors: ${result.totalErrors}`,
        details: {
          ...result,
          durationSeconds: Math.round(result.duration / 1000),
          totalProcessedCruises: result.processedCruiseIds.length
        }
      });

      // Check if there are still cruises needing updates
      const remainingLinesToSync = await this.getLinesToSync();
      const remainingCount = remainingLinesToSync.length;
      
      if (remainingCount > 0) {
        logger.warn(`⚠️ ${remainingCount} cruise lines still need price updates after this batch run`, {
          remainingLines: remainingLinesToSync
        });
        
        // Add to Slack notification
        await slackService.notifyCustomMessage({
          title: `⚠️ Remaining cruises need updates`,
          message: `${remainingCount} cruise lines still have cruises marked for price updates`,
          details: {
            remainingCruiseLines: remainingLinesToSync,
            note: "These will be processed in the next batch run"
          }
        });
      }

      logger.info(`✅ Batch sync V5 completed in ${Math.round(result.duration / 1000)}s`, result);

    } catch (error) {
      logger.error('❌ Fatal error in batch sync:', error);
      result.totalErrors++;
    }

    return result;
  }

  /**
   * Optimized sync for a single cruise line
   */
  private async syncCruiseLineOptimized(lineId: number): Promise<any> {
    const result = {
      filesFound: 0,
      filesProcessed: 0,
      cruisesCreated: 0,
      cruisesUpdated: 0,
      pricesUpdated: 0,
      errors: 0,
      processedCruiseIds: [] as string[] // Track processed cruise IDs for this line
    };

    let connection: any = null;

    try {
      // Get FTP connection with timeout
      connection = await Promise.race([
        ftpConnectionPool.getConnection(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('FTP connection timeout')), 30000)
        )
      ]);

      logger.info(`🔗 Got FTP connection for line ${lineId}`);

      // Generate paths for next 3 months only
      const paths = this.generateFTPPaths(lineId);
      let filesCollected = 0;

      for (const monthPath of paths) {
        if (filesCollected >= this.MAX_FILES_PER_LINE) {
          logger.info(`Reached file limit for line ${lineId}, stopping`);
          break;
        }

        try {
          // Check if path exists with timeout
          const shipDirs = await Promise.race([
            connection.list(monthPath),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('List timeout')), 15000)
            )
          ]);

          const directories = shipDirs.filter((item: any) => item.type === 2);
          
          if (directories.length === 0) continue;

          // Process first 6 ships only (doubled from 3)
          for (const shipDir of directories.slice(0, 6)) {
            if (filesCollected >= this.MAX_FILES_PER_LINE) break;

            const shipPath = `${monthPath}/${shipDir.name}`;
            
            try {
              const files = await Promise.race([
                connection.list(shipPath),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('List timeout')), 15000)
                )
              ]);

              const jsonFiles = files.filter((f: any) => f.name.endsWith('.json'));
              const filesToProcess = jsonFiles.slice(0, Math.min(100, this.MAX_FILES_PER_LINE - filesCollected)); // Doubled from 50 to 100
              
              result.filesFound += filesToProcess.length;
              filesCollected += filesToProcess.length;

              // Process files
              for (const file of filesToProcess) {
                try {
                  const filePath = `${shipPath}/${file.name}`;
                  const cruiseData = await this.downloadAndParseCruise(connection, filePath);
                  
                  if (cruiseData) {
                    const upsertResult = await this.upsertCruise(cruiseData, lineId, parseInt(shipDir.name));
                    result.filesProcessed++;
                    if (upsertResult.created) {
                      result.cruisesCreated++;
                    } else {
                      result.cruisesUpdated++;
                    }
                    if (upsertResult.priceUpdated) {
                      result.pricesUpdated++;
                    }
                    // Track the processed cruise ID
                    if (upsertResult.cruiseId) {
                      result.processedCruiseIds.push(upsertResult.cruiseId);
                    }
                  }
                } catch (err) {
                  result.errors++;
                }
              }
            } catch (err) {
              logger.warn(`Error processing ship ${shipDir.name}:`, err);
            }
          }
        } catch (err) {
          logger.warn(`Cannot access ${monthPath}:`, err);
        }
      }

      logger.info(`✅ Line ${lineId} sync complete:`, result);

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
   * Generate FTP paths for next 3 months
   */
  private generateFTPPaths(lineId: number): string[] {
    const paths: string[] = [];
    const now = new Date();
    
    for (let monthOffset = 0; monthOffset < this.MONTHS_TO_SYNC; monthOffset++) {
      const checkDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      const year = checkDate.getFullYear();
      const month = String(checkDate.getMonth() + 1).padStart(2, '0');
      paths.push(`${year}/${month}/${lineId}`);
    }

    return paths;
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
        }
      });

      await Promise.race([
        connection.downloadTo(writableStream, filePath),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Download timeout')), this.FILE_DOWNLOAD_TIMEOUT)
        )
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
    
    // First ensure ship exists to avoid foreign key constraint errors
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
      suite: data.cheapestsuite ? parseFloat(String(data.cheapestsuite)) : null
    };

    const validPrices = [prices.interior, prices.oceanview, prices.balcony, prices.suite]
      .filter(p => p !== null && p > 0) as number[];
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
        needs_price_update,
        is_active
      ) VALUES (
        ${cruiseId},
        ${String(data.cruiseid)},
        ${lineId},
        ${shipId},
        ${data.name},
        ${data.saildate || data.startdate},
        ${data.nights || data.sailnights || 0},
        ${prices.interior},
        ${prices.oceanview},
        ${prices.balcony},
        ${prices.suite},
        ${cheapestPrice},
        false,
        true
      )
      ON CONFLICT (id) DO UPDATE SET
        interior_price = EXCLUDED.interior_price,
        oceanview_price = EXCLUDED.oceanview_price,
        balcony_price = EXCLUDED.balcony_price,
        suite_price = EXCLUDED.suite_price,
        cheapest_price = EXCLUDED.cheapest_price,
        needs_price_update = false,
        updated_at = CURRENT_TIMESTAMP
      RETURNING (xmax = 0) as created
    `);

    const created = upsertResult[0]?.created || false;

    // Create price snapshot if prices were updated
    if (cheapestPrice !== null) {
      try {
        await db.execute(sql`
          INSERT INTO price_history (
            cruise_id,
            interior_price,
            oceanview_price,
            balcony_price,
            suite_price,
            cheapest_price,
            new_price,
            snapshot_date
          ) VALUES (
            ${cruiseId},
            ${prices.interior},
            ${prices.oceanview},
            ${prices.balcony},
            ${prices.suite},
            ${cheapestPrice},
            ${cheapestPrice},
            CURRENT_TIMESTAMP
          )
        `);
      } catch (err) {
        logger.debug(`Price snapshot for cruise ${cruiseId} handled: ${err}`);
      }
    }

    return {
      created,
      priceUpdated: cheapestPrice !== null,
      cruiseId: cruiseId
    };
  }

  /**
   * Get cruise lines needing sync
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
}

export const priceSyncBatchServiceV5 = new PriceSyncBatchServiceV5();