import { db } from '../db/connection';
import { sql, eq, inArray } from 'drizzle-orm';
import logger from '../config/logger';
import { traveltekFTPService } from './traveltek-ftp.service';
import { slackService } from './slack.service';
import { cruiseCreationService } from './cruise-creation.service';
import { cruiseUpdateQueue } from '../queues/webhook-queue';
import { cruises, priceHistory } from '../db/schema';
import { randomUUID } from 'crypto';

export interface WebhookProcessingResult {
  successful: number;
  failed: number;
  errors: Array<{
    cruiseId?: number;
    filePath?: string;
    error: string;
  }>;
  startTime: Date;
  endTime: Date;
  processingTimeMs: number;
  totalCruises: number;
  priceSnapshotsCreated: number;
}

export interface WebhookPayload {
  event: string;
  lineid: number;
  marketid: number;
  currency: string;
  description?: string;
  source?: string;
  timestamp: number | string;
  cruiseIds?: number[];
  paths?: string[];
}

/**
 * Enhanced Traveltek Webhook Service
 * Handles webhook notifications with:
 * - Batch processing for large updates (1000+ cruises)
 * - Price snapshots before/after updates
 * - Comprehensive error handling and recovery
 * - Enhanced Slack notifications
 * - Performance monitoring
 */
export class TraveltekWebhookService {
  private readonly BATCH_SIZE = 50; // Process cruises in batches to avoid DB connection issues
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;
  
