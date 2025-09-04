import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection';
import { logger } from '../config/logger';
import { 
  cruises, 
  pricing, 
  cheapestPricing 
} from '../db/schema';
import { traveltekFTPService } from './traveltek-ftp.service';
import { dataSyncService } from './data-sync.service';
import { cacheManager, searchCache, cruiseCache } from '../cache/cache-manager';
import { CacheKeys } from '../cache/cache-keys';
import { slackService } from './slack.service';
import { bulkFtpDownloader } from './bulk-ftp-downloader.service';
import { getDatabaseLineId } from '../config/cruise-line-mapping';

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

export class WebhookService {

  /**
   * Process cruiseline pricing updated webhook
   * Uses bulk FTP downloader for efficient processing of entire cruise lines
   */
  async processCruiselinePricingUpdate(data: WebhookPricingData): Promise<void> {
    try {
      logger.info('Processing cruiseline pricing update using bulk FTP downloader', { 
        lineId: data.lineId, 
        eventType: data.eventType 
      });

      if (!data.lineId) {
        throw new Error('Line ID is required for cruiseline pricing updates');
      }

      // Map webhook line ID to database line ID
      const databaseLineId = getDatabaseLineId(data.lineId);
      
      if (databaseLineId !== data.lineId) {
        logger.info(`Mapping webhook line ${data.lineId} to database line ${databaseLineId}`);
      }

      // Get cruise information for bulk download
      const cruiseInfos = await bulkFtpDownloader.getCruiseInfoForLine(databaseLineId);

      logger.info(`Found ${cruiseInfos.length} cruises for bulk download (line ${data.lineId} -> ${databaseLineId})`);

      if (cruiseInfos.length === 0) {
        logger.warn(`No active cruises found for cruise line ${data.lineId} (database line ${databaseLineId})`);
        return;
      }

      // Perform bulk FTP download
      const downloadResult = await bulkFtpDownloader.downloadLineUpdates(databaseLineId, cruiseInfos);
      
      logger.info(`Bulk download completed`, {
        lineId: data.lineId,
        databaseLineId,
        totalFiles: downloadResult.totalFiles,
        successful: downloadResult.successfulDownloads,
        failed: downloadResult.failedDownloads,
        duration: `${(downloadResult.duration / 1000).toFixed(2)}s`
      });

      // Process downloaded data to update database
      const processingResult = await bulkFtpDownloader.processCruiseUpdates(databaseLineId, downloadResult);

      // Clear relevant cache entries
      await this.clearCacheForCruiseLine(databaseLineId);

      // Aggregate final results
      const finalResult = {
        successful: processingResult.successful,
        failed: processingResult.failed + downloadResult.failedDownloads,
        actuallyUpdated: processingResult.actuallyUpdated,
        ftpConnectionFailures: downloadResult.connectionFailures,
        processingTimeMs: downloadResult.duration
      };

      logger.info(`Bulk FTP processing completed for line ${data.lineId}`, {
        databaseLineId,
        totalCruises: downloadResult.totalFiles,
        successful: finalResult.successful,
        failed: finalResult.failed,
        actuallyUpdated: finalResult.actuallyUpdated,
        ftpConnectionFailures: finalResult.ftpConnectionFailures,
        duration: `${(downloadResult.duration / 1000).toFixed(2)}s`,
        successRate: `${Math.round((finalResult.actuallyUpdated / downloadResult.totalFiles) * 100)}%`
      });
      
      // Send Slack notification using existing method
      await slackService.notifyCruiseLinePricingUpdate(data, {
        successful: finalResult.actuallyUpdated,
        failed: finalResult.failed
      });

    } catch (error) {
      logger.error('Failed to process cruiseline pricing update with bulk FTP:', error);
      
      // Send error notification
      await slackService.notifySyncError(
        error instanceof Error ? error.message : 'Unknown bulk FTP error',
        `Bulk FTP processing for line ${data.lineId}`
      );
      
      throw error;
    }
  }

