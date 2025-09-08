import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/connection';
import { logger } from '../config/logger';
import { cruises, pricing, cheapestPricing, ships, cruiseLines } from '../db/schema';
import { traveltekFTPService } from './traveltek-ftp.service';
import { dataSyncService } from './data-sync.service';
import { cacheManager, searchCache, cruiseCache } from '../cache/cache-manager';
import { CacheKeys } from '../cache/cache-keys';
import { enhancedSlackService as slackService } from './slack-enhanced.service';
import { bulkFtpDownloaderFixed as bulkFtpDownloader } from './bulk-ftp-downloader-fixed.service';
import { getDatabaseLineId } from '../config/cruise-line-mapping';
import redisClient from '../cache/redis';
import { priceHistoryService } from './price-history.service';

console.log('🚨🚨🚨 [MODULE INIT] EnhancedWebhookService loading...');
console.log('🚨🚨🚨 [MODULE INIT] redisClient type:', typeof redisClient);
console.log('🚨🚨🚨 [MODULE INIT] redisClient exists:', !!redisClient);
if (redisClient && typeof redisClient.get === 'function') {
  console.log('🚨🚨🚨 [MODULE INIT] redisClient.get is a function');
} else {
  console.error('🚨🚨🚨 [MODULE INIT] redisClient.get is NOT a function or redisClient is null!');
}

export interface WebhookPricingData {
  cruiseId?: number;
  cruiseIds?: number[];
  lineId?: number;
  shipId?: number;
  priceData?: any;
  timestamp?: string;
  eventType: string;
  webhookId?: string;
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
    console.log('🚨🚨🚨 [LOCK] acquireLineLock called for line:', lineId, 'webhook:', webhookId);
    const lockKey = `webhook:line:${lineId}:lock`;
    console.log('🚨🚨🚨 [LOCK] Lock key:', lockKey);