  /**
   * Handle static pricing update webhook
   * Event type: cruiseline_pricing_updated
   */
  async handleStaticPricingUpdate(payload: WebhookPayload): Promise<WebhookProcessingResult> {
    const startTime = new Date();
    const batchId = randomUUID();
    
    logger.info(`🚀 Starting static pricing update for cruise line ${payload.lineid}`, {
      event: payload.event,
      lineId: payload.lineid,
      batchId
    });

    // Send Slack notification - processing started
    await slackService.notifyWebhookProcessingStarted({
      eventType: payload.event,
      lineId: payload.lineid,
      timestamp: new Date().toISOString()
    });

    let result: WebhookProcessingResult = {
      successful: 0,
      failed: 0,
      errors: [],
      startTime,
      endTime: new Date(),
      processingTimeMs: 0,
      totalCruises: 0,
      priceSnapshotsCreated: 0
    };

    try {
      // Log webhook event to database
      const eventResult = await db.execute(sql`
        INSERT INTO webhook_events (
          event_type, line_id, market_id, currency,
          description, source, timestamp, batch_id, payload
        ) VALUES (
          'cruiseline_pricing_updated',
          ${payload.lineid},
          ${payload.marketid || 0},
          ${payload.currency || 'USD'},
          ${payload.description || `Cruise line ${payload.lineid} pricing updated`},
          ${payload.source || 'traveltek_webhook'},
          ${typeof payload.timestamp === 'string' ? payload.timestamp : new Date(payload.timestamp * 1000).toISOString()},
          ${batchId},
          ${JSON.stringify(payload)}
        )
        RETURNING id
      `);
      
      const webhookEventId = eventResult[0]?.id || 0;
      
      // Get all cruises for this line that need updating
      const cruisesToUpdate = await db
        .select({
          id: cruises.id,
          shipId: cruises.shipId,
          name: cruises.name,
          sailingDate: cruises.sailingDate
        })
        .from(cruises)
        .where(
          sql`cruise_line_id = ${payload.lineid} 
              AND sailing_date >= CURRENT_DATE 
              AND sailing_date <= CURRENT_DATE + INTERVAL '2 years'`
        );
      
      result.totalCruises = cruisesToUpdate.length;
      
      logger.info(`📊 Found ${result.totalCruises} cruises to update for line ${payload.lineid}`);
      
      if (result.totalCruises === 0) {
        logger.warn(`⚠️ No active cruises found for line ${payload.lineid}`);
        result.endTime = new Date();
        result.processingTimeMs = result.endTime.getTime() - result.startTime.getTime();
        
        await slackService.notifyWebhookProcessingCompleted({
          eventType: payload.event,
          lineId: payload.lineid
        }, result);
        
        return result;
      }

      // Process cruises in batches to avoid overwhelming the database
      for (let i = 0; i < cruisesToUpdate.length; i += this.BATCH_SIZE) {
        const batch = cruisesToUpdate.slice(i, i + this.BATCH_SIZE);
        const batchNumber = Math.floor(i / this.BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(cruisesToUpdate.length / this.BATCH_SIZE);
        
        logger.info(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} cruises)`);
        
        const batchResults = await Promise.allSettled(
          batch.map(cruise => this.processCruiseUpdate({
            cruiseId: cruise.id,
            cruiseCode: cruise.cruiseCode,
            filePath: cruise.filePath || '',
            webhookEventId,
            batchId,
            lineId: payload.lineid.toString()
          }))
        );
        
        // Aggregate batch results
        batchResults.forEach((batchResult, index) => {
          if (batchResult.status === 'fulfilled') {
            result.successful++;
            result.priceSnapshotsCreated += batchResult.value.snapshotsCreated;
          } else {
            result.failed++;
            result.errors.push({
              cruiseId: batch[index].id,
              error: batchResult.reason?.message || 'Unknown error'
            });
            logger.error(`❌ Failed to process cruise ${batch[index].id}:`, batchResult.reason);
          }
        });
        
        // Brief pause between batches to prevent overwhelming the system
        if (i + this.BATCH_SIZE < cruisesToUpdate.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Mark webhook as processed
      await db.execute(sql`
        UPDATE webhook_events
        SET processed = true, processed_at = CURRENT_TIMESTAMP,
            successful_count = ${result.successful},
            failed_count = ${result.failed},
            processing_time_ms = ${result.processingTimeMs}
        WHERE id = ${webhookEventId}
      `);
      
    } catch (error) {
      logger.error('❌ Fatal error in static pricing update:', error);
      result.errors.push({
        error: `Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      // Notify Slack of critical error
      await slackService.notifySyncError(
        error instanceof Error ? error.message : 'Unknown error',
        `Static pricing update for line ${payload.lineid}`
      );
      
      throw error;
    } finally {
      result.endTime = new Date();
      result.processingTimeMs = result.endTime.getTime() - result.startTime.getTime();
      
      logger.info(`✅ Static pricing update completed`, {
        successful: result.successful,
        failed: result.failed,
        totalCruises: result.totalCruises,
        processingTimeMs: result.processingTimeMs,
        priceSnapshotsCreated: result.priceSnapshotsCreated
      });
      
      // Send comprehensive Slack notification
      await slackService.notifyWebhookProcessingCompleted({
        eventType: payload.event,
        lineId: payload.lineid
      }, result);
    }
    
    return result;
  }
  
  /**
   * Process a single cruise update with retry logic (internal)
   */
  private async processCruiseUpdateInternal(
    cruise: { id: number; shipId: number; name: string; sailingDate: string },
    payload: WebhookPayload,
    webhookEventId: number,
    batchId: string
  ): Promise<{ snapshotsCreated: number }> {
    const maxAttempts = this.MAX_RETRIES;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.processCruiseUpdateAttempt(cruise, payload, webhookEventId, batchId);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < maxAttempts) {
          const delay = this.RETRY_DELAY_MS * attempt;
          logger.warn(`⏳ Retry ${attempt}/${maxAttempts} for cruise ${cruise.id} after ${delay}ms delay`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`Failed after ${maxAttempts} attempts: ${lastError?.message}`);
  }

  /**
   * Single attempt to process cruise update
   */
  private async processCruiseUpdateAttempt(
    cruise: { id: number; shipId: number; name: string; sailingDate: string },
    payload: WebhookPayload,
    webhookEventId: number,
    batchId: string
  ): Promise<{ snapshotsCreated: number }> {
    let snapshotsCreated = 0;
    
    try {
      // Create price snapshot before update
      await this.createPriceSnapshotEnhanced(cruise.id, webhookEventId, batchId, 'before_update');
      snapshotsCreated++;
      
      // Determine file paths to try (support different FTP structures)
      const sailingDate = new Date(cruise.sailingDate);
      const year = sailingDate.getFullYear();
      const month = String(sailingDate.getMonth() + 1).padStart(2, '0');
      
      const possiblePaths = [
        `${year}/${month}/${payload.lineid}/${cruise.shipId}/${cruise.id}.json`,
        `isell_json/${year}/${month}/${payload.lineid}/${cruise.shipId}/${cruise.id}.json`,
        `${year}/${month}/${payload.lineid}/${cruise.id}.json` // Some files might not have ship subdirectory
      ];
      
      let cruiseData = null;
      let usedPath = null;
      
      // Try different file paths
      for (const filePath of possiblePaths) {
        try {
          cruiseData = await traveltekFTPService.getCruiseDataFile(filePath);
          usedPath = filePath;
          break;
        } catch (error) {
          // Continue to next path
          continue;
        }
      }
      
      if (cruiseData) {
        // Process the updated pricing data
        await this.updateCruisePricingEnhanced(cruise.id, cruiseData);
        
        // Create price snapshot after update
        await this.createPriceSnapshotEnhanced(cruise.id, webhookEventId, batchId, 'after_update');
        snapshotsCreated++;
        
        logger.debug(`✅ Updated cruise ${cruise.id} using ${usedPath}`);
      } else {
        // If cruise doesn't exist in FTP, it might be a new cruise that needs to be created
        // Try to create it using the data from sync-complete-data.js approach
        logger.warn(`⚠️ Cruise data not found for ${cruise.id}, attempting fallback sync`);
        await this.handleMissingCruiseData(cruise, payload);
      }
      
      return { snapshotsCreated };
      
    } catch (error) {
      logger.error(`❌ Error processing cruise ${cruise.id} (${cruise.name}):`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        cruiseId: cruise.id,
        shipId: cruise.shipId
      });
      throw error;
    }
  }