  /**
   * Process specific cruise pricing updated webhook
   * Updates pricing for specific cruises
   */
  async processCruisePricingUpdate(data: WebhookPricingData): Promise<void> {
    try {
      logger.info('Processing cruise pricing update', { 
        cruiseId: data.cruiseId, 
        cruiseIds: data.cruiseIds?.length, 
        eventType: data.eventType 
      });

      const cruiseIds = data.cruiseId ? [data.cruiseId] : (data.cruiseIds || []);

      if (cruiseIds.length === 0) {
        throw new Error('Cruise ID(s) required for pricing updates');
      }

      // Process each cruise
      let successful = 0;
      let failed = 0;

      for (const cruiseId of cruiseIds) {
        try {
          // Get cruise details
          const cruise = await db
            .select({ 
              id: cruises.id, 
              cruiseLineId: cruises.cruiseLineId 
            })
            .from(cruises)
            .where(eq(cruises.id, String(cruiseId)))
            .limit(1);

          if (cruise.length === 0) {
            logger.warn(`Cruise ${cruiseId} not found`);
            continue;
          }

          await this.updateCruisePricing(cruiseId);
          
          // Clear cache for this specific cruise
          await this.clearCacheForCruise(cruiseId);
          
          successful++;
        } catch (error) {
          failed++;
          logger.error(`Failed to update pricing for cruise ${cruiseId}:`, error);
        }
      }

      logger.info(`Cruise pricing update completed: ${successful} successful, ${failed} failed`);
      
      // Send Slack notification
      await slackService.notifyCruisePricingUpdate(data, { successful, failed });

    } catch (error) {
      logger.error('Failed to process cruise pricing update:', error);
      throw error;
    }
  }

  /**
   * Process availability change webhook
   */
  async processAvailabilityChange(data: WebhookAvailabilityData): Promise<void> {
    try {
      logger.info('Processing availability change', { cruiseId: data.cruiseId });

      // Update availability in pricing table
      if (data.cabinCode) {
        await db
          .update(pricing)
          .set({
            isAvailable: data.availabilityData?.available ?? true,
            inventory: data.availabilityData?.inventory ?? null,
            waitlist: data.availabilityData?.waitlist ?? false,
            updatedAt: new Date(),
          })
          .where(and(
            eq(pricing.cruiseId, String(data.cruiseId)),
            eq(pricing.cabinCode, data.cabinCode)
          ));
      } else {
        // Update availability for all cabins on this cruise
        await db
          .update(pricing)
          .set({
            isAvailable: data.availabilityData?.available ?? true,
            updatedAt: new Date(),
          })
          .where(eq(pricing.cruiseId, String(data.cruiseId)));
      }

      // Clear cache
      await this.clearCacheForCruise(data.cruiseId);

      logger.info(`Availability updated for cruise ${data.cruiseId}`);
      
      // Send Slack notification
      await slackService.notifyAvailabilityChange({
        ...data,
        eventType: 'availability_change'
      });

    } catch (error) {
      logger.error('Failed to process availability change:', error);
      throw error;
    }
  }

  /**
   * Process booking confirmation webhook
   */
  async processBookingConfirmation(data: WebhookBookingData): Promise<void> {
    try {
      logger.info('Processing booking confirmation', { 
        bookingId: data.bookingId, 
        cruiseId: data.cruiseId 
      });

      // Update inventory counts (if we have specific cabin information)
      // For now, just log the booking - actual inventory management would require
      // more detailed cabin/booking information
      
      logger.info(`Booking confirmed: ${data.bookingId} for cruise ${data.cruiseId}`);

      // Clear cache to ensure fresh availability data
      await this.clearCacheForCruise(data.cruiseId);

    } catch (error) {
      logger.error('Failed to process booking confirmation:', error);
      throw error;
    }
  }

