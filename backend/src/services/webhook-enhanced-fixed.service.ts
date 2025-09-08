import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/connection';
import { logger } from '../config/logger';
import { cruises, pricing, cheapestPricing, ships, cruiseLines, ports } from '../db/schema';
import { traveltekFTPService } from './traveltek-ftp.service';
import { dataSyncService } from './data-sync.service';
import { cacheManager, searchCache, cruiseCache } from '../cache/cache-manager';
import { CacheKeys } from '../cache/cache-keys';
import { enhancedSlackService as slackService } from './slack-enhanced.service';
import { bulkFtpDownloaderFixed as bulkFtpDownloader } from './bulk-ftp-downloader-fixed.service';
import { getDatabaseLineId } from '../config/cruise-line-mapping';
import redisClient from '../cache/redis';
import { priceHistoryService } from './price-history.service';

export class EnhancedWebhookServiceFixed {
  private lineLockTTL = 600; // 10 minutes lock timeout

  /**
   * Validate foreign key constraints before insert/update
   */
  private async validateForeignKeys(data: any): Promise<{
    valid: boolean;
    errors: string[];
    fixedData: any;
  }> {
    const errors: string[] = [];
    const fixedData = { ...data };

    try {
      // 1. Validate ship belongs to the correct line
      if (data.shipid && data.lineid) {
        const shipCheck = await db
          .select({ cruiseLineId: ships.cruiseLineId })
          .from(ships)
          .where(eq(ships.id, data.shipid))
          .limit(1);

        if (shipCheck.length > 0) {
          if (shipCheck[0].cruiseLineId !== data.lineid) {
            // Ship belongs to different line - use ship's actual line
            logger.warn(`⚠️ Ship ${data.shipid} belongs to line ${shipCheck[0].cruiseLineId}, not ${data.lineid}. Using ship's line.`);
            fixedData.lineid = shipCheck[0].cruiseLineId;
          }
        } else {
          errors.push(`Ship ${data.shipid} does not exist`);
        }
      }

      // 2. Validate ports exist, set to null if not
      if (data.startportid) {
        const portCheck = await db
          .select({ id: ports.id })
          .from(ports)
          .where(eq(ports.id, data.startportid))
          .limit(1);

        if (portCheck.length === 0) {
          logger.warn(`⚠️ Start port ${data.startportid} does not exist, setting to null`);
          fixedData.startportid = null;
        }
      }

      if (data.endportid) {
        const portCheck = await db
          .select({ id: ports.id })
          .from(ports)
          .where(eq(ports.id, data.endportid))
          .limit(1);

        if (portCheck.length === 0) {
          logger.warn(`⚠️ End port ${data.endportid} does not exist, setting to null`);
          fixedData.endportid = null;
        }
      }

      // 3. Validate cruise line exists
      if (fixedData.lineid) {
        const lineCheck = await db
          .select({ id: cruiseLines.id })
          .from(cruiseLines)
          .where(eq(cruiseLines.id, fixedData.lineid))
          .limit(1);

        if (lineCheck.length === 0) {
          errors.push(`Cruise line ${fixedData.lineid} does not exist`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        fixedData
      };
    } catch (error) {
      logger.error('Error validating foreign keys:', error);
      return {
        valid: false,
        errors: ['Foreign key validation failed'],
        fixedData
      };
    }
  }

  /**
   * Process cruise updates with foreign key validation
   */
  async processEnhancedCruiseUpdates(lineId: number, downloadResult: any): Promise<any> {
    const result = {
      created: 0,
      updated: 0,
      actuallyUpdated: 0,
      failed: 0,
      skipped: 0,
      constraintViolations: 0,
      errors: [] as string[],
    };

    for (const [cruiseId, data] of downloadResult.downloadedData) {
      try {
        // Validate foreign keys first
        const validation = await this.validateForeignKeys(data);

        if (!validation.valid) {
          result.constraintViolations++;
          result.failed++;
          result.errors.push(`${cruiseId}: Foreign key violations - ${validation.errors.join(', ')}`);
          logger.error(`❌ Skipping cruise ${cruiseId} due to constraint violations:`, validation.errors);
          continue;
        }

        // Use the fixed data with validated foreign keys
        const validatedData = validation.fixedData;

        // Check if cruise exists
        const existingCruise = await db
          .select({ id: cruises.id })
          .from(cruises)
          .where(eq(cruises.id, cruiseId))
          .limit(1);

        if (existingCruise.length === 0) {
          // Create new cruise with validated data
          logger.info(`🆕 Creating new cruise ${cruiseId} with validated data`);
          await this.createCruiseFromWebhookData(cruiseId, validatedData);
          result.created++;
        } else {
          // Update existing cruise with validated data
          await this.updateAllCruiseData(cruiseId, validatedData);
          result.updated++;
          result.actuallyUpdated++;
        }
      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`${cruiseId}: ${errorMsg}`);

        // Enhanced error logging
        logger.error(`❌ Failed to process cruise ${cruiseId}:`, {
          cruiseId,
          error: errorMsg,
          stack: error instanceof Error ? error.stack : undefined,
          dataKeys: data ? Object.keys(data).slice(0, 10) : [],
          lineid: data?.lineid,
          shipid: data?.shipid,
        });
      }
    }

    logger.info('📊 Processing complete:', {
      created: result.created,
      updated: result.updated,
      failed: result.failed,
      constraintViolations: result.constraintViolations,
      skipped: result.skipped,
    });

    return result;
  }

  /**
   * Create a new cruise from webhook data with validation
   */
  private async createCruiseFromWebhookData(cruiseId: string, data: any): Promise<void> {
    try {
      logger.info(`🆕 Creating cruise ${cruiseId} with validated foreign keys`);

      // Build cruise data with proper field mapping
      const cruiseData: any = {
        id: cruiseId,
        cruiseId: data.cruiseid || cruiseId,
        cruiseLineId: data.lineid,
        shipId: data.shipid,
        name: data.name || 'Unknown Cruise',
        sailingDate: new Date(data.saildate),
        nights: parseInt(data.nights) || 0,
        embarkationPortId: data.startportid || null, // Allow null for missing ports
        disembarkationPortId: data.endportid || null, // Allow null for missing ports
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add optional fields
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

      // Process pricing data
      await this.updatePricingFromCachedData(cruiseId, data);

      logger.info(`✅ Created new cruise ${cruiseId} successfully`);
    } catch (error) {
      logger.error(`Failed to create cruise ${cruiseId}:`, error);
      throw error;
    }
  }

  /**
   * Update cruise data with validation
   */
  private async updateAllCruiseData(cruiseId: string, data: any): Promise<void> {
    try {
      logger.debug(`📝 Updating cruise ${cruiseId} with validated data`);

      const updateData: any = {
        updatedAt: new Date(),
      };

      // Map fields with null-safe port IDs
      if (data.name) updateData.name = data.name;
      if (data.nights !== undefined) updateData.nights = parseInt(data.nights) || null;
      if (data.startportid !== undefined) {
        updateData.embarkationPortId = data.startportid || null;
      }
      if (data.endportid !== undefined) {
        updateData.disembarkationPortId = data.endportid || null;
      }

      // Handle other fields
      if (data.regionids) {
        if (Array.isArray(data.regionids)) {
          updateData.regionIds = data.regionids.join(',');
        } else {
          updateData.regionIds = data.regionids;
        }
      }

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
        await db
          .update(cruises)
          .set(updateData)
          .where(eq(cruises.id, cruiseId));

        logger.debug(`✅ Updated cruise ${cruiseId} successfully`);
      }

      // Update pricing
      await this.updatePricingFromCachedData(cruiseId, data);

      // Update raw_data if itinerary present
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

    } catch (error) {
      logger.error(`Failed to update cruise data for ${cruiseId}:`, error);
      throw error;
    }
  }

  /**
   * Update pricing data with cheapest extraction
   */
  private async updatePricingFromCachedData(cruiseId: string, data: any): Promise<void> {
    try {
      // Extract and update cheapest pricing
      await this.extractAndUpdateCheapestPricing(cruiseId, data);

      // Update detailed pricing if available
      if (data.prices && typeof data.prices === 'object') {
        // Delete existing pricing
        await db.execute(sql`DELETE FROM pricing WHERE cruise_id = ${cruiseId}`);

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
      // Don't throw - allow cruise update to succeed even if pricing fails
    }
  }

  /**
   * Extract and update cheapest pricing
   */
  private async extractAndUpdateCheapestPricing(cruiseId: string, data: any): Promise<void> {
    try {
      if (data.cheapest && data.cheapest.combined) {
        const combined = data.cheapest.combined;

        const prices = [
          combined.inside,
          combined.outside,
          combined.balcony,
          combined.suite
        ].filter(p => p && p > 0);

        const cheapestPrice = prices.length > 0 ? Math.min(...prices) : null;

        if (cheapestPrice) {
          let cheapestCabinType = 'inside';
          if (cheapestPrice === combined.inside) cheapestCabinType = 'inside';
          else if (cheapestPrice === combined.outside) cheapestCabinType = 'oceanview';
          else if (cheapestPrice === combined.balcony) cheapestCabinType = 'balcony';
          else if (cheapestPrice === combined.suite) cheapestCabinType = 'suite';

          // Delete and insert new cheapest pricing
          await db.execute(sql`DELETE FROM cheapest_pricing WHERE cruise_id = ${cruiseId}`);

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

          // Also update cruise record
          await db.execute(sql`
            UPDATE cruises
            SET
              cheapest_price = ${cheapestPrice},
              has_pricing = true,
              pricing_updated_at = NOW()
            WHERE id = ${cruiseId}
          `);

          logger.debug(`✅ Updated cheapest pricing for cruise ${cruiseId}: $${cheapestPrice}`);
        }
      }
    } catch (error) {
      logger.error(`Failed to extract cheapest pricing for cruise ${cruiseId}:`, error);
    }
  }

  private parseDecimal(value: any): number | null {
    if (value === null || value === undefined) return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  private calculateTotalPrice(pricing: any): number | null {
    const base = this.parseDecimal(pricing.price);
    const adult = this.parseDecimal(pricing.adultprice);
    return base || adult || null;
  }
}

// Export singleton instance
export const enhancedWebhookServiceFixed = new EnhancedWebhookServiceFixed();