  /**
   * Handle missing cruise data by attempting to sync from FTP
   */
  private async handleMissingCruiseData(
    cruise: { id: number; shipId: number; name: string; sailingDate: string },
    payload: WebhookPayload
  ): Promise<void> {
    logger.warn(`📝 Cruise ${cruise.id} not found in FTP, attempting auto-creation`, {
      cruiseId: cruise.id,
      shipId: cruise.shipId,
      lineId: payload.lineid,
      sailingDate: cruise.sailingDate
    });
    
    // Attempt to auto-create the cruise
    const newCruiseId = await cruiseCreationService.createCruiseFromWebhook(
      cruise.id.toString(),
      payload.lineid.toString(),
      undefined // No specific file path, will attempt discovery
    );
    
    if (newCruiseId) {
      logger.info(`✅ Successfully auto-created cruise ${cruise.id}`, {
        cruiseId: cruise.id,
        newDatabaseId: newCruiseId,
        lineId: payload.lineid
      });
      
      // Notify via Slack about auto-creation
      await slackService.notifyCustomMessage({
        title: '🆕 Cruise Auto-Created',
        message: `Cruise ${cruise.id} was not found and has been auto-created`,
        details: {
          cruiseId: cruise.id,
          lineId: payload.lineid,
          sailingDate: cruise.sailingDate,
          shipId: cruise.shipId
        }
      });
    } else {
      logger.error(`❌ Failed to auto-create cruise ${cruise.id}`, {
        cruiseId: cruise.id,
        lineId: payload.lineid
      });
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
          event_type, payload, currency,
          description, source, timestamp
        ) VALUES (
          'cruises_live_pricing_updated',
          ${JSON.stringify(payload)},
          ${payload.currency || 'USD'},
          ${payload.description || 'Live pricing update'},
          ${payload.source || 'json_cruise_export'},
          ${typeof payload.timestamp === 'string' ? payload.timestamp : new Date().toISOString()}
        )
        RETURNING id
      `);
      
      const webhookEventId = eventResult[0]?.id || 0;
      
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
            await this.createPriceSnapshotEnhanced(cruiseId, webhookEventId, '', 'before_update');
            
            // Download and process the updated file
            const cruiseData = await traveltekFTPService.getCruiseDataFile(filePath);
            
            if (cruiseData) {
              // Process the updated cached pricing
              await this.updateCachedPricing(cruiseId, cruiseData);
              
              // Create price snapshot after update
              await this.createPriceSnapshotEnhanced(cruiseId, webhookEventId, '', 'after_update');
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
   * Create enhanced price snapshot for audit trail using the new price_history schema
   */
  private async createPriceSnapshotEnhanced(
    cruiseId: number,
    webhookEventId: number,
    batchId: string,
    snapshotType: 'before_update' | 'after_update'
  ): Promise<void> {
    try {
      // Get current pricing data from the pricing table
      const currentPricing = await db.execute(sql`
        SELECT 
          rate_code,
          cabin_code,
          occupancy_code,
          cabin_type,
          base_price,
          adult_price,
          child_price,
          infant_price,
          single_price,
          third_adult_price,
          fourth_adult_price,
          taxes,
          ncf,
          gratuity,
          fuel,
          non_comm,
          port_charges,
          government_fees,
          total_price,
          commission,
          is_available,
          inventory,
          waitlist,
          guarantee,
          currency
        FROM pricing
        WHERE cruise_id = ${cruiseId}
        ORDER BY rate_code, cabin_code, occupancy_code
      `);
      
      // Create price history records for each pricing entry
      for (const pricing of currentPricing.rows) {
        await db.execute(sql`
          INSERT INTO price_history (
            cruise_id,
            rate_code,
            cabin_code,
            occupancy_code,
            cabin_type,
            base_price,
            adult_price,
            child_price,
            infant_price,
            single_price,
            third_adult_price,
            fourth_adult_price,
            taxes,
            ncf,
            gratuity,
            fuel,
            non_comm,
            port_charges,
            government_fees,
            total_price,
            commission,
            is_available,
            inventory,
            waitlist,
            guarantee,
            price_type,
            currency,
            change_type,
            change_reason,
            batch_id,
            snapshot_date
          ) VALUES (
            ${cruiseId},
            ${pricing.rate_code},
            ${pricing.cabin_code},
            ${pricing.occupancy_code},
            ${pricing.cabin_type},
            ${pricing.base_price},
            ${pricing.adult_price},
            ${pricing.child_price},
            ${pricing.infant_price},
            ${pricing.single_price},
            ${pricing.third_adult_price},
            ${pricing.fourth_adult_price},
            ${pricing.taxes},
            ${pricing.ncf},
            ${pricing.gratuity},
            ${pricing.fuel},
            ${pricing.non_comm},
            ${pricing.port_charges},
            ${pricing.government_fees},
            ${pricing.total_price},
            ${pricing.commission},
            ${pricing.is_available},
            ${pricing.inventory},
            ${pricing.waitlist},
            ${pricing.guarantee},
            'static',
            ${pricing.currency || 'USD'},
            'snapshot',
            ${'webhook_' + snapshotType},
            ${batchId},
            CURRENT_TIMESTAMP
          )
        `);
      }
      
      logger.debug(`✅ Created ${snapshotType} price history snapshots for cruise ${cruiseId} (${currentPricing.rows.length} records)`);
      
    } catch (error) {
      logger.error(`❌ Error creating price snapshot for cruise ${cruiseId}:`, error);
      // Don't throw - snapshots are important but shouldn't fail the entire update
    }
  }
  
  /**
   * Update cruise static pricing with enhanced processing
   */
  private async updateCruisePricingEnhanced(cruiseId: number, data: any): Promise<void> {
    try {
      // Delete existing pricing records
      await db.execute(sql`DELETE FROM pricing WHERE cruise_id = ${cruiseId}`);
      
      let totalPricingRecords = 0;
      
      // Process static pricing data
      if (data.prices && typeof data.prices === 'object') {
        const pricingRecords = [];
        
        for (const [rateCode, cabins] of Object.entries(data.prices)) {
          if (typeof cabins !== 'object') continue;
          
          for (const [cabinCode, occupancies] of Object.entries(cabins as any)) {
            if (typeof occupancies !== 'object') continue;
            
            for (const [occupancyCode, pricingData] of Object.entries(occupancies as any)) {
              if (typeof pricingData !== 'object') continue;
              
              const pricing = pricingData as any;
              
              // Skip if no valid price
              if (!pricing.price && !pricing.adultprice) continue;
              
              const totalPrice = this.calculateTotalPrice(pricing);
              
              pricingRecords.push({
                cruise_id: cruiseId,
                rate_code: this.truncateString(rateCode, 50),
                cabin_code: this.truncateString(cabinCode, 10),
                occupancy_code: this.truncateString(occupancyCode, 10),
                cabin_type: pricing.cabintype || null,
                base_price: this.parseDecimal(pricing.price),
                adult_price: this.parseDecimal(pricing.adultprice),
                child_price: this.parseDecimal(pricing.childprice),
                infant_price: this.parseDecimal(pricing.infantprice),
                single_price: this.parseDecimal(pricing.singleprice),
                third_adult_price: this.parseDecimal(pricing.thirdadultprice),
                fourth_adult_price: this.parseDecimal(pricing.fourthadultprice),
                taxes: this.parseDecimal(pricing.taxes) || 0,
                ncf: this.parseDecimal(pricing.ncf) || 0,
                gratuity: this.parseDecimal(pricing.gratuity) || 0,
                fuel: this.parseDecimal(pricing.fuel) || 0,
                non_comm: this.parseDecimal(pricing.noncomm) || 0,
                port_charges: this.parseDecimal(pricing.portcharges) || 0,
                government_fees: this.parseDecimal(pricing.governmentfees) || 0,
                total_price: totalPrice,
                commission: this.parseDecimal(pricing.commission),
                is_available: pricing.available !== false,
                inventory: this.parseInteger(pricing.inventory),
                waitlist: pricing.waitlist === true,
                guarantee: pricing.guarantee === true,
                currency: data.currency || 'USD'
              });
            }
          }
        }
        
        // Batch insert pricing records
        if (pricingRecords.length > 0) {
          // Use raw SQL insert since drizzle's sql helper with object array might have issues
          for (const record of pricingRecords) {
            await db.execute(sql`
              INSERT INTO pricing (
                cruise_id, rate_code, cabin_code, occupancy_code, cabin_type,
                base_price, adult_price, child_price, infant_price, single_price,
                third_adult_price, fourth_adult_price, taxes, ncf, gratuity,
                fuel, non_comm, port_charges, government_fees, total_price,
                commission, is_available, inventory, waitlist, guarantee, currency
              ) VALUES (
                ${record.cruise_id}, ${record.rate_code}, ${record.cabin_code}, 
                ${record.occupancy_code}, ${record.cabin_type}, ${record.base_price},
                ${record.adult_price}, ${record.child_price}, ${record.infant_price},
                ${record.single_price}, ${record.third_adult_price}, ${record.fourth_adult_price},
                ${record.taxes}, ${record.ncf}, ${record.gratuity}, ${record.fuel},
                ${record.non_comm}, ${record.port_charges}, ${record.government_fees},
                ${record.total_price}, ${record.commission}, ${record.is_available},
                ${record.inventory}, ${record.waitlist}, ${record.guarantee}, ${record.currency}
              )
              ON CONFLICT (cruise_id, rate_code, cabin_code, occupancy_code) 
              DO UPDATE SET
                cabin_type = EXCLUDED.cabin_type,
                base_price = EXCLUDED.base_price,
                adult_price = EXCLUDED.adult_price,
                child_price = EXCLUDED.child_price,
                infant_price = EXCLUDED.infant_price,
                single_price = EXCLUDED.single_price,
                third_adult_price = EXCLUDED.third_adult_price,
                fourth_adult_price = EXCLUDED.fourth_adult_price,
                taxes = EXCLUDED.taxes,
                ncf = EXCLUDED.ncf,
                gratuity = EXCLUDED.gratuity,
                fuel = EXCLUDED.fuel,
                non_comm = EXCLUDED.non_comm,
                port_charges = EXCLUDED.port_charges,
                government_fees = EXCLUDED.government_fees,
                total_price = EXCLUDED.total_price,
                commission = EXCLUDED.commission,
                is_available = EXCLUDED.is_available,
                inventory = EXCLUDED.inventory,
                waitlist = EXCLUDED.waitlist,
                guarantee = EXCLUDED.guarantee,
                currency = EXCLUDED.currency,
                updated_at = CURRENT_TIMESTAMP
            `);
          }
          
          totalPricingRecords = pricingRecords.length;
        }
      }
      
      // Also update cheapest pricing if that table exists
      await this.updateCheapestPricingEnhanced(cruiseId, data);
      
      logger.debug(`✅ Updated ${totalPricingRecords} pricing records for cruise ${cruiseId}`);
      
    } catch (error) {
      logger.error(`❌ Error updating pricing for cruise ${cruiseId}:`, error);
      throw error;
    }
  }

  /**
   * Update cheapest pricing data
   */
  private async updateCheapestPricingEnhanced(cruiseId: number, data: any): Promise<void> {
    try {
      // Check if cheapest_pricing table exists
      const tableExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'cheapest_pricing'
        )
      `);
      
