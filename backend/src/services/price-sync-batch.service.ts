import { db } from '../db/connection';
import { sql, eq, and, inArray } from 'drizzle-orm';
import { cruises, priceHistory } from '../db/schema';
import { ftpConnectionPool } from './ftp-connection-pool.service';
import { ftpFileSearchService } from './ftp-file-search.service';
import { cruiseCreationService } from './cruise-creation.service';
import { slackService } from './slack.service';
import logger from '../config/logger';

interface CruiseToSync {
  id: number;
  cruiseId: string;
  cruiseLineId: number;
  shipId: number;
  sailingDate: Date;
  needsCreation: boolean;
}

interface SyncResult {
  created: number;
  updated: number;
  failed: number;
  errors: string[];
  duration: number;
}

/**
 * Batch Price Sync Service
 * Efficiently syncs cruise pricing data from FTP in batches
 */
export class PriceSyncBatchService {
  private readonly BATCH_SIZE = 50; // Process 50 cruises per batch
  private readonly MAX_RETRIES = 3;

  /**
   * Main entry point - syncs all pending price updates
   */
  async syncPendingPriceUpdates(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
      duration: 0
    };

    try {
      logger.info('🚀 Starting batch price sync process');
      
      // Get cruises that need updates
      const pendingCruises = await this.getPendingCruises();
      
      if (pendingCruises.length === 0) {
        logger.info('No cruises pending price updates');
        return result;
      }

      logger.info(`Found ${pendingCruises.length} cruises needing price updates`);
      
      // Send Slack notification
      await slackService.notifyCustomMessage({
        title: '🔄 Starting batch price sync',
        message: `Processing ${pendingCruises.length} cruises in batches of ${this.BATCH_SIZE}`,
        details: {
          cruisesToProcess: pendingCruises.length,
          batchSize: this.BATCH_SIZE
        }
      });

      // Group cruises by line and month for efficient FTP operations
      const batches = this.groupIntoBatches(pendingCruises);
      
      // Process each batch
      for (const batch of batches) {
        const batchResult = await this.processBatch(batch);
        result.created += batchResult.created;
        result.updated += batchResult.updated;
        result.failed += batchResult.failed;
        result.errors.push(...batchResult.errors);
      }

      // Mark ONLY successfully processed cruises (not failed ones)
      const successfulCruises = pendingCruises.filter(c => !result.errors.includes(c.cruiseId));
      await this.markCruisesAsProcessed(successfulCruises);
      
      // Failed cruises will remain with needs_price_update = true and will be retried next time

    } catch (error) {
      logger.error('Fatal error in price sync:', error);
      result.errors.push(`Fatal error: ${error instanceof Error ? error.message : 'Unknown'}`);
    } finally {
      result.duration = Date.now() - startTime;
      
      // Send completion notification
      await this.sendCompletionNotification(result);
      
      logger.info(`✅ Price sync completed in ${result.duration}ms`, result);
    }

