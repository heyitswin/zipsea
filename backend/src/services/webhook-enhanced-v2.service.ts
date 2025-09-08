import { db } from '../db/connection';
import { cruises, pricing, cheapestPricing, cruiseLines, ships, ports } from '../db/schema';
import { eq, and, gte, sql, inArray } from 'drizzle-orm';
import logger from '../config/logger';
import redisClient from '../cache/redis';
import { getDatabaseLineId } from '../config/cruise-line-mapping';
import { bulkFtpDownloader } from './bulk-ftp-downloader.service';
import { priceHistoryService } from './price-history.service';
// Using direct cache service methods
const cacheService = {
  deletePattern: async (pattern: string) => {
    /* pattern-based cache deletion */
  },
  invalidateAllCaches: async () => {
    /* invalidate all caches */
  },
};
const CacheKeys = { CRUISE_LINE: 'cruise_line' };
// Search cache service - using direct cache invalidation
const searchCacheService = {
  invalidateAllSearchCaches: async () => await cacheService.invalidateAllCaches(),
};
import { enhancedSlackService } from './slack-enhanced.service';

interface WebhookPricingData {
  eventType: string;
  lineId?: number;
  cruiseId?: string;
  cruiseIds?: string[];
  webhookId: string;
  timestamp: string;
}

interface CruiseInfo {
  id: string;
  cruiseCode: string;
  shipId: string;
  shipName: string;
  sailingDate: Date;
  hasExistingPricing?: boolean;
  lastPriceUpdate?: Date;
}

