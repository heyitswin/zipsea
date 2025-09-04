import { db } from '../db/connection';
import { logger } from '../config/logger';
import { cruises, ships } from '../db/schema';
import { eq, and, sql, gte } from 'drizzle-orm';
import { slackService } from './slack.service';
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

export class WebhookSimpleService {
  /**
   * Process cruiseline pricing updated webhook - SIMPLIFIED VERSION
   * Just flags cruises for batch processing instead of immediate download
   */
  async processCruiselinePricingUpdate(data: WebhookPricingData): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info('📌 WEBHOOK SIMPLE: Cruiseline pricing update received', {
        webhookLineId: data.lineId,
        eventType: data.eventType,
        timestamp: new Date().toISOString()
      });

      if (!data.lineId) {
        throw new Error('Line ID is required for cruiseline pricing updates');
      }

      // Map webhook line ID to database line ID
      const databaseLineId = getDatabaseLineId(data.lineId);

      logger.info('🔄 WEBHOOK SIMPLE: Line ID mapping', {
        webhookLineId: data.lineId,
        databaseLineId: databaseLineId,
        isMapped: data.lineId !== databaseLineId
      });

      // Flag all active cruises for this line as needing price update
      const updateResult = await db.execute(sql`
        UPDATE cruises c
        SET needs_price_update = true
        FROM ships s
        WHERE c.ship_id = s.id
          AND s.cruise_line_id = ${databaseLineId}
          AND c.is_active = true
          AND c.sailing_date >= CURRENT_DATE
          AND c.needs_price_update = false
      `);

      const rowsUpdated = updateResult.rowCount || 0;
      const duration = Date.now() - startTime;

      logger.info('✅ WEBHOOK SIMPLE: Cruises flagged for sync', {
        databaseLineId,
        cruisesFlagged: rowsUpdated,
        durationMs: duration
      });

      // Send Slack notification
      await slackService.notifyCustomMessage({
        title: '📌 Webhook: Cruises Flagged for Sync',
        message: `Line ${databaseLineId} - ${rowsUpdated} cruises marked for batch processing`,
        details: {
          webhookLineId: data.lineId,
          databaseLineId,
          cruisesFlagged: rowsUpdated,
          processingTime: `${duration}ms`,
          method: 'simple-flagging'
        }
      });

    } catch (error) {
      logger.error('❌ WEBHOOK SIMPLE: Failed to process cruiseline pricing update', error);

      // Send error notification
      await slackService.notifySyncError(
        error instanceof Error ? error.message : 'Unknown error',
        `Simple webhook processing for line ${data.lineId}`
      );

      throw error;
    }
  }

  /**
   * Process specific cruise pricing updated webhook
   * Flags specific cruises for batch processing
   */
  async processCruisePricingUpdate(data: WebhookPricingData): Promise<void> {
    try {
      logger.info('📌 WEBHOOK SIMPLE: Cruise pricing update received', {
        cruiseId: data.cruiseId,
        cruiseIds: data.cruiseIds?.length,
        eventType: data.eventType
      });

      const cruiseIds = data.cruiseId ? [data.cruiseId] : (data.cruiseIds || []);
      if (cruiseIds.length === 0) {
        throw new Error('Cruise ID(s) required for pricing updates');
      }

      // Flag specific cruises as needing price update
      let flaggedCount = 0;
      for (const cruiseId of cruiseIds) {
        const updateResult = await db
          .update(cruises)
          .set({
            needs_price_update: true
          })
          .where(and(
            eq(cruises.cruiseId, String(cruiseId)),
            eq(cruises.isActive, true),
            gte(cruises.sailingDate, new Date())
          ));

        if (updateResult.rowCount && updateResult.rowCount > 0) {
          flaggedCount++;
        }
      }

      logger.info(`✅ WEBHOOK SIMPLE: ${flaggedCount}/${cruiseIds.length} cruises flagged for sync`);

      // Send Slack notification
      if (flaggedCount > 0) {
        await slackService.notifyCustomMessage({
          title: '📌 Webhook: Individual Cruises Flagged',
          message: `${flaggedCount} cruises marked for batch processing`,
          details: {
            totalRequested: cruiseIds.length,
            successfullyFlagged: flaggedCount,
            method: 'simple-flagging'
          }
        });
      }

    } catch (error) {
      logger.error('❌ WEBHOOK SIMPLE: Failed to process cruise pricing update', error);
      throw error;
    }
  }

  /**
   * Process webhook payload - routes to appropriate handler
   */
  async processWebhook(payload: any): Promise<void> {
    const eventType = payload.eventType || payload.event_type;

    logger.info('📨 WEBHOOK SIMPLE: Processing webhook', {
      eventType,
      hasLineId: !!payload.lineId || !!payload.line_id,
      hasCruiseId: !!payload.cruiseId || !!payload.cruise_id
    });

    switch (eventType) {
      case 'cruiseline_pricing_updated':
      case 'line_price_update':
        await this.processCruiselinePricingUpdate({
          eventType,
          lineId: payload.lineId || payload.line_id,
          timestamp: payload.timestamp,
        });
        break;

      case 'cruise_pricing_updated':
      case 'cruises_pricing_updated':
      case 'pricing_updated':
        await this.processCruisePricingUpdate({
          eventType,
          cruiseId: payload.cruiseId || payload.cruise_id,
          cruiseIds: payload.cruiseIds || payload.cruise_ids,
          timestamp: payload.timestamp,
        });
        break;

      default:
        logger.warn('Unknown webhook event type', { eventType });
        throw new Error(`Unknown event type: ${eventType}`);
    }
  }
}

export const webhookSimpleService = new WebhookSimpleService();