  /**
   * Process booking cancellation webhook
   */
  async processBookingCancellation(data: WebhookBookingData): Promise<void> {
    try {
      logger.info('Processing booking cancellation', { 
        bookingId: data.bookingId, 
        cruiseId: data.cruiseId 
      });

      // Update inventory counts (if we have specific cabin information)
      // For now, just log the cancellation
      
      logger.info(`Booking cancelled: ${data.bookingId} for cruise ${data.cruiseId}`);

      // Clear cache to ensure fresh availability data
      await this.clearCacheForCruise(data.cruiseId);

    } catch (error) {
      logger.error('Failed to process booking cancellation:', error);
      throw error;
    }
  }

  /**
   * Update pricing for a specific cruise by re-fetching from FTP
   */
  private async updateCruisePricing(cruiseId: number, filePath?: string | null): Promise<void> {
    if (!filePath) {
      logger.warn(`No file path found for cruise ${cruiseId}, skipping pricing update`);
      return;
    }

    try {
      logger.info(`Attempting to update pricing for cruise ${cruiseId} from ${filePath}`);
      
      // Add timeout and retry logic for FTP operations
      const maxRetries = 3;
      let attempt = 0;
      let lastError: Error | null = null;

      while (attempt < maxRetries) {
        try {
          attempt++;
          logger.info(`FTP download attempt ${attempt}/${maxRetries} for cruise ${cruiseId}`);
          
          // Download latest data from FTP with timeout
          const cruiseData = await Promise.race([
            traveltekFTPService.getCruiseDataFile(filePath),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('FTP download timeout')), 30000)
            )
          ]) as any;
          
          // Parse file path info
          const fileInfo = traveltekFTPService.parseCruiseFilePath(filePath);
          if (!fileInfo) {
            throw new Error(`Invalid file path format: ${filePath}`);
          }

          // Sync the updated data with error handling
          await dataSyncService.syncCruiseDataFile(fileInfo, cruiseData);

          logger.info(`Successfully updated pricing for cruise ${cruiseId} from ${filePath} (attempt ${attempt})`);
          return; // Success, exit retry loop

        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          logger.warn(`FTP attempt ${attempt} failed for cruise ${cruiseId}: ${lastError.message}`);
          
          // Don't retry on certain errors
          if (lastError.message.includes('Invalid file path') || 
              lastError.message.includes('not found') ||
              lastError.message.includes('403') ||
              lastError.message.includes('401')) {
            logger.error(`Non-retryable error for cruise ${cruiseId}: ${lastError.message}`);
            throw lastError;
          }
          
          // Wait before retry (exponential backoff)
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
            logger.info(`Waiting ${delay}ms before retry for cruise ${cruiseId}`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // All retries failed
      throw new Error(`Failed to update pricing for cruise ${cruiseId} after ${maxRetries} attempts. Last error: ${lastError?.message}`);

    } catch (error) {
      logger.error(`Failed to update pricing for cruise ${cruiseId}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        filePath,
        cruiseId
      });
      throw error;
    }
  }

  /**
   * Clear cache entries for a specific cruise with enhanced invalidation
   */
  private async clearCacheForCruise(cruiseId: number): Promise<void> {
    try {
      logger.info(`Clearing cache for cruise ${cruiseId}`);
      
      // Use specialized cache managers for better invalidation
      await Promise.allSettled([
        // Clear specific cruise data
        cruiseCache.invalidateCruise(cruiseId),
        
        // Clear search caches that might include this cruise
        searchCache.invalidateAllSearchCaches(),
        
        // Clear popular cruises cache since pricing changed
        cacheManager.del('popular:cruises:10'),
        cacheManager.del('popular:cruises:20'),
        
        // Clear search filters cache since pricing ranges might have changed
        searchCache.del('search:filters'),
      ]);

      logger.info(`Cache cleared successfully for cruise ${cruiseId}`);

    } catch (error) {
      logger.warn(`Failed to clear cache for cruise ${cruiseId}:`, error);
      // Don't throw - cache clearing shouldn't fail the webhook processing
    }
  }

  /**
   * Clear cache entries for an entire cruise line with enhanced invalidation
   */
  private async clearCacheForCruiseLine(lineId: number): Promise<void> {
    try {
      logger.info(`Clearing cache for cruise line ${lineId}`);
      
      // For cruise line updates, we need to clear everything as prices for
      // multiple cruises may have changed
      await Promise.allSettled([
        // Clear all search-related caches
        searchCache.invalidateAllSearchCaches(),
        
        // Clear all cruise and pricing caches (aggressive but safe)
        cacheManager.invalidatePattern('cruise:*'),
        cacheManager.invalidatePattern('pricing:*'),
        cacheManager.invalidatePattern('itinerary:*'),
        cacheManager.invalidatePattern('alternatives:*'),
        
        // Clear popular cruises
        cacheManager.invalidatePattern('popular:*'),
        
        // Clear filters as pricing ranges may have changed significantly
        cacheManager.del('search:filters'),
      ]);

      logger.info(`Cache cleared successfully for cruise line ${lineId}`);

    } catch (error) {
      logger.warn(`Failed to clear cache for cruise line ${lineId}:`, error);
      // Don't throw - cache clearing shouldn't fail the webhook processing
    }
  }

  /**
   * Validate webhook data
   */
  validateWebhookData(eventType: string, data: any): boolean {
    switch (eventType) {
      case 'cruiseline_pricing_updated':
        return data.lineId && typeof data.lineId === 'number';
        
      case 'cruises_pricing_updated':
        return (data.cruiseId && typeof data.cruiseId === 'number') || 
               (data.cruiseIds && Array.isArray(data.cruiseIds));
               
      case 'availability_change':
        return data.cruiseId && typeof data.cruiseId === 'number';
        
      case 'booking_confirmation':
      case 'booking_cancellation':
        return data.bookingId && data.cruiseId && 
               typeof data.cruiseId === 'number';
               
      default:
        return true; // Allow unknown event types
    }
  }

  /**
   * Process generic webhook data
   */
  async processWebhookEvent(eventType: string, payload: any): Promise<void> {
    try {
      // Validate webhook data
      if (!this.validateWebhookData(eventType, payload)) {
        throw new Error(`Invalid webhook data for event type: ${eventType}`);
      }

      switch (eventType) {
        case 'cruiseline_pricing_updated':
        case 'price_update':
          await this.processCruiselinePricingUpdate({
            eventType,
            lineId: payload.lineId || payload.line_id,
            priceData: payload.priceData || payload.price_data,
            timestamp: payload.timestamp,
          });
          break;

        case 'cruises_pricing_updated':
        case 'pricing_updated':
          await this.processCruisePricingUpdate({
            eventType,
            cruiseId: payload.cruiseId || payload.cruise_id,
            cruiseIds: payload.cruiseIds || payload.cruise_ids,
            priceData: payload.priceData || payload.price_data,
            timestamp: payload.timestamp,
          });
          break;

        case 'availability_change':
          await this.processAvailabilityChange({
            cruiseId: payload.cruiseId || payload.cruise_id,
            cabinCode: payload.cabinCode || payload.cabin_code,
            availabilityData: payload.availabilityData || payload.availability_data,
            timestamp: payload.timestamp,
          });
          break;

        case 'booking_confirmation':
          await this.processBookingConfirmation({
            bookingId: payload.bookingId || payload.booking_id,
            cruiseId: payload.cruiseId || payload.cruise_id,
            passengerCount: payload.passengerCount || payload.passenger_count || 1,
            totalPrice: payload.totalPrice || payload.total_price || 0,
            timestamp: payload.timestamp,
          });
          break;

        case 'booking_cancellation':
          await this.processBookingCancellation({
            bookingId: payload.bookingId || payload.booking_id,
            cruiseId: payload.cruiseId || payload.cruise_id,
            passengerCount: payload.passengerCount || payload.passenger_count || 1,
            totalPrice: payload.totalPrice || payload.total_price || 0,
            timestamp: payload.timestamp,
          });
          break;

        default:
          logger.warn(`Unknown webhook event type: ${eventType}`, { payload });
          break;
      }

    } catch (error) {
      logger.error(`Failed to process webhook event ${eventType}:`, error);
      throw error;
    }
  }
}

// Singleton instance
export const webhookService = new WebhookService();