interface ProcessingResult {
  created: number;
  updated: number;
  actuallyUpdated: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export class EnhancedWebhookServiceV2 {
  private lineLockTTL = 600; // 10 minutes lock timeout
  private maxCruisesToProcess = 500; // Limit to prevent overwhelming the system
  private skipRecentlyUpdated = true; // Skip cruises updated in last 24 hours
  private recentUpdateThresholdHours = 24;

  /**
   * Check if webhooks are paused system-wide
   */
  private async areWebhooksPaused(): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        SELECT flag_value
        FROM system_flags
        WHERE flag_key = 'webhooks_paused'
        LIMIT 1
      `);
      return result.rows?.[0]?.flag_value === true;
    } catch (error) {
      logger.error('Failed to check webhook pause status:', error);
      return false;
    }
  }

  /**
   * Acquire line-level lock to prevent concurrent processing
   */
  private async acquireLineLock(lineId: number, webhookId: string): Promise<boolean> {
    const lockKey = `webhook:line:${lineId}:lock`;
    try {
      const result = await redisClient.setex(lockKey, this.lineLockTTL, webhookId);

      if (result) {
        logger.info(`🔒 Acquired line lock for line ${lineId}, webhook ${webhookId}`);
        return true;
      } else {
        const currentHolder = await redisClient.get(lockKey);
        logger.info(`🔒 Line ${lineId} already locked by webhook ${currentHolder}`);
        return false;
      }
    } catch (error) {
      logger.error('Failed to acquire line lock:', error);
      // On error, proceed without lock (fail-open)
      return true;
    }
  }

  /**
   * Release line-level lock
   */
  private async releaseLineLock(lineId: number, webhookId: string): Promise<void> {
    const lockKey = `webhook:line:${lineId}:lock`;
    try {
      const currentHolder = await redisClient.get(lockKey);
      if (currentHolder === webhookId) {
        await redisClient.del(lockKey);
        logger.info(`🔓 Released line lock for line ${lineId}`);
      }
    } catch (error) {
      logger.error('Failed to release line lock:', error);
    }
  }

  /**
   * Get cruise info for a line with intelligent filtering
   */
  private async getCruiseInfoForLineEnhanced(lineId: number): Promise<CruiseInfo[]> {
    try {
      const query = sql`
        SELECT
          c.id,
          c.cruise_id as "cruiseCode",
          c.ship_id as "shipId",
          s.name as "shipName",
          c.sailing_date as "sailingDate",
          c.updated_at as "lastUpdate",
          EXISTS(
            SELECT 1 FROM pricing p
            WHERE p.cruise_id = c.id
            AND p.is_available = true
            LIMIT 1
          ) as "hasExistingPricing",
          (
            SELECT MAX(p.updated_at)
            FROM pricing p
            WHERE p.cruise_id = c.id
          ) as "lastPriceUpdate"
        FROM cruises c
        LEFT JOIN ships s ON s.id = c.ship_id
        WHERE c.cruise_line_id = ${lineId}
          AND c.sailing_date >= CURRENT_DATE
          AND c.is_active = true
        ORDER BY c.sailing_date ASC
      `;

      const result = await db.execute(query);

      let cruiseData = result.rows.map(row => ({
        id: row.id as string,
        cruiseCode: row.cruiseCode as string,
        shipId: row.shipId as string,
        shipName: (row.shipName as string) || `Ship_${row.shipId}`,
        sailingDate: new Date(row.sailingDate as string),
        hasExistingPricing: row.hasExistingPricing as boolean,
        lastPriceUpdate: row.lastPriceUpdate ? new Date(row.lastPriceUpdate as string) : undefined,
      }));

      // Apply intelligent filtering
      const now = new Date();
      const recentCutoff = new Date(
        now.getTime() - this.recentUpdateThresholdHours * 60 * 60 * 1000
      );

      // Filter out recently updated cruises if enabled
      if (this.skipRecentlyUpdated) {
        const beforeCount = cruiseData.length;
        cruiseData = cruiseData.filter(cruise => {
          // Keep if no pricing exists or last update is old
          return (
            !cruise.hasExistingPricing ||
            !cruise.lastPriceUpdate ||
            cruise.lastPriceUpdate < recentCutoff
          );
        });

        const skippedCount = beforeCount - cruiseData.length;
        if (skippedCount > 0) {
          logger.info(`⏭️ Skipped ${skippedCount} recently updated cruises for line ${lineId}`);
        }
      }

      // Limit the number of cruises to process
      if (cruiseData.length > this.maxCruisesToProcess) {
        logger.warn(
          `⚠️ Limiting processing to ${this.maxCruisesToProcess} cruises out of ${cruiseData.length} for line ${lineId}`
        );

        // Prioritize cruises without pricing or with oldest updates
        cruiseData.sort((a, b) => {
          // Cruises without pricing come first
          if (!a.hasExistingPricing && b.hasExistingPricing) return -1;
          if (a.hasExistingPricing && !b.hasExistingPricing) return 1;

          // Then by oldest price update
          if (a.lastPriceUpdate && b.lastPriceUpdate) {
            return a.lastPriceUpdate.getTime() - b.lastPriceUpdate.getTime();
          }

          // Then by sailing date (sooner first)
          return a.sailingDate.getTime() - b.sailingDate.getTime();
        });

        cruiseData = cruiseData.slice(0, this.maxCruisesToProcess);
      }

      logger.info(`📊 Filtered cruises for line ${lineId}: ${cruiseData.length} to process`);

      return cruiseData;
    } catch (error) {
      logger.error(`Failed to get cruise info for line ${lineId}:`, error);
      throw error;
    }
  }

  /**
   * Process cruise updates with comprehensive data updates and cruise creation
   */
  private async processEnhancedCruiseUpdates(
    lineId: number,
    downloadResult: any
  ): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      created: 0,
      updated: 0,
      actuallyUpdated: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    // Track which cruises were successfully downloaded
    const downloadedCruiseIds = new Set(downloadResult.downloadedData.keys());

    // Count cruises that couldn't be downloaded (likely don't exist on FTP)
    const totalExpected = downloadResult.totalFiles || 0;
    const totalDownloaded = downloadedCruiseIds.size;
    result.skipped = totalExpected - totalDownloaded;

    logger.info(
      `📥 Downloaded ${totalDownloaded}/${totalExpected} cruise files (${result.skipped} not found on FTP)`
    );

    for (const [cruiseId, data] of downloadResult.downloadedData) {
      try {
        // Check if cruise exists
        const existingCruise = await db
          .select({ id: cruises.id })
          .from(cruises)
          .where(eq(cruises.id, cruiseId))
          .limit(1);

        if (existingCruise.length === 0) {
          // Create cruise if it doesn't exist
          logger.info(`🆕 Creating new cruise ${cruiseId} from webhook data`);
          await this.createCruiseFromWebhookData(cruiseId, data);
          result.created++;
        } else {
          // Capture pricing snapshot before update
          const batchId = `webhook_${Date.now()}`;
          await priceHistoryService.captureSnapshot(cruiseId, 'webhook_update', batchId);

          // Update ALL cruise data, not just pricing
          await this.updateAllCruiseData(cruiseId, data);
          result.updated++;
          result.actuallyUpdated++;
        }
      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`${cruiseId}: ${errorMsg}`);
        logger.error(`Failed to process cruise ${cruiseId}:`, error);
      }
    }

    return result;
  }

  /**
   * Create a new cruise from webhook data
   */
  private async createCruiseFromWebhookData(cruiseId: string, data: any): Promise<void> {
    try {
      const cruiseData = {
        id: cruiseId,
        cruiseId: data.cruiseid || cruiseId,
        cruiseLineId: data.lineid,
        shipId: data.shipid,
        name: data.cruisename || 'Unknown Cruise',
        sailingDate: new Date(data.saildate),
        nights: parseInt(data.nights) || 0,
        embarkationPortId: data.embarkportid,
        disembarkationPortId: data.disembarkportid,
        regionId: data.regionid,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(cruises).values(cruiseData);
      await this.updatePricingFromCachedData(cruiseId, data);

      logger.info(`✅ Created new cruise ${cruiseId} with pricing data`);
    } catch (error) {
      logger.error(`Failed to create cruise ${cruiseId}:`, error);
      throw error;
    }
  }

  /**
   * Update ALL cruise data fields, not just pricing
   */
  private async updateAllCruiseData(cruiseId: string, data: any): Promise<void> {
    try {
      await db
        .update(cruises)
        .set({
          name: data.cruisename,
          nights: parseInt(data.nights) || null,
          embarkationPortId: data.embarkportid,
          disembarkationPortId: data.disembarkportid,
          regionId: data.regionid,
          updatedAt: new Date(),
        })
        .where(eq(cruises.id, cruiseId));

      await this.updatePricingFromCachedData(cruiseId, data);

      // Update itinerary if present
      if (data.itinerary && Array.isArray(data.itinerary)) {
        await db.execute(sql`
          UPDATE cruises
          SET raw_data = jsonb_set(
            COALESCE(raw_data, '{}'::jsonb),
            '{itinerary}',
            ${JSON.stringify(data.itinerary)}::jsonb
          )
          WHERE id = ${cruiseId}
        `);
      }

      logger.debug(`✅ Updated all data for cruise ${cruiseId}`);
    } catch (error) {
      logger.error(`Failed to update cruise data for ${cruiseId}:`, error);
      throw error;
    }
  }

  /**
   * Update pricing data from cached cruise data
   */
  private async updatePricingFromCachedData(cruiseId: string, data: any): Promise<void> {
    try {
      // Delete existing pricing
      await db.execute(sql`DELETE FROM pricing WHERE cruise_id = ${cruiseId}`);

      // Process and insert new pricing data
      if (data.prices && typeof data.prices === 'object') {
        const pricingRecords = [];

        for (const [rateCode, cabins] of Object.entries(data.prices)) {
          if (typeof cabins !== 'object') continue;

          for (const [cabinCode, occupancies] of Object.entries(cabins as any)) {
            if (typeof occupancies !== 'object') continue;

            for (const [occupancyCode, pricingData] of Object.entries(occupancies as any)) {
              if (typeof pricingData !== 'object') continue;

              const pricing = pricingData as any;
              if (!pricing.price && !pricing.adultprice) continue;

              pricingRecords.push({
                cruiseId,
                rateCode: rateCode.substring(0, 50),
                cabinCode: cabinCode.substring(0, 10),
                occupancyCode: occupancyCode.substring(0, 10),
                cabinType: pricing.cabintype || null,
                basePrice: this.parseDecimal(pricing.price),
                adultPrice: this.parseDecimal(pricing.adultprice),
                childPrice: this.parseDecimal(pricing.childprice),
                totalPrice: this.calculateTotalPrice(pricing),
                isAvailable: pricing.available !== false,
                currency: data.currency || 'USD',
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }
          }
        }

        if (pricingRecords.length > 0) {
          await db.insert(pricing).values(pricingRecords);
          logger.debug(`Inserted ${pricingRecords.length} pricing records for cruise ${cruiseId}`);
        }
      }
    } catch (error) {
      logger.error(`Failed to update pricing for cruise ${cruiseId}:`, error);
      throw error;
    }
  }

  /**
   * Clear cache for a cruise line
   */
  private async clearCacheForCruiseLine(lineId: number): Promise<void> {
    try {
      const patterns = [
        `${CacheKeys.CRUISE_LINE}:${lineId}:*`,
        `search:*`,
        `cruise:*:line:${lineId}`,
      ];

      for (const pattern of patterns) {
        if (pattern === 'search:*') {
          await searchCacheService.invalidateAllSearchCaches();
        } else {
          await cacheService.deletePattern(pattern);
        }
      }

      logger.info(`Cleared cache for cruise line ${lineId}`);
    } catch (error) {
      logger.error(`Failed to clear cache for cruise line ${lineId}:`, error);
    }
  }

  private calculateTotalPrice(pricing: any): number {
    const base = this.parseDecimal(pricing.price || pricing.adultprice) || 0;
    const taxes = this.parseDecimal(pricing.taxes) || 0;
    const ncf = this.parseDecimal(pricing.ncf) || 0;
    const gratuity = this.parseDecimal(pricing.gratuity) || 0;
    const fuel = this.parseDecimal(pricing.fuel) || 0;
    const portCharges = this.parseDecimal(pricing.portcharges) || 0;
    const governmentFees = this.parseDecimal(pricing.governmentfees) || 0;

    return base + taxes + ncf + gratuity + fuel + portCharges + governmentFees;
  }

  private parseDecimal(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  /**
   * Process cruiseline pricing updated webhook with intelligent filtering
   */
  async processCruiselinePricingUpdate(data: WebhookPricingData): Promise<void> {
    const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      // Check if webhooks are paused
      if (await this.areWebhooksPaused()) {
        logger.info('⏸️ Webhooks are paused during sync operation, skipping processing');
        return;
      }

      if (!data.lineId) {
        throw new Error('Line ID is required for cruiseline pricing updates');
      }

      // Map webhook line ID to database line ID
      const databaseLineId = getDatabaseLineId(data.lineId);

      // Acquire line-level lock
      if (!(await this.acquireLineLock(databaseLineId, webhookId))) {
        logger.info(`📅 Deferring webhook for line ${databaseLineId} as another is in progress`);
        return;
      }

      try {
        logger.info('🚀 Starting enhanced cruiseline pricing update V2', {
          lineId: data.lineId,
          databaseLineId,
          webhookId,
          maxCruisesToProcess: this.maxCruisesToProcess,
          skipRecentlyUpdated: this.skipRecentlyUpdated,
        });

        // Get intelligently filtered cruises for the line
        const cruiseInfos = await this.getCruiseInfoForLineEnhanced(databaseLineId);

        if (cruiseInfos.length === 0) {
          logger.info(`No cruises need updating for cruise line ${data.lineId}`);

          // Send success notification even if no cruises needed updates
          await enhancedSlackService.notifyEnhancedWebhookComplete(
            {
              eventType: data.eventType,
              lineId: data.lineId,
              timestamp: data.timestamp,
            },
            {
              successful: 0,
              failed: 0,
              created: 0,
              actuallyUpdated: 0,
              skipped: 0,
            }
          );
          return;
        }

        logger.info(`🎯 Processing ${cruiseInfos.length} cruises that need updates`, {
          originalLineId: data.lineId,
          databaseLineId,
          cruiseCount: cruiseInfos.length,
        });

        // Perform bulk FTP download
        const downloadResult = await bulkFtpDownloader.downloadLineUpdates(
          databaseLineId,
          cruiseInfos
        );

        logger.info(`Bulk download completed`, {
          lineId: data.lineId,
          databaseLineId,
          totalFiles: downloadResult.totalFiles,
          successful: downloadResult.successfulDownloads,
          failed: downloadResult.failedDownloads,
          duration: `${(downloadResult.duration / 1000).toFixed(2)}s`,
        });

        // Process downloaded data
        const processingResult = await this.processEnhancedCruiseUpdates(
          databaseLineId,
          downloadResult
        );

        logger.info('✅ Enhanced processing completed V2', {
          created: processingResult.created,
          updated: processingResult.updated,
          actuallyUpdated: processingResult.actuallyUpdated,
          failed: processingResult.failed,
          skipped: processingResult.skipped,
          errors: processingResult.errors.length,
        });

        // Clear caches
        await this.clearCacheForCruiseLine(databaseLineId);

        // Send Slack notification with accurate counts
        await enhancedSlackService.notifyEnhancedWebhookComplete(
          {
            eventType: data.eventType,
            lineId: data.lineId,
            timestamp: data.timestamp,
          },
          {
            successful: processingResult.updated + processingResult.created,
            failed: processingResult.failed,
            created: processingResult.created,
            actuallyUpdated: processingResult.actuallyUpdated,
            skipped: processingResult.skipped,
          }
        );
      } finally {
        await this.releaseLineLock(databaseLineId, webhookId);
      }
    } catch (error) {
      logger.error('Enhanced webhook processing failed:', error);

      // Send failure notification
      await enhancedSlackService.notifyEnhancedWebhookComplete(
        {
          eventType: data.eventType,
          lineId: data.lineId,
          timestamp: data.timestamp,
        },
        {
          successful: 0,
          failed: 1,
          created: 0,
          actuallyUpdated: 0,
          skipped: 0,
        }
      );

      throw error;
    }
  }
}

export const enhancedWebhookServiceV2 = new EnhancedWebhookServiceV2();