    return result;
  }

  /**
   * Get cruises that need price updates
   */
  private async getPendingCruises(): Promise<CruiseToSync[]> {
    // First, get cruises marked as needing updates
    // Include retry logic - don't retry failed cruises more than 3 times in 24 hours
    const markedCruises = await db.execute(sql`
      SELECT 
        c.id,
        c.cruise_id,
        c.cruise_line_id,
        c.ship_id,
        c.sailing_date
      FROM cruises c
      WHERE c.needs_price_update = true
        AND (c.price_update_requested_at IS NULL 
             OR c.price_update_requested_at > NOW() - INTERVAL '24 hours'
             OR c.updated_at > NOW() - INTERVAL '1 hour')
      ORDER BY c.sailing_date ASC
      LIMIT 500
    `);

    // Also check for cruises mentioned in recent webhooks that don't exist
    const recentWebhooks = await db.execute(sql`
      SELECT DISTINCT line_id, payload
      FROM webhook_events
      WHERE processed = false
        AND created_at > NOW() - INTERVAL '1 hour'
    `);

    const cruisesToSync: CruiseToSync[] = [];
    
    // Add existing cruises that need updates
    for (const cruise of markedCruises) {
      cruisesToSync.push({
        id: cruise.id,
        cruiseId: cruise.cruise_id,
        cruiseLineId: cruise.cruise_line_id,
        shipId: cruise.ship_id,
        sailingDate: new Date(cruise.sailing_date),
        needsCreation: false
      });
    }

    // Parse webhook payloads to find cruise IDs that might need creation
    for (const webhook of recentWebhooks) {
      try {
        const payload = typeof webhook.payload === 'string' 
          ? JSON.parse(webhook.payload) 
          : webhook.payload;
        
        if (payload.cruiseIds) {
          // Check which cruise IDs don't exist
          const missingCruises = await this.findMissingCruises(payload.cruiseIds, payload.lineid);
          
          for (const cruiseId of missingCruises) {
            cruisesToSync.push({
              id: 0, // Will be assigned after creation
              cruiseId,
              cruiseLineId: payload.lineid,
              shipId: 0, // Will be determined from FTP data
              sailingDate: new Date(), // Will be determined from FTP data
              needsCreation: true
            });
          }
        }
      } catch (error) {
        logger.warn('Failed to parse webhook payload:', error);
      }
    }

    return cruisesToSync;
  }

  /**
   * Find cruise IDs that don't exist in our database
   */
  private async findMissingCruises(cruiseIds: string[], lineId: number): Promise<string[]> {
    const existingResult = await db.execute(sql`
      SELECT cruise_id FROM cruises 
      WHERE cruise_id = ANY(${cruiseIds})
        AND cruise_line_id = ${lineId}
    `);
    
    const existingIds = new Set(existingResult.map(r => r.cruise_id));
    return cruiseIds.filter(id => !existingIds.has(id));
  }

  /**
   * Group cruises into efficient batches
   */
  private groupIntoBatches(cruisesToSync: CruiseToSync[]): CruiseToSync[][] {
    const batches: CruiseToSync[][] = [];
    
    // Group by cruise line and sailing month for FTP efficiency
    const grouped = new Map<string, CruiseToSync[]>();
    
    for (const cruise of cruisesToSync) {
      const month = cruise.sailingDate.getMonth() + 1;
      const year = cruise.sailingDate.getFullYear();
      const key = `${cruise.cruiseLineId}-${year}-${month}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(cruise);
    }

    // Create batches from groups
    for (const group of grouped.values()) {
      for (let i = 0; i < group.length; i += this.BATCH_SIZE) {
        batches.push(group.slice(i, i + this.BATCH_SIZE));
      }
    }

    return batches;
  }

  /**
   * Process a batch of cruises
   */
  private async processBatch(batch: CruiseToSync[]): Promise<SyncResult> {
    const result: SyncResult = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
      duration: 0
    };

    const startTime = Date.now();
    
    try {
      logger.info(`Processing batch of ${batch.length} cruises`);
      
      // First, find the actual FTP paths for all cruises
      const cruiseInfos = batch.map(c => ({
        cruiseId: c.cruiseId,
        lineId: c.cruiseLineId,
        shipId: c.shipId > 0 ? c.shipId : undefined
      }));
      
      logger.info('Searching for cruise files in FTP...');
      const foundPaths = await ftpFileSearchService.findCruiseFiles(cruiseInfos);
      
      if (foundPaths.size === 0) {
        logger.error('Could not find any cruise files in FTP');
        result.failed = batch.length;
        result.errors = batch.map(c => c.cruiseId);
        return result;
      }
      
      logger.info(`Found ${foundPaths.size}/${batch.length} cruise files`);
      
      // Build list of paths to download
      const pathsToDownload: string[] = [];
      const cruiseByPath = new Map<string, CruiseToSync>();
      
      for (const cruise of batch) {
        const path = foundPaths.get(cruise.cruiseId);
        if (path) {
          pathsToDownload.push(path);
          cruiseByPath.set(path, cruise);
        } else {
          logger.warn(`Could not find file for cruise ${cruise.cruiseId}`);
          result.failed++;
          result.errors.push(cruise.cruiseId);
        }
      }
      
      // Download all found files in batch
      const fileData = await ftpConnectionPool.downloadBatch(pathsToDownload);
      
      // Process each downloaded file
      for (const [path, data] of fileData.entries()) {
        const cruise = cruiseByPath.get(path);
        if (!cruise) continue;
        
        if (!data) {
          logger.warn(`No data downloaded for cruise ${cruise.cruiseId}`);
          result.failed++;
          result.errors.push(cruise.cruiseId);
          continue;
        }

        try {
          const jsonData = JSON.parse(data.toString());
          
          if (cruise.needsCreation) {
            // Create new cruise
            await this.createCruise(jsonData);
            result.created++;
          } else {
            // Update existing cruise
            await this.updateCruisePricing(cruise.id, jsonData);
            result.updated++;
          }
        } catch (error) {
          logger.error(`Failed to process cruise ${cruise.cruiseId}:`, error);
          result.failed++;
          result.errors.push(cruise.cruiseId);
        }
      }
      
    } catch (error) {
      logger.error('Batch processing error:', error);
      result.failed = batch.length;
      result.errors = batch.map(c => c.cruiseId);
    } finally {
      result.duration = Date.now() - startTime;
    }

    logger.info(`Batch completed: created=${result.created}, updated=${result.updated}, failed=${result.failed}, duration=${result.duration}ms`);
    
    return result;
  }

  /**
   * Generate FTP path for a cruise
   * Note: The FTP structure is /isell_json/{year}/{month}/{cruiseLineId}/{shipId}/{cruiseId}.json
   * We need to search for the file as we might not know the exact year/month from sailing date
   */
  private getFTPPath(cruise: CruiseToSync): string {
    // For now, we'll use the sailing date as a best guess for the year/month
    // In production, the files are organized by when they were created, not sailing date
    const year = cruise.sailingDate.getFullYear();
    const month = String(cruise.sailingDate.getMonth() + 1).padStart(2, '0');
    
    // The structure is: isell_json/YYYY/MM/lineId/shipId/cruiseId.json (no leading slash)
    if (cruise.shipId && cruise.shipId > 0) {
      return `isell_json/${year}/${month}/${cruise.cruiseLineId}/${cruise.shipId}/${cruise.cruiseId}.json`;
    } else {
      // If we don't know the ship ID, we need to search for it
      // This is a fallback that likely won't work
      return `isell_json/${year}/${month}/${cruise.cruiseLineId}/${cruise.cruiseId}.json`;
    }
  }

  /**
   * Create a new cruise from FTP data
   */
  private async createCruise(data: any): Promise<void> {
    await cruiseCreationService.createFromJSON(data);
  }

  /**
   * Update pricing for an existing cruise
   */
  private async updateCruisePricing(cruiseId: number, data: any): Promise<void> {
    // Extract pricing from JSON (similar to sync-complete-data.js)
    const pricing = {
      interior_cheapest_price: data.interior_cheapest_price || null,
      oceanview_cheapest_price: data.oceanview_cheapest_price || null,
      balcony_cheapest_price: data.balcony_cheapest_price || null,
      suite_cheapest_price: data.suite_cheapest_price || null
    };

    // Update cruise with new pricing
    await db
      .update(cruises)
      .set({
        ...pricing,
        updatedAt: new Date()
      })
      .where(eq(cruises.id, cruiseId));

    // Create price history entry
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
        ${pricing.interior_cheapest_price},
        ${pricing.oceanview_cheapest_price},
        ${pricing.balcony_cheapest_price},
        ${pricing.suite_cheapest_price},
        CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * Mark cruises as processed
   */
  private async markCruisesAsProcessed(processed: CruiseToSync[]): Promise<void> {
    if (processed.length === 0) return;
    
    const ids = processed.map(c => c.id).filter(id => id > 0);
    
    if (ids.length > 0) {
      await db
        .update(cruises)
        .set({
          needsPriceUpdate: false,
          priceUpdateRequestedAt: null,
          updatedAt: new Date()
        })
        .where(inArray(cruises.id, ids));
    }
  }

  /**
   * Send Slack notification with results
   */
  private async sendCompletionNotification(result: SyncResult): Promise<void> {
    const emoji = result.failed === 0 ? '✅' : result.failed > result.updated ? '❌' : '⚠️';
    
    await slackService.notifyCustomMessage({
      title: `${emoji} Price sync completed`,
      message: `Created: ${result.created} | Updated: ${result.updated} | Failed: ${result.failed} | Duration: ${(result.duration / 1000).toFixed(1)}s`,
      details: {
        created: result.created,
        updated: result.updated,
        failed: result.failed,
        durationMs: result.duration,
        errors: result.errors.slice(0, 10)
      }
    });
  }
}

// Export singleton instance
export const priceSyncBatchService = new PriceSyncBatchService();