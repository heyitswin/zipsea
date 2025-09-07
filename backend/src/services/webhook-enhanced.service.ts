import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/connection';
import { logger } from '../config/logger';
import { cruises, pricing, cheapestPricing, ships, cruiseLines } from '../db/schema';
import { traveltekFTPService } from './traveltek-ftp.service';
import { dataSyncService } from './data-sync.service';
import { cacheManager, searchCache, cruiseCache } from '../cache/cache-manager';
import { CacheKeys } from '../cache/cache-keys';
import { enhancedSlackService as slackService } from './slack-enhanced.service';
import { bulkFtpDownloader } from './bulk-ftp-downloader.service';
import { getDatabaseLineId } from '../config/cruise-line-mapping';
import redisClient from '../cache/redis';
import { priceHistoryService } from './price-history.service';

export interface WebhookPricingData {
  cruiseId?: number;
  cruiseIds?: number[];
  lineId?: number;
  shipId?: number;
  priceData?: any;
  timestamp?: string;
  eventType: string;
}

export interface WebhookAvailabilityData {
  cruiseId: number;
  cabinCode?: string;
  availabilityData?: any;
  timestamp?: string;
}

export interface WebhookBookingData {
  bookingId: string;
  cruiseId: number;
  passengerCount: number;
  totalPrice: number;
  timestamp?: string;
}

export class EnhancedWebhookService {
  private lineLockTTL = 600; // 10 minutes lock timeout

