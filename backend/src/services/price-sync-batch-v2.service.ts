import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import { ftpConnectionPool } from './ftp-connection-pool.service';
import { slackService } from './slack.service';
import logger from '../config/logger';

interface SyncResult {
  filesFound: number;
  filesProcessed: number;
  cruisesUpdated: number;
  cruisesNotFound: number;
  errors: number;
  duration: number;
}

/**
 * Batch Price Sync Service V2
 * Downloads ALL files for cruise lines that need updates
 * This is the correct approach since cruise lines update ALL prices at once
 */
export class PriceSyncBatchServiceV2 {
  
  /**
   * Main entry point - syncs all cruise lines that have pending updates
   */
  async syncPendingPriceUpdates(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      filesFound: 0,
      filesProcessed: 0,
      cruisesUpdated: 0,
      cruisesNotFound: 0,
      errors: 0,
      duration: 0
    };

    try {
      logger.info('🚀 Starting batch price sync process V2');
      
      // Get cruise lines that have cruises needing updates
      const linesNeedingUpdates = await this.getLinesWithPendingUpdates();
      
      if (linesNeedingUpdates.length === 0) {
        logger.info('No cruise lines have pending price updates');
        return result;
      }

      logger.info(`Found ${linesNeedingUpdates.length} cruise lines needing updates`);
      
      // Send Slack notification
      await slackService.notifyCustomMessage({
        title: '🔄 Starting batch price sync V2',
        message: `Processing ${linesNeedingUpdates.length} cruise lines`,
        details: {
          cruiseLines: linesNeedingUpdates
        }
      });

      // Process each cruise line
      for (const lineId of linesNeedingUpdates) {
        const lineResult = await this.syncCruiseLinePrices(lineId);
        result.filesFound += lineResult.filesFound;
        result.filesProcessed += lineResult.filesProcessed;
        result.cruisesUpdated += lineResult.cruisesUpdated;
        result.cruisesNotFound += lineResult.cruisesNotFound;
        result.errors += lineResult.errors;
      }

    } catch (error) {
      logger.error('Fatal error in price sync:', error);
      result.errors++;
    } finally {
      result.duration = Date.now() - startTime;
      
      // Send completion notification
      await this.sendCompletionNotification(result);
      
      logger.info(`✅ Price sync completed in ${result.duration}ms`, result);
    }

