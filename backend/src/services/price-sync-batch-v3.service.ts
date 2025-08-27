import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import { ftpConnectionPool } from './ftp-connection-pool.service';
import { slackService } from './slack.service';
import logger from '../config/logger';
import { v4 as uuidv4 } from 'uuid';

interface SyncResult {
  filesFound: number;
  filesProcessed: number;
  cruisesUpdated: number;
  cruisesNotFound: number;
  errors: number;
  duration: number;
  skippedLines?: number;
}

/**
 * Batch Price Sync Service V3
 * Features:
 * - Concurrent sync prevention using locks
 * - Per-line processing for better scalability
 * - Progress tracking and resumability
 * - Improved error handling
 */
export class PriceSyncBatchServiceV3 {
  private readonly workerId = `worker-${uuidv4().substring(0, 8)}`;
  private readonly MAX_LINES_PER_RUN = 3; // Process max 3 lines per cron run
  private readonly MAX_CRUISES_PER_LINE = 5000; // Safety limit per line
  
  /**
   * Main entry point - syncs cruise lines with proper concurrency control
   */
  async syncPendingPriceUpdates(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      filesFound: 0,
      filesProcessed: 0,
      cruisesUpdated: 0,
      cruisesNotFound: 0,
      errors: 0,
      duration: 0,
      skippedLines: 0
    };