  /**
   * Check if webhooks are paused system-wide
   */
  private async areWebhooksPaused(): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        SELECT value FROM system_flags
        WHERE key = 'webhooks_paused'
        LIMIT 1
      `);

      if (result.rows && result.rows.length > 0) {
        const flag = result.rows[0] as any;
        return flag.value === 'true';
      }
      return false;
    } catch (error) {
      // If table doesn't exist or error, assume webhooks are not paused
      logger.debug('Could not check webhook pause status:', error);
      return false;
    }
  }

  /**
   * Acquire line-level lock for webhook processing
   */
  private async acquireLineLock(lineId: number, webhookId: string): Promise<boolean> {
    const lockKey = `webhook:line:${lineId}:lock`;

    try {
      // Try to acquire lock with NX (only if not exists) and EX (expire)
      const acquired = await redisClient.set(lockKey, webhookId, {
        NX: true,
        EX: this.lineLockTTL,
      });

      if (acquired) {
        logger.info(`🔒 Acquired line lock for line ${lineId}, webhook ${webhookId}`);
        return true;
      } else {
        const currentHolder = await redisClient.get(lockKey);
        logger.info(`🔒 Line ${lineId} already locked by webhook ${currentHolder}, deferring`);
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
      // Only delete if we own the lock
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
   * Process cruiseline pricing updated webhook with all improvements
   */
  async processCruiselinePricingUpdate(data: WebhookPricingData): Promise<void> {
    const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      // 1. Check if webhooks are paused during sync
      if (await this.areWebhooksPaused()) {
        logger.info('⏸️ Webhooks are paused during sync operation, skipping processing', {
          lineId: data.lineId,
          eventType: data.eventType,
        });
        return;
      }

      if (!data.lineId) {
        throw new Error('Line ID is required for cruiseline pricing updates');
      }

      // 2. Map webhook line ID to database line ID
      const databaseLineId = getDatabaseLineId(data.lineId);

      // 3. Acquire line-level lock to prevent concurrent processing
      const lockAcquired = await this.acquireLineLock(databaseLineId, webhookId);
      if (!lockAcquired) {
        // Another webhook is processing this line, defer
        logger.info(`📅 Deferring webhook for line ${databaseLineId} as another is in progress`);
        // Could re-queue with delay here if using a queue system
        return;
      }

      try {
        logger.info('🚀 Starting enhanced cruiseline pricing update', {
          lineId: data.lineId,
          databaseLineId,
          webhookId,
          eventType: data.eventType,
          timestamp: new Date().toISOString(),
        });

        // 4. Get ALL future cruises for the line (no date limit)
        const cruiseInfos = await this.getCruiseInfoForLineEnhanced(databaseLineId);

        logger.info(`🎯 Found ${cruiseInfos.length} future cruises for bulk download`, {
          originalLineId: data.lineId,
          databaseLineId,
          cruiseCount: cruiseInfos.length,
        });

        if (cruiseInfos.length === 0) {
          logger.warn(`No active future cruises found for cruise line ${data.lineId}`);
          return;
        }

        // 5. Perform bulk FTP download with enhanced processing
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

        // 6. Process downloaded data with comprehensive updates
        const processingResult = await this.processEnhancedCruiseUpdates(
          databaseLineId,
          downloadResult
        );

        logger.info('✅ Enhanced processing completed', {
          created: processingResult.created,
          updated: processingResult.updated,
          actuallyUpdated: processingResult.actuallyUpdated,
          errors: processingResult.errors.length,
        });

        // 7. Clear relevant cache entries
        await this.clearCacheForCruiseLine(databaseLineId);

        // 8. Send success notification
        await slackService.notifyCruiseLinePricingUpdate(data, {
          successful: processingResult.actuallyUpdated,
          failed: processingResult.failed,
        });
      } finally {
        // Always release the lock
        await this.releaseLineLock(databaseLineId, webhookId);
      }
    } catch (error) {
      logger.error('Failed to process enhanced cruiseline pricing update:', error);

      // Send error notification
      await slackService.notifySyncError(
        error instanceof Error ? error.message : 'Unknown error',
        `Enhanced webhook processing for line ${data.lineId}`
      );

      throw error;
    }
  }

  /**
   * Get cruise info with ALL future sailings (no 2-year limit)
   */
  private async getCruiseInfoForLineEnhanced(lineId: number): Promise<any[]> {
    try {
      const cruiseData = await db
        .select({
          id: cruises.id,
          cruiseCode: cruises.cruiseId,
          shipId: cruises.shipId,
          shipName: sql<string>`COALESCE(ships.name, 'Unknown_Ship')`,
          sailingDate: cruises.sailingDate,
        })
        .from(cruises)
        .leftJoin(ships, sql`${ships.id} = ${cruises.shipId}`)
        .where(
          sql`${cruises.cruiseLineId} = ${lineId}
              AND ${cruises.sailingDate} >= CURRENT_DATE
              AND ${cruises.isActive} = true`
        )
        .orderBy(sql`${cruises.sailingDate} ASC`);

      return cruiseData.map(cruise => ({
        id: cruise.id,
        cruiseCode: cruise.cruiseCode,
        shipId: cruise.shipId,
        shipName: cruise.shipName || `Ship_${cruise.id}`,
        sailingDate: new Date(cruise.sailingDate),
      }));
    } catch (error) {
      logger.error(`Failed to get cruise info for line ${lineId}:`, error);
      throw error;
    }
  }

  /**
   * Process cruise updates with comprehensive data updates and cruise creation
   */
  private async processEnhancedCruiseUpdates(lineId: number, downloadResult: any): Promise<any> {
    const result = {
      created: 0,
      updated: 0,
      actuallyUpdated: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const [cruiseId, data] of downloadResult.downloadedData) {
      try {
        // Check if cruise exists
        const existingCruise = await db
          .select({ id: cruises.id })
          .from(cruises)
          .where(eq(cruises.id, cruiseId))
          .limit(1);

        if (existingCruise.length === 0) {
          // CRITICAL: Create cruise if it doesn't exist
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
      // Extract all necessary fields from the data
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

      // Insert cruise
      await db.insert(cruises).values(cruiseData);

      // Process and insert pricing data
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
      // Update cruise details
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

      // Update pricing
      await this.updatePricingFromCachedData(cruiseId, data);

      // Update itinerary if present
      if (data.itinerary && Array.isArray(data.itinerary)) {
        // Store itinerary in raw_data or dedicated table
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
      // Clear all cache entries for this cruise line
      const patterns = [
        `${CacheKeys.CRUISE_LINE}:${lineId}:*`,
        `search:*`, // Clear search cache as cruise data changed
        `cruise:*:line:${lineId}`, // Clear individual cruise caches for this line
      ];

      for (const pattern of patterns) {
        await cacheManager.deletePattern(pattern);
      }

      logger.info(`Cleared cache for cruise line ${lineId}`);
    } catch (error) {
      logger.error(`Failed to clear cache for cruise line ${lineId}:`, error);
    }
  }

  /**
   * Helper methods
   */
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
   * Process specific cruise pricing updated webhook
   */
  async processCruisePricingUpdate(data: WebhookPricingData): Promise<void> {
    try {
      // Check if webhooks are paused
      if (await this.areWebhooksPaused()) {
        logger.info('⏸️ Webhooks are paused, skipping cruise pricing update');
        return;
      }

      logger.info('Processing cruise pricing update', {
        cruiseId: data.cruiseId,
        cruiseIds: data.cruiseIds?.length,
        eventType: data.eventType,
      });

      const cruiseIds = data.cruiseId ? [data.cruiseId] : data.cruiseIds || [];
      if (cruiseIds.length === 0) {
        throw new Error('Cruise ID(s) required for pricing updates');
      }

      let successful = 0;
      let failed = 0;

      for (const cruiseId of cruiseIds) {
        try {
          // Capture pricing snapshot
          await priceHistoryService.captureSnapshot(cruiseId, 'webhook_cruise_update');

          // Update cruise pricing
          await this.updateCruisePricing(cruiseId);

          // Clear cache
          await this.clearCacheForCruise(cruiseId);

          successful++;
        } catch (error) {
          failed++;
          logger.error(`Failed to update pricing for cruise ${cruiseId}:`, error);
        }
      }

      logger.info(`Cruise pricing update completed: ${successful} successful, ${failed} failed`);

      await slackService.notifyCruisePricingUpdate(data, { successful, failed });
    } catch (error) {
      logger.error('Failed to process cruise pricing update:', error);
      throw error;
    }
  }

  /**
   * Update cruise pricing
   */
  private async updateCruisePricing(cruiseId: number): Promise<void> {
    // Implementation for updating specific cruise pricing
    // This would fetch from FTP and update the database
    logger.info(`Updating pricing for cruise ${cruiseId}`);
  }

  /**
   * Clear cache for a specific cruise
   */
  private async clearCacheForCruise(cruiseId: number): Promise<void> {
    try {
      const patterns = [`${CacheKeys.CRUISE}:${cruiseId}:*`, `cruise:${cruiseId}:*`];

      for (const pattern of patterns) {
        await cacheManager.deletePattern(pattern);
      }

      logger.info(`Cleared cache for cruise ${cruiseId}`);
    } catch (error) {
      logger.error(`Failed to clear cache for cruise ${cruiseId}:`, error);
    }
  }
}

// Export singleton instance
export const enhancedWebhookService = new EnhancedWebhookService();
