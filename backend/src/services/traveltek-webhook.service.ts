import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import logger from '../config/logger';
import { traveltekFTPService } from './traveltek-ftp.service';

/**
 * Traveltek Webhook Service
 * Handles static pricing webhook notifications (cruiseline_pricing_updated)
 * Creates price snapshots before updating data
 * Note: We only use static pricing webhooks, not live pricing webhooks
 */
export class TraveltekWebhookService {
  
  /**
   * Handle static pricing update webhook
   * Event type: cruiseline_pricing_updated
   */
  async handleStaticPricingUpdate(payload: any): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Log webhook event
      const eventResult = await db.execute(sql`
        INSERT INTO webhook_events (
          event_type, line_id, market_id, currency,
          description, source, timestamp
        ) VALUES (
          'cruiseline_pricing_updated',
          ${payload.lineid},
          ${payload.marketid},
          ${payload.currency},
          ${payload.description},
          ${payload.source || 'json_cruise_export'},
          ${payload.timestamp}
        )
        RETURNING id
      `);
      
      const webhookEventId = eventResult.rows[0].id;
      
      logger.info(`Received static pricing update for line ${payload.lineid}`);
      
      // Get all cruises for this line that need updating
      const cruises = await db.execute(sql`
        SELECT id, ship_id
        FROM cruises
        WHERE cruise_line_id = ${payload.lineid}
          AND sailing_date >= CURRENT_DATE
          AND is_active = true
      `);
      
      logger.info(`Found ${cruises.rows.length} cruises to update for line ${payload.lineid}`);
      
      // Process each cruise
      for (const cruise of cruises.rows) {
        try {
          // Create price snapshot before update
          await this.createPriceSnapshot(cruise.id, webhookEventId, 'before_update');
          
          // Build FTP path
          const currentDate = new Date();
          const year = currentDate.getFullYear();
          const month = String(currentDate.getMonth() + 1).padStart(2, '0');
          const filePath = `${year}/${month}/${payload.lineid}/${cruise.ship_id}/${cruise.id}.json`;
          
          // Download and process the updated file
          const cruiseData = await traveltekFTPService.getCruiseDataFile(filePath);
          
          if (cruiseData) {
            // Process the updated pricing data
            await this.updateCruisePricing(cruise.id, cruiseData);
            
            // Create price snapshot after update
            await this.createPriceSnapshot(cruise.id, webhookEventId, 'after_update');
          }
          
        } catch (error) {
          logger.error(`Error updating cruise ${cruise.id}:`, error);
        }
      }
      
      // Mark webhook as processed
      await db.execute(sql`
        UPDATE webhook_events
        SET processed = true, processed_at = CURRENT_TIMESTAMP
        WHERE id = ${webhookEventId}
      `);
      