    try {
      logger.info(`🚀 Starting batch price sync V3 (${this.workerId})`);
      
      // Check if sync_locks table exists
      const tableCheck = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'sync_locks'
        )
      `);
      
      const tableExists = tableCheck[0]?.exists;
      
      if (!tableExists) {
        logger.warn('⚠️ sync_locks table does not exist, creating it now...');
        
        // Create the table
        await this.createSyncLocksTable();
        logger.info('✅ sync_locks table created');
      }
      
      // Check if FTP credentials are configured
      if (!process.env.TRAVELTEK_FTP_HOST || !process.env.TRAVELTEK_FTP_USER || !process.env.TRAVELTEK_FTP_PASSWORD) {
        logger.error('❌ FTP credentials not configured - cannot process price updates');
        await slackService.notifyCustomMessage({
          title: '❌ FTP Configuration Error',
          message: 'FTP credentials are not configured on this server',
          details: {
            host: process.env.TRAVELTEK_FTP_HOST ? 'SET' : 'MISSING',
            user: process.env.TRAVELTEK_FTP_USER ? 'SET' : 'MISSING',
            password: process.env.TRAVELTEK_FTP_PASSWORD ? 'SET' : 'MISSING'
          }
        });
        result.errors = 1;
        return result;
      }
      
      // Get cruise lines that need updates and aren't currently being processed
      const linesNeedingUpdates = await this.getUnlockedLinesWithPendingUpdates();
      
      if (linesNeedingUpdates.length === 0) {
        logger.info('No cruise lines available for processing (all locked or no updates needed)');
        return result;
      }
      
      logger.info(`Found ${linesNeedingUpdates.length} cruise lines needing updates: ${linesNeedingUpdates.join(', ')}`);
      

      // Limit processing to avoid timeouts
      const linesToProcess = linesNeedingUpdates.slice(0, this.MAX_LINES_PER_RUN);
      result.skippedLines = Math.max(0, linesNeedingUpdates.length - this.MAX_LINES_PER_RUN);
      
      logger.info(`Processing ${linesToProcess.length} of ${linesNeedingUpdates.length} lines (${result.skippedLines} deferred)`);
      
      // Send Slack notification
      await slackService.notifyCustomMessage({
        title: '🔄 Starting batch price sync V3',
        message: `Processing ${linesToProcess.length} cruise lines (${result.skippedLines} deferred)`,
        details: {
          cruiseLines: linesToProcess,
          workerId: this.workerId,
          maxPerRun: this.MAX_LINES_PER_RUN
        }
      });

      // Process each cruise line with lock protection
      for (const lineId of linesToProcess) {
        const lockId = await this.acquireLock(lineId);
        
        if (!lockId) {
          logger.warn(`Could not acquire lock for line ${lineId}, skipping`);
          result.skippedLines++;
          continue;
        }
        
        try {
          const lineResult = await this.syncCruiseLinePrices(lineId, lockId);
          result.filesFound += lineResult.filesFound;
          result.filesProcessed += lineResult.filesProcessed;
          result.cruisesUpdated += lineResult.cruisesUpdated;
          result.cruisesNotFound += lineResult.cruisesNotFound;
          result.errors += lineResult.errors;
          
          // Update lock progress
          await this.updateLockProgress(lockId, lineResult);
          
          // Release lock after successful processing
          await this.releaseLock(lockId, 'completed');
          
        } catch (error) {
          logger.error(`Error processing line ${lineId}:`, {
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
            lineId,
            lockId
          });
          await this.releaseLock(lockId, 'failed', error instanceof Error ? error.message : 'Unknown error');
          result.errors++;
        }
      }

    } catch (error) {
      logger.error('Fatal error in price sync:', error);
      result.errors++;
    } finally {
      result.duration = Date.now() - startTime;
      
      // Send completion notification
      await this.sendCompletionNotification(result);
      
      logger.info(`✅ Price sync V3 completed in ${result.duration}ms`, result);
    }

    return result;
  }

  /**
   * Get cruise lines that have pending updates and aren't locked
   */
  private async getLinesWithPendingUpdates(): Promise<number[]> {
    const result = await db.execute(sql`
      SELECT DISTINCT c.cruise_line_id, COUNT(*) as pending_count
      FROM cruises c
      LEFT JOIN sync_locks sl ON sl.cruise_line_id = c.cruise_line_id 
        AND sl.lock_type = 'price_sync' 
        AND sl.status = 'processing'
      WHERE c.needs_price_update = true
        AND sl.id IS NULL  -- Not currently locked
      GROUP BY c.cruise_line_id
      ORDER BY pending_count DESC  -- Process lines with most updates first
      LIMIT 50
    `);
    
    return result.map(row => row.cruise_line_id as number);
  }

  /**
   * Get cruise lines that aren't currently being processed
   */
  private async getUnlockedLinesWithPendingUpdates(): Promise<number[]> {
    const result = await db.execute(sql`
      SELECT DISTINCT c.cruise_line_id
      FROM cruises c
      WHERE c.needs_price_update = true
        AND NOT EXISTS (
          SELECT 1 FROM sync_locks sl
          WHERE sl.cruise_line_id = c.cruise_line_id
            AND sl.lock_type = 'price_sync'
            AND sl.status = 'processing'
        )
      ORDER BY c.cruise_line_id
    `);
    
    return result.map(row => row.cruise_line_id as number);
  }

  /**
   * Acquire a lock for processing a cruise line
   */
  private async acquireLock(lineId: number): Promise<number | null> {
    try {
      // Count cruises to update
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM cruises
        WHERE cruise_line_id = ${lineId}
          AND needs_price_update = true
      `);
      
      const totalCruises = countResult[0]?.total || 0;
      
      // First check if there's already a processing lock for this line
      const existingLock = await db.execute(sql`
        SELECT id FROM sync_locks
        WHERE cruise_line_id = ${lineId}
          AND lock_type = 'price_sync'
          AND status = 'processing'
      `);
      
      if (existingLock.length > 0) {
        logger.debug(`Lock already exists for line ${lineId}, skipping`);
        return null;
      }
      
      // Try to acquire lock (no ON CONFLICT since we check above)
      const lockResult = await db.execute(sql`
        INSERT INTO sync_locks (
          cruise_line_id, lock_type, locked_by, 
          total_cruises, status
        ) VALUES (
          ${lineId}, 'price_sync', ${this.workerId},
          ${totalCruises}, 'processing'
        )
        RETURNING id
      `);
      
      if (lockResult.length > 0) {
        logger.info(`🔒 Acquired lock ${lockResult[0].id} for line ${lineId} (${totalCruises} cruises)`);
        return lockResult[0].id as number;
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to acquire lock for line ${lineId}:`, error);
      return null;
    }
  }

  /**
   * Update lock progress
   */
  private async updateLockProgress(lockId: number, result: SyncResult): Promise<void> {
    try {
      await db.execute(sql`
        UPDATE sync_locks
        SET processed_cruises = processed_cruises + ${result.filesProcessed},
            successful_updates = successful_updates + ${result.cruisesUpdated},
            failed_updates = failed_updates + ${result.errors},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${lockId}
      `);
    } catch (error) {
      logger.error(`Failed to update lock progress:`, error);
    }
  }

  /**
   * Release a lock
   */
  private async releaseLock(lockId: number, status: string, errorMessage?: string): Promise<void> {
    try {
      // First, check if the lock exists and its current status
      const currentLock = await db.execute(sql`
        SELECT status FROM sync_locks WHERE id = ${lockId}
      `);
      
      if (!currentLock || currentLock.length === 0) {
        logger.warn(`Lock ${lockId} not found - may have been cleaned up`);
        return;
      }
      
      // If already completed, don't update again
      if (currentLock[0].status === 'completed') {
        logger.debug(`Lock ${lockId} already completed, skipping update`);
        return;
      }
      
      await db.execute(sql`
        UPDATE sync_locks
        SET status = ${status},
            completed_at = CURRENT_TIMESTAMP,
            error_message = ${errorMessage || null},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${lockId}
      `);
      
      logger.info(`🔓 Released lock ${lockId} with status: ${status}`);
    } catch (error) {
      // If it's a constraint violation, try deleting the old completed lock
      if (error instanceof Error && error.message.includes('unique_active_lock')) {
        logger.warn(`Constraint violation releasing lock ${lockId}, attempting cleanup...`);
        try {
          // Delete any existing completed locks for this line
          await db.execute(sql`
            DELETE FROM sync_locks
            WHERE id != ${lockId}
              AND cruise_line_id = (SELECT cruise_line_id FROM sync_locks WHERE id = ${lockId})
              AND lock_type = 'price_sync'
              AND status = 'completed'
          `);
          
          // Now try updating again
          await db.execute(sql`
            UPDATE sync_locks
            SET status = ${status},
                completed_at = CURRENT_TIMESTAMP,
                error_message = ${errorMessage || null},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${lockId}
          `);
          
          logger.info(`🔓 Released lock ${lockId} after cleanup`);
        } catch (cleanupError) {
          logger.error(`Failed to release lock after cleanup:`, cleanupError);
        }
      } else {
        logger.error(`Failed to release lock:`, error);
      }
    }
  }

  /**
   * Sync prices for a specific cruise line with improved error handling
   */
  private async syncCruiseLinePrices(lineId: number, lockId: number): Promise<SyncResult> {
    const result: SyncResult = {
      filesFound: 0,
      filesProcessed: 0,
      cruisesUpdated: 0,
      cruisesNotFound: 0,
      errors: 0,
      duration: 0
    };
    
    const startTime = Date.now();
    logger.info(`📁 Processing cruise line ${lineId} with lock ${lockId}...`);
    
    let connection;
    
    try {
      // Get current date for checking recent directories
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      // Check last 2 months
      const pathsToCheck: string[] = [];
      for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
        const checkDate = new Date(currentYear, currentMonth - monthOffset - 1, 1);
        const year = checkDate.getFullYear();
        const month = String(checkDate.getMonth() + 1).padStart(2, '0');
        pathsToCheck.push(`${year}/${month}/${lineId}`);
      }
      
      // Get FTP connection
      try {
        connection = await ftpConnectionPool.getConnection();
        logger.info(`🔗 Got FTP connection for line ${lineId}`);
      } catch (connErr) {
        logger.error(`❌ Failed to get FTP connection for line ${lineId}:`, connErr);
        result.errors++;
        throw connErr;
      }
      
      // Process each path
      for (const basePath of pathsToCheck) {
        if (result.cruisesUpdated >= this.MAX_CRUISES_PER_LINE) {
          logger.warn(`Reached max cruises limit (${this.MAX_CRUISES_PER_LINE}) for line ${lineId}`);
          break;
        }
        
        logger.info(`  Checking ${basePath}...`);
        
        try {
          // Get all ship directories
          const shipDirs = await connection.list(basePath);
          const directories = shipDirs.filter(item => item.type === 2);
          
          for (const dir of directories) {
            const shipPath = `${basePath}/${dir.name}`;
            const shipId = parseInt(dir.name);
            
            try {
              // Get cruise files
              const files = await connection.list(shipPath);
              const jsonFiles = files.filter(f => f.name.endsWith('.json'));
              result.filesFound += jsonFiles.length;
              
              logger.info(`    Ship ${shipId}: ${jsonFiles.length} files found`);
              
              // Process files in smaller batches to avoid memory issues
              const BATCH_SIZE = 10;
              for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
                const batch = jsonFiles.slice(i, i + BATCH_SIZE);
                
                // Process batch
                const processResult = await this.processCruiseBatch(
                  connection, 
                  batch, 
                  shipPath, 
                  shipId, 
                  lineId
                );
                
                result.filesProcessed += processResult.processed;
                result.cruisesUpdated += processResult.updated;
                result.cruisesNotFound += processResult.notFound;
                result.errors += processResult.errors;
                
                // Check if we should stop
                if (result.cruisesUpdated >= this.MAX_CRUISES_PER_LINE) {
                  break;
                }
              }
              
            } catch (err) {
              logger.error(`Error processing ship ${shipId}:`, err);
              result.errors++;
            }
          }
          
        } catch (err) {
          logger.warn(`Cannot access ${basePath}: ${err}`);
        }
      }
      
    } catch (error) {
      logger.error(`Error syncing line ${lineId}:`, error);
      result.errors++;
    } finally {
      // Return connection to pool
      if (connection) {
        ftpConnectionPool.releaseConnection(connection);
      }
      
      result.duration = Date.now() - startTime;
      logger.info(`Line ${lineId} sync completed: ${result.cruisesUpdated} updated in ${result.duration}ms`);
    }
    
    return result;
  }

  /**
   * Process a batch of cruise files
   */
  private async processCruiseBatch(
    connection: any,
    files: any[],
    shipPath: string,
    shipId: number,
    lineId: number
  ): Promise<{ processed: number; updated: number; notFound: number; errors: number }> {
    const result = { processed: 0, updated: 0, notFound: 0, errors: 0 };
    
    logger.info(`📦 Processing batch of ${files.length} files for ship ${shipId}, line ${lineId}`);
    
    // Process files sequentially to avoid connection issues
    const downloads = [];
    const { Writable } = require('stream');
    
    for (const file of files) {
      const filePath = `${shipPath}/${file.name}`;
      const codetocruiseid = file.name.replace('.json', ''); // Keep as string to match VARCHAR in DB
      
      try {
        logger.debug(`⬇️ Downloading: ${filePath} (${file.size} bytes)`);
        
        // Create a buffer to collect data
        const chunks: Buffer[] = [];
        
        // Create writable stream with proper error handling
        const writableStream = new Writable({
          write(chunk: Buffer, encoding: string, callback: Function) {
            chunks.push(chunk);
            callback();
          }
        });
        
        // Download file with timeout
        await Promise.race([
          connection.downloadTo(writableStream, filePath),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Download timeout after 30s')), 30000)
          )
        ]);
        
        // Parse JSON
        const buffer = Buffer.concat(chunks);
        const content = buffer.toString();
        
        if (!content || content.length === 0) {
          throw new Error('Downloaded file is empty');
        }
        
        const data = JSON.parse(content);
        
        logger.debug(`✅ Downloaded and parsed ${file.name} successfully (${buffer.length} bytes)`);
        downloads.push({ codetocruiseid, data, success: true });
        
      } catch (err) {
        logger.error(`❌ Failed to download/parse ${filePath}:`, {
          error: err instanceof Error ? err.message : err,
          stack: err instanceof Error ? err.stack : undefined,
          fileName: file.name,
          codetocruiseid,
          fileSize: file.size,
          shipPath,
          lineId
        });
        downloads.push({ codetocruiseid, data: null, success: false });
        result.errors++;
      }
    }
    
    // Process downloaded files
    for (const download of downloads) {
      if (!download.success || !download.data) {
        // Error already counted during download
        continue;
      }
      
      try {
        const updated = await this.updateCruisePrices(
          download.codetocruiseid,
          download.data,
          lineId,
          shipId
        );
        
        if (updated) {
          result.updated++;
        } else {
          result.notFound++;
        }
        
        result.processed++;
        
      } catch (error) {
        logger.error(`❌ Error updating cruise ${download.codetocruiseid}:`, {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
          codetocruiseid: download.codetocruiseid,
          lineId,
          shipId,
          dataKeys: download.data ? Object.keys(download.data).slice(0, 10) : null
        });
        result.errors++;
      }
    }
    
    return result;
  }

  /**
   * Update cruise prices in database
   */
  private async updateCruisePrices(
    codetocruiseid: string,
    data: any,
    lineId: number,
    shipId: number
  ): Promise<boolean> {
    // Extract data
    const cruiseid = String(data.cruiseid);
    const sailingDate = data.saildate || data.startdate;
    
    const prices = {
      interior: data.cheapestinside ? parseFloat(data.cheapestinside) : null,
      oceanview: data.cheapestoutside ? parseFloat(data.cheapestoutside) : null,
      balcony: data.cheapestbalcony ? parseFloat(data.cheapestbalcony) : null,
      suite: data.cheapestsuite ? parseFloat(data.cheapestsuite) : null
    };
    
    // Check cached prices as fallback
    if (data.cachedprices) {
      prices.interior = prices.interior || (data.cachedprices.inside ? parseFloat(data.cachedprices.inside) : null);
      prices.oceanview = prices.oceanview || (data.cachedprices.outside ? parseFloat(data.cachedprices.outside) : null);
      prices.balcony = prices.balcony || (data.cachedprices.balcony ? parseFloat(data.cachedprices.balcony) : null);
      prices.suite = prices.suite || (data.cachedprices.suite ? parseFloat(data.cachedprices.suite) : null);
    }
    
    // Log what we're trying to update
    logger.debug(`Attempting to update cruise ID ${codetocruiseid} with prices:`, {
      interior: prices.interior,
      oceanview: prices.oceanview,
      balcony: prices.balcony,
      suite: prices.suite,
      cruiseid: cruiseid,
      sailingDate: sailingDate
    });
    
    // Update database - use correct column names that exist in the database
    let updateResult = await db.execute(sql`
      UPDATE cruises
      SET 
        interior_price = ${prices.interior},
        oceanview_price = ${prices.oceanview},
        balcony_price = ${prices.balcony},
        suite_price = ${prices.suite},
        cheapest_price = LEAST(
          COALESCE(${prices.interior}, 999999)::numeric, 
          COALESCE(${prices.oceanview}, 999999)::numeric, 
          COALESCE(${prices.balcony}, 999999)::numeric, 
          COALESCE(${prices.suite}, 999999)::numeric
        ),
        needs_price_update = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${codetocruiseid}
      RETURNING id, cruise_id, name
    `);
    
    // Try alternate matching if not found
    if (updateResult.length === 0) {
      logger.debug(`No cruise found with ID ${codetocruiseid}, trying cruise_id + date match...`);
      
      updateResult = await db.execute(sql`
        UPDATE cruises
        SET 
          interior_price = ${prices.interior},
          oceanview_price = ${prices.oceanview},
          balcony_price = ${prices.balcony},
          suite_price = ${prices.suite},
          cheapest_price = LEAST(
            COALESCE(${prices.interior}, 999999)::numeric, 
            COALESCE(${prices.oceanview}, 999999)::numeric, 
            COALESCE(${prices.balcony}, 999999)::numeric, 
            COALESCE(${prices.suite}, 999999)::numeric
          ),
          needs_price_update = false,
          updated_at = CURRENT_TIMESTAMP
        WHERE cruise_id = ${cruiseid}
          AND DATE(sailing_date) = DATE(${sailingDate})
          AND cruise_line_id = ${lineId}
        RETURNING id, cruise_id, name
      `);
      
      if (updateResult.length === 0) {
        logger.warn(`❌ No cruise found for ID ${codetocruiseid} or cruise_id ${cruiseid} with date ${sailingDate} and line ${lineId}`);
      }
    }
    
    // Create price history if updated
    if (updateResult.length > 0) {
      const cruiseId = updateResult[0].id;
      
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
      
      return true;
    }
    
    return false;
  }

  /**
   * Send completion notification
   */
  private async sendCompletionNotification(result: SyncResult): Promise<void> {
    const emoji = result.errors === 0 && result.cruisesUpdated > 0 ? '✅' : 
                  result.cruisesUpdated === 0 ? '❌' : '⚠️';
    
    await slackService.notifyCustomMessage({
      title: `${emoji} Price sync V3 completed`,
      message: `Updated: ${result.cruisesUpdated} | Errors: ${result.errors} | Skipped lines: ${result.skippedLines || 0}`,
      details: {
        ...result,
        workerId: this.workerId,
        perLineLimit: this.MAX_LINES_PER_RUN
      }
    });
  }

  /**
   * Create sync_locks table if it doesn't exist
   */
  private async createSyncLocksTable(): Promise<void> {
    try {
      // Create table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS sync_locks (
          id SERIAL PRIMARY KEY,
          cruise_line_id INTEGER NOT NULL,
          lock_type VARCHAR(50) NOT NULL,
          locked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          locked_by VARCHAR(255),
          status VARCHAR(50) DEFAULT 'processing',
          total_cruises INTEGER,
          processed_cruises INTEGER DEFAULT 0,
          successful_updates INTEGER DEFAULT 0,
          failed_updates INTEGER DEFAULT 0,
          error_message TEXT,
          completed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Add constraint (ignore errors if already exists)
      try {
        await db.execute(sql`
          ALTER TABLE sync_locks 
          ADD CONSTRAINT unique_active_lock 
          UNIQUE (cruise_line_id, lock_type, status)
        `);
      } catch (e) {
        // Constraint might already exist
      }
      
      // Create index (ignore errors if already exists)
      try {
        await db.execute(sql`
          CREATE INDEX idx_sync_locks_active 
          ON sync_locks(cruise_line_id, status) 
          WHERE status = 'processing'
        `);
      } catch (e) {
        // Index might already exist
      }
      
      // Add columns to cruises table if needed
      try {
        await db.execute(sql`
          ALTER TABLE cruises 
          ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP
        `);
      } catch (e) {
        // Column might already exist
      }
      
      try {
        await db.execute(sql`
          ALTER TABLE cruises 
          ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP
        `);
      } catch (e) {
        // Column might already exist
      }
      
    } catch (error) {
      logger.error('Failed to create sync_locks table:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const priceSyncBatchServiceV3 = new PriceSyncBatchServiceV3();