      if (!tableExists[0]?.exists) {
        return; // Skip if table doesn't exist
      }
      
      // Extract cheapest prices from top-level fields
      const cheapestData = {
        cruise_id: cruiseId,
        cheapest_price: this.parseDecimal(data.cheapestprice),
        cheapest_cabin_type: data.cheapestcabintype || null,
        interior_price: this.parseDecimal(data.cheapestinside || data.cheapestinterior),
        interior_price_code: data.cheapestinsidepricecode || data.cheapestinteriorpricecode || null,
        oceanview_price: this.parseDecimal(data.cheapestoceanview || data.cheapestoutside),
        oceanview_price_code: data.cheapestoutsidepricecode || data.cheapestoceanviewpricecode || null,
        balcony_price: this.parseDecimal(data.cheapestbalcony),
        balcony_price_code: data.cheapestbalconypricecode || null,
        suite_price: this.parseDecimal(data.cheapestsuite),
        suite_price_code: data.cheapestsuitepricecode || null,
        currency: data.currency || 'USD',
      };
      
      // Only insert if we have at least one price
      if (cheapestData.cheapest_price || cheapestData.interior_price || 
          cheapestData.oceanview_price || cheapestData.balcony_price || 
          cheapestData.suite_price) {
        
        await db.execute(sql`
          INSERT INTO cheapest_pricing (
            cruise_id, cheapest_price, cheapest_cabin_type,
            interior_price, interior_price_code,
            oceanview_price, oceanview_price_code,
            balcony_price, balcony_price_code,
            suite_price, suite_price_code, currency
          ) VALUES (
            ${cheapestData.cruise_id}, ${cheapestData.cheapest_price}, 
            ${cheapestData.cheapest_cabin_type}, ${cheapestData.interior_price},
            ${cheapestData.interior_price_code}, ${cheapestData.oceanview_price},
            ${cheapestData.oceanview_price_code}, ${cheapestData.balcony_price},
            ${cheapestData.balcony_price_code}, ${cheapestData.suite_price},
            ${cheapestData.suite_price_code}, ${cheapestData.currency}
          )
          ON CONFLICT (cruise_id) 
          DO UPDATE SET
            cheapest_price = EXCLUDED.cheapest_price,
            cheapest_cabin_type = EXCLUDED.cheapest_cabin_type,
            interior_price = EXCLUDED.interior_price,
            interior_price_code = EXCLUDED.interior_price_code,
            oceanview_price = EXCLUDED.oceanview_price,
            oceanview_price_code = EXCLUDED.oceanview_price_code,
            balcony_price = EXCLUDED.balcony_price,
            balcony_price_code = EXCLUDED.balcony_price_code,
            suite_price = EXCLUDED.suite_price,
            suite_price_code = EXCLUDED.suite_price_code,
            currency = EXCLUDED.currency,
            last_updated = CURRENT_TIMESTAMP
        `);
      }
      
    } catch (error) {
      logger.error(`❌ Error updating cheapest pricing for cruise ${cruiseId}:`, error);
      // Don't throw - cheapest pricing is supplementary
    }
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
   * Helper: Truncate string to fit database constraints
   */
  private truncateString(str: string, maxLength: number): string {
    if (!str) return '';
    return str.length > maxLength ? str.substring(0, maxLength) : str;
  }

  /**
   * Helper: Calculate total price from price components
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
   * Get webhook processing statistics
   */
  async getWebhookStats(days: number = 30): Promise<any> {
    try {
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) as total_webhooks,
          COUNT(*) FILTER (WHERE processed = true) as processed_webhooks,
          COUNT(*) FILTER (WHERE processed = false) as pending_webhooks,
          AVG(processing_time_ms) as avg_processing_time,
          MAX(processing_time_ms) as max_processing_time,
          SUM(successful_count) as total_successful,
          SUM(failed_count) as total_failed
        FROM webhook_events
        WHERE created_at >= CURRENT_DATE - ${days}::integer * INTERVAL '1 day'
          AND event_type = 'cruiseline_pricing_updated'
      `);
      
      return result[0] || {};
    } catch (error) {
      logger.error('Error getting webhook stats:', error);
      return {};
    }
  }

  /**
   * Get recent webhook events
   */
  async getRecentWebhooks(limit: number = 10): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          id,
          event_type,
          line_id,
          processed,
          successful_count,
          failed_count,
          processing_time_ms,
          created_at,
          processed_at,
          description
        FROM webhook_events
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);
      
      return result || [];
    } catch (error) {
      logger.error('Error getting recent webhooks:', error);
      return [];
    }
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

  /**
   * Process individual cruise update for queue processing
   * This method is called by the queue worker for parallel processing
   */
  public async processCruiseUpdate(data: {
    cruiseId: number;
    cruiseCode: string;
    filePath: string;
    webhookEventId: number;
    batchId: string;
    lineId?: string;
  }): Promise<{ success: boolean; snapshotsCreated: number }> {
    const { cruiseId, cruiseCode, filePath, webhookEventId, batchId } = data;
    
    try {
      // Check if cruise exists in database
      const cruiseResult = await db.execute(sql`
        SELECT c.id, c.ship_id, c.name, c.sailing_date
        FROM cruises c
        WHERE c.cruise_id = ${cruiseCode}
        LIMIT 1
      `);
      
      if (!cruiseResult || cruiseResult.length === 0) {
        // Cruise doesn't exist - attempt auto-creation
        logger.warn(`🆕 Cruise ${cruiseCode} not found in database, attempting auto-creation`, {
          cruiseCode,
          filePath
        });
        
        const newCruiseId = await cruiseCreationService.createCruiseFromWebhook(
          cruiseCode,
          data.lineId || 'UNKNOWN',
          filePath
        );
        
        if (!newCruiseId) {
          throw new Error(`Failed to auto-create cruise ${cruiseCode}`);
        }
        
        // After creation, fetch the cruise data again
        const newCruiseResult = await db.execute(sql`
          SELECT c.id, c.ship_id, c.name, c.sailing_date
          FROM cruises c
          WHERE c.cruise_id = ${cruiseCode}
          LIMIT 1
        `);
        
        if (!newCruiseResult || newCruiseResult.length === 0) {
          throw new Error(`Cruise ${cruiseCode} still not found after auto-creation`);
        }
        
        cruiseResult[0] = newCruiseResult[0];
      }
      
      const cruise = cruiseResult[0];
      let snapshotsCreated = 0;
      
      // Create price snapshot before update
      await this.createPriceSnapshotEnhanced(cruise.id, webhookEventId, batchId, 'before_update');
      snapshotsCreated++;
      
      // Fetch and process cruise data
      const cruiseData = await traveltekFTPService.getCruiseDataFile(filePath);
      
      if (cruiseData) {
        await this.updateCruisePricingEnhanced(cruise.id, cruiseData);
        
        // Create price snapshot after update
        await this.createPriceSnapshotEnhanced(cruise.id, webhookEventId, batchId, 'after_update');
        snapshotsCreated++;
      }
      
      return { success: true, snapshotsCreated };
    } catch (error) {
      logger.error(`Failed to process cruise update ${cruiseCode}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        cruiseCode,
        filePath
      });
      
      return { success: false, snapshotsCreated: 0 };
    }
  }

  /**
   * Handle generic webhook (used for unknown event types)
   */
  async handleGenericWebhook(payload: any): Promise<WebhookProcessingResult> {
    logger.info('📨 Processing generic webhook', {
      eventType: payload.event_type,
      payload
    });
    
    // Route based on event type if provided
    if (payload.event_type === 'cruiseline_pricing_updated') {
      return this.handleStaticPricingUpdate(payload);
    }
    
    // Default response for unknown webhooks
    const now = new Date();
    return {
      successful: 0,
      failed: 0,
      totalCruises: 0,
      processingTimeMs: 0,
      priceSnapshotsCreated: 0,
      errors: [{ error: 'Unknown webhook event type' }],
      startTime: now,
      endTime: now
    };
  }
}

export const traveltekWebhookService = new TraveltekWebhookService();