      logger.info(`Static pricing update completed in ${Date.now() - startTime}ms`);
      
    } catch (error) {
      logger.error('Error handling static pricing update:', error);
      throw error;
    }
  }
  
  /**
   * Handle live pricing update webhook
   * Event type: cruises_live_pricing_updated
   * NOTE: This is not currently used - we only process static pricing webhooks
   * Kept for future reference if needed
   */
  async handleLivePricingUpdate(payload: any): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Log webhook event
      const eventResult = await db.execute(sql`
        INSERT INTO webhook_events (
          event_type, paths, currency,
          description, source, timestamp
        ) VALUES (
          'cruises_live_pricing_updated',
          ${payload.paths},
          ${payload.currency},
          ${payload.description},
          ${payload.source || 'json_cruise_export'},
          ${payload.timestamp}
        )
        RETURNING id
      `);
      
      const webhookEventId = eventResult.rows[0].id;
      
      logger.info(`Received live pricing update for ${payload.paths?.length || 0} cruises`);
      
      // Process each cruise file path
      if (payload.paths && Array.isArray(payload.paths)) {
        for (const filePath of payload.paths) {
          try {
            // Extract cruise ID from path
            // Format: year/month/lineid/shipid/codetocruiseid.json
            const pathParts = filePath.split('/');
            const codeToId = parseInt(pathParts[4]?.replace('.json', ''));
            
            if (!codeToId) {
              logger.warn(`Invalid file path format: ${filePath}`);
              continue;
            }
            
            // Find cruise by id (which now stores the code_to_cruise_id value)
            const cruiseResult = await db.execute(sql`
              SELECT id FROM cruises
              WHERE id = ${codeToId}
              LIMIT 1
            `);
            
            if (cruiseResult.rows.length === 0) {
              logger.warn(`Cruise not found for id: ${codeToId}`);
              continue;
            }
            
            const cruiseId = cruiseResult.rows[0].id;
            
            // Create price snapshot before update
            await this.createPriceSnapshot(cruiseId, webhookEventId, 'before_update');
            
            // Download and process the updated file
            const cruiseData = await traveltekFTPService.getCruiseDataFile(filePath);
            
            if (cruiseData) {
              // Process the updated cached pricing
              await this.updateCachedPricing(cruiseId, cruiseData);
              
              // Create price snapshot after update
              await this.createPriceSnapshot(cruiseId, webhookEventId, 'after_update');
            }
            
          } catch (error) {
            logger.error(`Error processing file ${filePath}:`, error);
          }
        }
      }
      
      // Mark webhook as processed
      await db.execute(sql`
        UPDATE webhook_events
        SET processed = true, processed_at = CURRENT_TIMESTAMP
        WHERE id = ${webhookEventId}
      `);
      
      logger.info(`Live pricing update completed in ${Date.now() - startTime}ms`);
      
    } catch (error) {
      logger.error('Error handling live pricing update:', error);
      throw error;
    }
  }
  
  /**
   * Create a price snapshot for audit trail
   */
  private async createPriceSnapshot(
    cruiseId: number,
    webhookEventId: number,
    snapshotType: 'before_update' | 'after_update'
  ): Promise<void> {
    try {
      // Get current cheapest prices
      const cheapestResult = await db.execute(sql`
        SELECT 
          cheapest_price,
          combined_inside as inside_price,
          combined_outside as outside_price,
          combined_balcony as balcony_price,
          combined_suite as suite_price
        FROM cheapest_prices
        WHERE cruise_id = ${cruiseId}
      `);
      
      const cheapest = cheapestResult.rows[0] || {};
      
      // Get static prices summary
      const staticPrices = await db.execute(sql`
        SELECT 
          rate_code,
          cabin_id,
          cabin_type,
          price,
          taxes,
          ncf,
          gratuity
        FROM static_prices
        WHERE cruise_id = ${cruiseId}
      `);
      
      // Get cached prices summary
      const cachedPrices = await db.execute(sql`
        SELECT 
          rate_code,
          cabin_id,
          cabin_code,
          price,
          taxes,
          ncf,
          adults,
          children,
          cached_at
        FROM cached_prices
        WHERE cruise_id = ${cruiseId}
      `);
      
      // Create snapshot
      await db.execute(sql`
        INSERT INTO price_snapshots (
          cruise_id,
          snapshot_type,
          webhook_event_id,
          cheapest_price,
          inside_price,
          outside_price,
          balcony_price,
          suite_price,
          static_prices_data,
          cached_prices_data,
          cheapest_data
        ) VALUES (
          ${cruiseId},
          ${snapshotType},
          ${webhookEventId},
          ${cheapest.cheapest_price},
          ${cheapest.inside_price},
          ${cheapest.outside_price},
          ${cheapest.balcony_price},
          ${cheapest.suite_price},
          ${JSON.stringify(staticPrices.rows)}::jsonb,
          ${JSON.stringify(cachedPrices.rows)}::jsonb,
          ${JSON.stringify(cheapest)}::jsonb
        )
      `);
      
      logger.debug(`Created ${snapshotType} snapshot for cruise ${cruiseId}`);
      
    } catch (error) {
      logger.error(`Error creating price snapshot for cruise ${cruiseId}:`, error);
    }
  }
  
  /**
   * Update cruise static pricing
   */
  private async updateCruisePricing(cruiseId: number, data: any): Promise<void> {
    // Delete existing static prices
    await db.execute(sql`
      DELETE FROM static_prices WHERE cruise_id = ${cruiseId}
    `);
    
    // Insert new static prices
    if (data.prices && typeof data.prices === 'object') {
      for (const [rateCode, cabins] of Object.entries(data.prices)) {
        if (typeof cabins !== 'object') continue;
        
        for (const [cabinId, pricing] of Object.entries(cabins as any)) {
          if (typeof pricing !== 'object') continue;
          
          const pricingData = pricing as any;
          
          await db.execute(sql`
            INSERT INTO static_prices (
              cruise_id, rate_code, cabin_id, cabin_type,
              price, adult_price, child_price, infant_price,
              third_adult_price, fourth_adult_price, fifth_adult_price, single_price,
              taxes, ncf, gratuity, fuel, noncomm
            ) VALUES (
              ${cruiseId},
              ${rateCode},
              ${cabinId},
              ${pricingData.cabintype || null},
              ${this.parseDecimal(pricingData.price)},
              ${this.parseDecimal(pricingData.adultprice)},
              ${this.parseDecimal(pricingData.childprice)},
              ${this.parseDecimal(pricingData.infantprice)},
              ${this.parseDecimal(pricingData.thirdadultprice)},
              ${this.parseDecimal(pricingData.fourthadultprice)},
              ${this.parseDecimal(pricingData.fifthadultprice)},
              ${this.parseDecimal(pricingData.singleprice)},
              ${this.parseDecimal(pricingData.taxes)},
              ${this.parseDecimal(pricingData.ncf)},
              ${this.parseDecimal(pricingData.gratuity)},
              ${this.parseDecimal(pricingData.fuel)},
              ${this.parseDecimal(pricingData.noncomm)}
            )
          `);
        }
      }
    }
    
    // Update cheapest prices
    await this.updateCheapestPrices(cruiseId, data);
  }
  
  /**
   * Update cached pricing
   */
  private async updateCachedPricing(cruiseId: number, data: any): Promise<void> {
    // Delete existing cached prices
    await db.execute(sql`
      DELETE FROM cached_prices WHERE cruise_id = ${cruiseId}
    `);
    
    // Insert new cached prices
    if (data.cachedprices && typeof data.cachedprices === 'object') {
      for (const [rateCode, cabinArray] of Object.entries(data.cachedprices)) {
        if (!Array.isArray(cabinArray)) continue;
        
        for (const cabin of cabinArray) {
          await db.execute(sql`
            INSERT INTO cached_prices (
              cruise_id, rate_code, cabin_id, cabin_code,
              price, taxes, ncf, fees,
              adults, children, infants,
              currency, fare_type, onboard_credit, obc_currency,
              cached_at
            ) VALUES (
              ${cruiseId},
              ${rateCode},
              ${cabin.cabinid || null},
              ${cabin.cabincode || null},
              ${this.parseDecimal(cabin.price)},
              ${this.parseDecimal(cabin.taxes)},
              ${this.parseDecimal(cabin.ncf)},
              ${this.parseDecimal(cabin.fees)},
              ${this.parseInteger(cabin.adults)},
              ${this.parseInteger(cabin.children)},
              ${this.parseInteger(cabin.infants)},
              ${cabin.currency || 'USD'},
              ${cabin.faretype || null},
              ${this.parseDecimal(cabin.onboardcredit)},
              ${cabin.obccurrency || null},
              ${cabin.cachedat || null}
            )
          `);
        }
      }
    }
    
    // Update cheapest prices
    await this.updateCheapestPrices(cruiseId, data);
  }
  
  /**
   * Update cheapest prices table
   */
  private async updateCheapestPrices(cruiseId: number, data: any): Promise<void> {
    const cheapest = data.cheapest || {};
    const staticPrices = cheapest.prices || {};
    const cachedPrices = cheapest.cachedprices || {};
    const combined = cheapest.combined || {};
    
    await db.execute(sql`
      INSERT INTO cheapest_prices (
        cruise_id,
        static_inside, static_inside_code,
        static_outside, static_outside_code,
        static_balcony, static_balcony_code,
        static_suite, static_suite_code,
        cached_inside, cached_inside_code,
        cached_outside, cached_outside_code,
        cached_balcony, cached_balcony_code,
        cached_suite, cached_suite_code,
        combined_inside, combined_inside_code, combined_inside_source,
        combined_outside, combined_outside_code, combined_outside_source,
        combined_balcony, combined_balcony_code, combined_balcony_source,
        combined_suite, combined_suite_code, combined_suite_source,
        cheapest_price, cheapest_cabin_type
      ) VALUES (
        ${cruiseId},
        ${this.parseDecimal(staticPrices.inside)},
        ${staticPrices.insidepricecode || null},
        ${this.parseDecimal(staticPrices.outside)},
        ${staticPrices.outsidepricecode || null},
        ${this.parseDecimal(staticPrices.balcony)},
        ${staticPrices.balconypricecode || null},
        ${this.parseDecimal(staticPrices.suite)},
        ${staticPrices.suitepricecode || null},
        ${this.parseDecimal(cachedPrices.inside)},
        ${cachedPrices.insidepricecode || null},
        ${this.parseDecimal(cachedPrices.outside)},
        ${cachedPrices.outsidepricecode || null},
        ${this.parseDecimal(cachedPrices.balcony)},
        ${cachedPrices.balconypricecode || null},
        ${this.parseDecimal(cachedPrices.suite)},
        ${cachedPrices.suitepricecode || null},
        ${this.parseDecimal(combined.inside)},
        ${combined.insidepricecode || null},
        ${combined.insidesource || null},
        ${this.parseDecimal(combined.outside)},
        ${combined.outsidepricecode || null},
        ${combined.outsidesource || null},
        ${this.parseDecimal(combined.balcony)},
        ${combined.balconypricecode || null},
        ${combined.balconysource || null},
        ${this.parseDecimal(combined.suite)},
        ${combined.suitepricecode || null},
        ${combined.suitesource || null},
        ${this.parseDecimal(data.cheapestprice)},
        ${this.determineCabinType(data)}
      )
      ON CONFLICT (cruise_id) DO UPDATE SET
        static_inside = EXCLUDED.static_inside,
        static_inside_code = EXCLUDED.static_inside_code,
        static_outside = EXCLUDED.static_outside,
        static_outside_code = EXCLUDED.static_outside_code,
        static_balcony = EXCLUDED.static_balcony,
        static_balcony_code = EXCLUDED.static_balcony_code,
        static_suite = EXCLUDED.static_suite,
        static_suite_code = EXCLUDED.static_suite_code,
        cached_inside = EXCLUDED.cached_inside,
        cached_inside_code = EXCLUDED.cached_inside_code,
        cached_outside = EXCLUDED.cached_outside,
        cached_outside_code = EXCLUDED.cached_outside_code,
        cached_balcony = EXCLUDED.cached_balcony,
        cached_balcony_code = EXCLUDED.cached_balcony_code,
        cached_suite = EXCLUDED.cached_suite,
        cached_suite_code = EXCLUDED.cached_suite_code,
        combined_inside = EXCLUDED.combined_inside,
        combined_inside_code = EXCLUDED.combined_inside_code,
        combined_inside_source = EXCLUDED.combined_inside_source,
        combined_outside = EXCLUDED.combined_outside,
        combined_outside_code = EXCLUDED.combined_outside_code,
        combined_outside_source = EXCLUDED.combined_outside_source,
        combined_balcony = EXCLUDED.combined_balcony,
        combined_balcony_code = EXCLUDED.combined_balcony_code,
        combined_balcony_source = EXCLUDED.combined_balcony_source,
        combined_suite = EXCLUDED.combined_suite,
        combined_suite_code = EXCLUDED.combined_suite_code,
        combined_suite_source = EXCLUDED.combined_suite_source,
        cheapest_price = EXCLUDED.cheapest_price,
        cheapest_cabin_type = EXCLUDED.cheapest_cabin_type,
        last_updated = CURRENT_TIMESTAMP
    `);
  }
  
  /**
   * Helper: Parse decimal value
   */
  private parseDecimal(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }
  
  /**
   * Helper: Parse integer value
   */
  private parseInteger(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = parseInt(value);
    return isNaN(num) ? null : num;
  }
  
  /**
   * Helper: Determine cabin type from cheapest prices
   */
  private determineCabinType(data: any): string {
    if (data.cheapestinside) return 'inside';
    if (data.cheapestoutside) return 'outside';
    if (data.cheapestbalcony) return 'balcony';
    if (data.cheapestsuite) return 'suite';
    return 'unknown';
  }
  
  /**
   * Get price change analytics
   */
  async getPriceChanges(cruiseId: number, days: number = 30): Promise<any> {
    const result = await db.execute(sql`
      SELECT 
        ps1.created_at as date,
        ps1.cheapest_price as price_before,
        ps2.cheapest_price as price_after,
        ps2.cheapest_price - ps1.cheapest_price as price_change,
        ROUND(((ps2.cheapest_price - ps1.cheapest_price) / ps1.cheapest_price * 100), 2) as percent_change
      FROM price_snapshots ps1
      JOIN price_snapshots ps2 ON ps1.webhook_event_id = ps2.webhook_event_id
      WHERE ps1.cruise_id = ${cruiseId}
        AND ps1.snapshot_type = 'before_update'
        AND ps2.snapshot_type = 'after_update'
        AND ps1.created_at >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY ps1.created_at DESC
    `);
    
    return result.rows;
  }
}

export const traveltekWebhookService = new TraveltekWebhookService();