    return result;
  }

  /**
   * Get cruise lines that have cruises marked for updates
   */
  private async getLinesWithPendingUpdates(): Promise<number[]> {
    const result = await db.execute(sql`
      SELECT DISTINCT cruise_line_id
      FROM cruises
      WHERE needs_price_update = true
      ORDER BY cruise_line_id
    `);
    
    return result.rows.map(row => row.cruise_line_id as number);
  }

  /**
   * Sync all cruise prices for a specific cruise line
   * Downloads ALL files from recent FTP directories
   */
  private async syncCruiseLinePrices(lineId: number): Promise<SyncResult> {
    const result: SyncResult = {
      filesFound: 0,
      filesProcessed: 0,
      cruisesUpdated: 0,
      cruisesNotFound: 0,
      errors: 0,
      duration: 0
    };
    
    const startTime = Date.now();
    logger.info(`📁 Processing cruise line ${lineId}...`);
    
    try {
      // Get current date for checking recent directories
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      // Check last 2 months (most recent updates)
      const pathsToCheck: string[] = [];
      for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
        const checkDate = new Date(currentYear, currentMonth - monthOffset - 1, 1);
        const year = checkDate.getFullYear();
        const month = String(checkDate.getMonth() + 1).padStart(2, '0');
        pathsToCheck.push(`${year}/${month}/${lineId}`);
      }
      
      // Use connection pool to list directories
      const connection = await ftpConnectionPool.getConnection();
      
      try {
        for (const basePath of pathsToCheck) {
          logger.info(`  Checking ${basePath}...`);
          
          try {
            // Get all ship directories
            const shipDirs = await connection.list(basePath);
            const directories = shipDirs.filter(item => item.type === 2);
            
            for (const dir of directories) {
              const shipPath = `${basePath}/${dir.name}`;
              const shipId = parseInt(dir.name);
              
              try {
                // Get all cruise files for this ship
                const files = await connection.list(shipPath);
                const jsonFiles = files.filter(f => f.name.endsWith('.json'));
                result.filesFound += jsonFiles.length;
                
                logger.info(`    Ship ${shipId}: ${jsonFiles.length} files`);
                
                // Process files in batches
                const BATCH_SIZE = 20;
                for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
                  const batch = jsonFiles.slice(i, i + BATCH_SIZE);
                  
                  // Download batch
                  const downloads = await Promise.all(
                    batch.map(async (file) => {
                      const filePath = `${shipPath}/${file.name}`;
                      const codetocruiseid = parseInt(file.name.replace('.json', ''));
                      
                      try {
                        // Create a writable stream that collects data into a buffer
                        const { Writable } = require('stream');
                        const chunks: Buffer[] = [];
                        const writableStream = new Writable({
                          write(chunk: Buffer, encoding: string, callback: Function) {
                            chunks.push(chunk);
                            callback();
                          }
                        });
                        
                        // Download to the writable stream
                        await connection.downloadTo(writableStream, filePath);
                        
                        // Combine all chunks and parse JSON
                        const buffer = Buffer.concat(chunks);
                        const data = JSON.parse(buffer.toString());
                        return { codetocruiseid, data, success: true };
                      } catch (err) {
                        logger.warn(`Failed to download ${filePath}: ${err}`);
                        return { codetocruiseid, data: null, success: false };
                      }
                    })
                  );
                  
                  // Process downloaded files
                  for (const download of downloads) {
                    if (!download.success || !download.data) {
                      result.errors++;
                      continue;
                    }
                    
                    const { codetocruiseid, data } = download;
                    
                    // Extract key data
                    const cruiseid = String(data.cruiseid);
                    const sailingDate = data.saildate || data.startdate;
                    const prices = {
                      interior: null as number | null,
                      oceanview: null as number | null,
                      balcony: null as number | null,
                      suite: null as number | null
                    };
                    
                    // Extract cheapest prices
                    if (data.cheapestinside) {
                      prices.interior = parseFloat(data.cheapestinside);
                    }
                    if (data.cheapestoutside) {
                      prices.oceanview = parseFloat(data.cheapestoutside);
                    }
                    if (data.cheapestbalcony) {
                      prices.balcony = parseFloat(data.cheapestbalcony);
                    }
                    if (data.cheapestsuite) {
                      prices.suite = parseFloat(data.cheapestsuite);
                    }
                    
                    // Also check cached prices
                    if (data.cachedprices) {
                      if (data.cachedprices.inside && !prices.interior) {
                        prices.interior = parseFloat(data.cachedprices.inside);
                      }
                      if (data.cachedprices.outside && !prices.oceanview) {
                        prices.oceanview = parseFloat(data.cachedprices.outside);
                      }
                      if (data.cachedprices.balcony && !prices.balcony) {
                        prices.balcony = parseFloat(data.cachedprices.balcony);
                      }
                      if (data.cachedprices.suite && !prices.suite) {
                        prices.suite = parseFloat(data.cachedprices.suite);
                      }
                    }
                    
                    // Update database
                    // First try to match by id (if we have correct codetocruiseid)
                    let updateResult = await db.execute(sql`
                      UPDATE cruises
                      SET 
                        interior_cheapest_price = ${prices.interior},
                        oceanview_cheapest_price = ${prices.oceanview},
                        balcony_cheapest_price = ${prices.balcony},
                        suite_cheapest_price = ${prices.suite},
                        needs_price_update = false,
                        updated_at = CURRENT_TIMESTAMP
                      WHERE id = ${codetocruiseid}
                      RETURNING id
                    `);
                    
                    if (updateResult.rowCount === 0) {
                      // If not found by id, try matching by cruise_id + sailing_date
                      updateResult = await db.execute(sql`
                        UPDATE cruises
                        SET 
                          interior_cheapest_price = ${prices.interior},
                          oceanview_cheapest_price = ${prices.oceanview},
                          balcony_cheapest_price = ${prices.balcony},
                          suite_cheapest_price = ${prices.suite},
                          needs_price_update = false,
                          updated_at = CURRENT_TIMESTAMP
                        WHERE cruise_id = ${cruiseid}
                          AND DATE(sailing_date) = DATE(${sailingDate})
                          AND cruise_line_id = ${lineId}
                        RETURNING id
                      `);
                    }
                    
                    if (updateResult.rowCount && updateResult.rowCount > 0) {
                      result.cruisesUpdated++;
                      
                      // Create price history entry
                      const cruiseId = updateResult.rows[0].id;
                      await db.execute(sql`
                        INSERT INTO price_history (
                          cruise_id,
                          interior_price,
                          oceanview_price,
                          balcony_price,
                          suite_price,
                          created_at
                        ) VALUES (
                          ${cruiseId},
                          ${prices.interior},
                          ${prices.oceanview},
                          ${prices.balcony},
                          ${prices.suite},
                          CURRENT_TIMESTAMP
                        )
                      `);
                      
                      if (result.cruisesUpdated % 10 === 0) {
                        process.stdout.write('✓');
                      }
                    } else {
                      result.cruisesNotFound++;
                    }
                    
                    result.filesProcessed++;
                  }
                }
                
                if (result.cruisesUpdated > 0) {
                  console.log(''); // New line after progress dots
                }
                
              } catch (err) {
                logger.error(`Error accessing ship ${shipId}:`, err);
              }
            }
            
          } catch (err) {
            logger.warn(`Cannot access ${basePath}: ${err}`);
          }
        }
        
      } finally {
        // Return connection to pool
        ftpConnectionPool.releaseConnection(connection);
      }
      
    } catch (error) {
      logger.error(`Error syncing cruise line ${lineId}:`, error);
      result.errors++;
    } finally {
      result.duration = Date.now() - startTime;
    }
    
    logger.info(`Line ${lineId} sync: ${result.cruisesUpdated} updated, ${result.cruisesNotFound} not found, ${result.errors} errors`);
    
    return result;
  }

  /**
   * Send Slack notification with results
   */
  private async sendCompletionNotification(result: SyncResult): Promise<void> {
    const emoji = result.errors === 0 && result.cruisesUpdated > 0 ? '✅' : 
                  result.cruisesUpdated === 0 ? '❌' : '⚠️';
    
    await slackService.notifyCustomMessage({
      title: `${emoji} Price sync V2 completed`,
      message: `Files: ${result.filesProcessed}/${result.filesFound} | Updated: ${result.cruisesUpdated} | Not Found: ${result.cruisesNotFound} | Errors: ${result.errors}`,
      details: {
        filesFound: result.filesFound,
        filesProcessed: result.filesProcessed,
        cruisesUpdated: result.cruisesUpdated,
        cruisesNotFound: result.cruisesNotFound,
        errors: result.errors,
        durationMs: result.duration
      }
    });
  }
}

// Export singleton instance
export const priceSyncBatchServiceV2 = new PriceSyncBatchServiceV2();