    try {
      console.log('🚨🚨🚨 [LOCK] Checking if lock already exists...');
      // Check if lock already exists
      const currentHolder = await redisClient.get(lockKey);
      console.log('🚨🚨🚨 [LOCK] Current lock holder:', currentHolder);

      if (currentHolder) {
        logger.info(`🔒 Line ${lineId} already locked by webhook ${currentHolder}, deferring`);
        return false;
      }

      console.log('🚨🚨🚨 [LOCK] No existing lock, attempting to acquire...');
      // Try to acquire lock with TTL
      await redisClient.set(lockKey, webhookId, this.lineLockTTL);
      console.log('🚨🚨🚨 [LOCK] Lock set in Redis');

      // Double-check we got the lock (race condition protection)
      console.log('🚨🚨🚨 [LOCK] Verifying lock acquisition...');
      const verifyHolder = await redisClient.get(lockKey);
      console.log('🚨🚨🚨 [LOCK] Verification result:', verifyHolder);

      if (verifyHolder === webhookId) {
        console.log('🚨🚨🚨 [LOCK] Lock successfully acquired!');
        logger.info(`🔒 Acquired line lock for line ${lineId}, webhook ${webhookId}`);
        return true;
      } else {
        console.log('🚨🚨🚨 [LOCK] Lost race condition to:', verifyHolder);
        logger.info(`🔒 Lost race for line ${lineId} lock to webhook ${verifyHolder}`);
        return false;
      }
    } catch (error) {
      console.error('🚨🚨🚨 [LOCK] ERROR in acquireLineLock:', error);
      logger.error('Failed to acquire line lock:', error);
      // On error, proceed without lock (fail-open)
      console.log('🚨🚨🚨 [LOCK] Returning true due to error (fail-open)');
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
    console.log('🚨🚨🚨 [ENHANCED SERVICE] processCruiselinePricingUpdate CALLED');
    console.log('🚨🚨🚨 [ENHANCED SERVICE] data:', JSON.stringify(data));

    const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    console.log('🚨🚨🚨 [ENHANCED SERVICE] webhookId generated:', webhookId);

    try {
      console.log('🚨🚨🚨 [ENHANCED SERVICE] Checking if webhooks are paused...');
      // 1. Check if webhooks are paused during sync
      let paused = false;
      try {
        paused = await this.areWebhooksPaused();
        console.log('🚨🚨🚨 [ENHANCED SERVICE] Webhooks paused check result:', paused);
      } catch (pauseError) {
        console.error('🚨🚨🚨 [ENHANCED SERVICE] Error checking webhook pause:', pauseError);
        throw pauseError;
      }

      if (paused) {
        logger.info('⏸️ Webhooks are paused during sync operation, skipping processing', {
          lineId: data.lineId,
          eventType: data.eventType,
        });
        return;
      }

      if (!data.lineId) {
        console.error('🚨🚨🚨 [ENHANCED SERVICE] No line ID provided!');
        throw new Error('Line ID is required for cruiseline pricing updates');
      }

      console.log('🚨🚨🚨 [ENHANCED SERVICE] Mapping webhook line ID to database line ID...');
      // 2. Map webhook line ID to database line ID
      const databaseLineId = getDatabaseLineId(data.lineId);
      console.log('🚨🚨🚨 [ENHANCED SERVICE] Database line ID:', databaseLineId);

      // 3. Acquire line-level lock to prevent concurrent processing
      console.log('🚨🚨🚨 [ENHANCED SERVICE] About to acquire lock for line:', databaseLineId);
      let lockAcquired = false;
      try {
        lockAcquired = await this.acquireLineLock(databaseLineId, webhookId);
        console.log('🚨🚨🚨 [ENHANCED SERVICE] Lock acquisition result:', lockAcquired);
      } catch (lockError) {
        console.error('🚨🚨🚨 [ENHANCED SERVICE] ERROR acquiring lock:', lockError);
        throw lockError;
      }

      if (!lockAcquired) {
        console.log('🚨🚨🚨 [ENHANCED SERVICE] Lock not acquired, deferring webhook');
        // Another webhook is processing this line, defer
        logger.info(`📅 Deferring webhook for line ${databaseLineId} as another is in progress`);
        // Could re-queue with delay here if using a queue system
        return;
      }
      console.log('🚨🚨🚨 [ENHANCED SERVICE] Lock acquired successfully');

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
        console.log('🚨 [DEBUG] About to call bulkFtpDownloader.downloadLineUpdates');
        const downloadResult = await bulkFtpDownloader.downloadLineUpdates(
          databaseLineId,
          cruiseInfos
        );
        console.log('🚨 [DEBUG] Download result:', downloadResult);

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

        // 8. Send enhanced success notification with detailed metrics
        console.log('🚨 [DEBUG] About to send Slack notification');

        // Calculate success rate
        const totalAttempted = downloadResult.totalFiles;
        const successRate =
          totalAttempted > 0
            ? Math.round((downloadResult.successfulDownloads / totalAttempted) * 100)
            : 0;

        // Prepare enhanced notification data
        const notificationData = {
          lineId: data.lineId,
          databaseLineId,
          successful: processingResult.actuallyUpdated,
          failed: processingResult.failed,
          created: processingResult.created,
          totalFiles: downloadResult.totalFiles,
          successfulDownloads: downloadResult.successfulDownloads,
          failedDownloads: downloadResult.failedDownloads,
          corruptedFiles: downloadResult.corruptedFiles || 0,
          fileNotFoundErrors: downloadResult.fileNotFoundErrors,
          parseErrors: downloadResult.parseErrors,
          successRate,
          duration: downloadResult.duration,
        };

        try {
          // Send enhanced notification with corruption details
          await slackService.notifyEnhancedWebhookUpdate(notificationData);
          console.log('🚨 [DEBUG] Slack notification sent successfully');
        } catch (slackError) {
          console.error('🚨 [DEBUG] Slack notification error:', slackError);
          // Don't throw - we don't want notification failures to break the webhook
        }
      } finally {
        // Always release the lock
        await this.releaseLineLock(databaseLineId, webhookId);
      }
    } catch (error) {
      logger.error('Failed to process enhanced cruiseline pricing update:', error);
      console.error('🚨 [DEBUG] Enhanced webhook processing error:', error);

      // Send error notification
      console.log('🚨 [DEBUG] About to send Slack error notification');
      try {
        await slackService.notifySyncError(
          error instanceof Error ? error.message : 'Unknown error',
          `Enhanced webhook processing for line ${data.lineId}`
        );
        console.log('🚨 [DEBUG] Slack error notification sent');
      } catch (slackError) {
        console.error('🚨 [DEBUG] Failed to send Slack error notification:', slackError);
      }

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
          try {
            await priceHistoryService.captureSnapshot(cruiseId, 'webhook_update', batchId);
          } catch (snapshotError) {
            logger.warn(`Failed to capture price snapshot for ${cruiseId}:`, snapshotError);
            // Continue with update even if snapshot fails
          }

          // Update ALL cruise data, not just pricing
          await this.updateAllCruiseData(cruiseId, data);
          result.updated++;
          result.actuallyUpdated++;
        }
      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`${cruiseId}: ${errorMsg}`);

        // Log detailed error information
        logger.error(`❌ Failed to process cruise ${cruiseId}:`, {
          cruiseId,
          error: errorMsg,
          stack: error instanceof Error ? error.stack : undefined,
          dataKeys: data ? Object.keys(data).slice(0, 10) : [],
          hasName: data ? !!data.name : false,
          hasPricing: data ? !!data.cheapest : false,
        });
      }
    }

    return result;
  }

  /**
   * Create a new cruise from webhook data
   */
  private async createCruiseFromWebhookData(cruiseId: string, data: any): Promise<void> {
    try {
      logger.info(`🆕 Creating cruise ${cruiseId} with field mapping:`, {
        cruiseId,
        dataKeys: Object.keys(data).slice(0, 15),
        name: data.name,
        lineid: data.lineid,
        shipid: data.shipid,
      });

      // Extract all necessary fields from the data with CORRECT field names
      const cruiseData: any = {
        id: cruiseId,
        cruiseId: data.cruiseid || cruiseId,
        cruiseLineId: data.lineid,
        shipId: data.shipid,
        name: data.name || 'Unknown Cruise', // Use 'name' not 'cruisename'
        sailingDate: new Date(data.saildate),
        nights: parseInt(data.nights) || 0,
        embarkationPortId: data.startportid, // Use 'startportid' not 'embarkportid'
        disembarkationPortId: data.endportid, // Use 'endportid' not 'disembarkportid'
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add optional fields if present
      if (data.voyagecode) cruiseData.voyageCode = data.voyagecode;
      if (data.itinerarycode) cruiseData.itineraryCode = data.itinerarycode;
      if (data.seadays !== undefined) cruiseData.seaDays = parseInt(data.seadays) || null;
      if (data.regionids) {
        cruiseData.regionIds = Array.isArray(data.regionids)
          ? data.regionids.join(',')
          : data.regionids;
      }
      if (data.marketid !== undefined) cruiseData.marketId = data.marketid;
      if (data.ownerid !== undefined) cruiseData.ownerId = data.ownerid;
      if (data.nofly !== undefined) cruiseData.noFly = data.nofly === 'Y' || data.nofly === true;
      if (data.departuk !== undefined) cruiseData.departUk = data.departuk;
      if (data.showcruise !== undefined) cruiseData.showCruise = data.showcruise;

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
      // Log the actual data structure for debugging
      logger.debug(`📝 Updating cruise ${cruiseId} with data keys:`, {
        cruiseId,
        dataKeys: Object.keys(data).slice(0, 20),
        hasName: !!data.name,
        hasCruisename: !!data.cruisename,
        name: data.name,
        nights: data.nights,
        startportid: data.startportid,
        endportid: data.endportid,
      });

      // Update cruise details with CORRECT field names from Traveltek JSON
      const updateData: any = {
        updatedAt: new Date(),
      };

      // Map the correct field names from Traveltek JSON
      if (data.name) updateData.name = data.name;
      if (data.nights !== undefined) updateData.nights = parseInt(data.nights) || null;
      if (data.startportid !== undefined) updateData.embarkationPortId = data.startportid;
      if (data.endportid !== undefined) updateData.disembarkationPortId = data.endportid;

      // Handle region IDs - can be array or comma-separated string
      if (data.regionids) {
        if (Array.isArray(data.regionids)) {
          updateData.regionIds = data.regionids.join(',');
        } else {
          updateData.regionIds = data.regionids;
        }
      }

      // Additional fields from Traveltek
      if (data.saildate) updateData.sailingDate = new Date(data.saildate);
      if (data.voyagecode) updateData.voyageCode = data.voyagecode;
      if (data.itinerarycode) updateData.itineraryCode = data.itinerarycode;
      if (data.seadays !== undefined) updateData.seaDays = parseInt(data.seadays) || null;
      if (data.marketid !== undefined) updateData.marketId = data.marketid;
      if (data.ownerid !== undefined) updateData.ownerId = data.ownerid;
      if (data.nofly !== undefined) updateData.noFly = data.nofly === 'Y' || data.nofly === true;
      if (data.departuk !== undefined) updateData.departUk = data.departuk;
      if (data.showcruise !== undefined) updateData.showCruise = data.showcruise;

      // Only update if we have fields to update
      if (Object.keys(updateData).length > 1) {
        // More than just updatedAt
        await db.update(cruises).set(updateData).where(eq(cruises.id, cruiseId));

        logger.debug(`✅ Updated cruise fields for ${cruiseId}`, {
          fieldsUpdated: Object.keys(updateData),
        });
      } else {
        logger.warn(`⚠️ No fields to update for cruise ${cruiseId}`);
      }

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
   * Extract and update cheapest pricing from webhook data
   * This is critical for search and display functionality
   */
  private async extractAndUpdateCheapestPricing(cruiseId: string, data: any): Promise<void> {
    try {
      logger.info(`🏷️ Extracting cheapest pricing for cruise ${cruiseId}`);

      // Check if data has cheapest field (preferred)
      if (data.cheapest && data.cheapest.combined) {
        const combined = data.cheapest.combined;

        // Find the actual cheapest price across all cabin types
        const prices = [combined.inside, combined.outside, combined.balcony, combined.suite].filter(
          p => p && p > 0
        );

        const cheapestPrice = prices.length > 0 ? Math.min(...prices) : null;

        // Determine which cabin type is cheapest
        let cheapestCabinType = 'inside';
        if (cheapestPrice) {
          if (cheapestPrice === combined.inside) cheapestCabinType = 'inside';
          else if (cheapestPrice === combined.outside) cheapestCabinType = 'oceanview';
          else if (cheapestPrice === combined.balcony) cheapestCabinType = 'balcony';
          else if (cheapestPrice === combined.suite) cheapestCabinType = 'suite';
        }

        // Delete existing cheapest pricing record
        await db.execute(sql`DELETE FROM cheapest_pricing WHERE cruise_id = ${cruiseId}`);

        // Insert new cheapest pricing record
        await db.insert(cheapestPricing).values({
          cruiseId,
          cheapestPrice,
          interiorPrice: combined.inside || null,
          oceanviewPrice: combined.outside || null,
          balconyPrice: combined.balcony || null,
          suitePrice: combined.suite || null,
          currency: data.currency || 'USD',
          cheapestCabinType,
          lastUpdated: new Date(),
          priceCode: data.cheapest.ratecode || null,
          isComplete: true,
        });

        logger.info(`✅ Updated cheapest pricing for cruise ${cruiseId}`, {
          cheapestPrice,
          cabinType: cheapestCabinType,
          hasAllTypes:
            !!combined.inside && !!combined.outside && !!combined.balcony && !!combined.suite,
        });
      } else if (data.prices && typeof data.prices === 'object') {
        // Fallback: Calculate cheapest from detailed prices
        logger.info(`📊 Calculating cheapest pricing from detailed prices for cruise ${cruiseId}`);

        let lowestPrice = null;
        let cabinPrices = {
          inside: null as number | null,
          oceanview: null as number | null,
          balcony: null as number | null,
          suite: null as number | null,
        };

        // Iterate through all rate codes and cabin types to find cheapest
        for (const [rateCode, cabins] of Object.entries(data.prices)) {
          if (typeof cabins !== 'object') continue;

          for (const [cabinCode, occupancies] of Object.entries(cabins as any)) {
            if (typeof occupancies !== 'object') continue;

            // Get the cabin type from the code (usually first character)
            const cabinTypeCode = cabinCode.charAt(0).toUpperCase();
            let cabinType: keyof typeof cabinPrices | null = null;

            if (cabinTypeCode === 'I') cabinType = 'inside';
            else if (cabinTypeCode === 'O' || cabinTypeCode === 'E') cabinType = 'oceanview';
            else if (cabinTypeCode === 'B') cabinType = 'balcony';
            else if (cabinTypeCode === 'S' || cabinTypeCode === 'P') cabinType = 'suite';

            for (const [occupancyCode, pricingData] of Object.entries(occupancies as any)) {
              if (typeof pricingData !== 'object') continue;

              const pricing = pricingData as any;
              const price = this.parseDecimal(pricing.price || pricing.adultprice);

              if (price && price > 0) {
                // Update lowest overall price
                if (!lowestPrice || price < lowestPrice) {
                  lowestPrice = price;
                }

                // Update cabin type specific price
                if (cabinType && (!cabinPrices[cabinType] || price < cabinPrices[cabinType]!)) {
                  cabinPrices[cabinType] = price;
                }
              }
            }
          }
        }

        if (lowestPrice) {
          // Determine cheapest cabin type
          let cheapestCabinType = 'inside';
          if (lowestPrice === cabinPrices.inside) cheapestCabinType = 'inside';
          else if (lowestPrice === cabinPrices.oceanview) cheapestCabinType = 'oceanview';
          else if (lowestPrice === cabinPrices.balcony) cheapestCabinType = 'balcony';
          else if (lowestPrice === cabinPrices.suite) cheapestCabinType = 'suite';

          // Delete existing and insert new
          await db.execute(sql`DELETE FROM cheapest_pricing WHERE cruise_id = ${cruiseId}`);

          await db.insert(cheapestPricing).values({
            cruiseId,
            cheapestPrice: lowestPrice,
            interiorPrice: cabinPrices.inside,
            oceanviewPrice: cabinPrices.oceanview,
            balconyPrice: cabinPrices.balcony,
            suitePrice: cabinPrices.suite,
            currency: data.currency || 'USD',
            cheapestCabinType,
            lastUpdated: new Date(),
            priceCode: null,
            isComplete: false, // Mark as incomplete since we calculated it
          });

          logger.info(`✅ Calculated and updated cheapest pricing for cruise ${cruiseId}`, {
            cheapestPrice: lowestPrice,
            cabinType: cheapestCabinType,
            method: 'calculated_from_detailed',
          });
        } else {
          logger.warn(`⚠️ No valid pricing found for cruise ${cruiseId}`);
        }
      } else {
        logger.warn(`⚠️ No pricing data available for cruise ${cruiseId}`);
      }

      // Also update the cruise record with cheapest price for quick access
      if (data.cheapest?.combined) {
        const prices = [
          data.cheapest.combined.inside,
          data.cheapest.combined.outside,
          data.cheapest.combined.balcony,
          data.cheapest.combined.suite,
        ].filter(p => p && p > 0);

        const cheapestPrice = prices.length > 0 ? Math.min(...prices) : null;

        if (cheapestPrice) {
          await db.execute(sql`
            UPDATE cruises
            SET
              cheapest_price = ${cheapestPrice},
              has_pricing = true,
              pricing_updated_at = NOW()
            WHERE id = ${cruiseId}
          `);
        }
      }
    } catch (error) {
      logger.error(`Failed to extract cheapest pricing for cruise ${cruiseId}:`, error);
      // Don't throw - we want to continue processing even if cheapest pricing fails
    }
  }

  /**
   * Update pricing data from cached cruise data
   */
  private async updatePricingFromCachedData(cruiseId: string, data: any): Promise<void> {
    try {
      // Delete existing pricing
      await db.execute(sql`DELETE FROM pricing WHERE cruise_id = ${cruiseId}`);

      // Extract and update cheapest pricing FIRST (most important)
      await this.extractAndUpdateCheapestPricing(cruiseId, data);

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

      // Clear cache entries
      for (const pattern of patterns) {
        if (pattern === 'search:*') {
          // Clear all search caches
          await searchCache.invalidateAllSearchCaches();
        } else {
          // Use deletePattern for other patterns
          await cacheManager.deletePattern(pattern);
        }
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

      await slackService.notifyCruiseLinePricingUpdate(data, { successful, failed });
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
