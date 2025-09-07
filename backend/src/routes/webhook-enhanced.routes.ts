import { Router, Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { enhancedWebhookService } from '../services/webhook-enhanced.service';
import { db } from '../db/connection';
import { sql } from 'drizzle-orm';

const router = Router();

/**
 * Enhanced Traveltek Webhook Endpoint
 *
 * Improvements:
 * - Webhook pause during sync operations
 * - Line-level locking for concurrent webhooks
 * - Pricing snapshots before updates
 * - Cruise creation for non-existent cruises
 * - Comprehensive data updates (not just pricing)
 * - ALL future sailings (no 2-year limit)
 *
 * Webhook URL for Traveltek registration in iSell:
 * Production: https://zipsea-production.onrender.com/api/webhooks/traveltek
 */

// Middleware to log webhook processing
async function logWebhookProcessing(
  webhookId: string,
  lineId: number,
  eventType: string,
  status: string,
  error?: string
) {
  try {
    await db.execute(sql`
      INSERT INTO webhook_processing_log (
        webhook_id, line_id, event_type, status, error_message, created_at
      ) VALUES (
        ${webhookId}, ${lineId}, ${eventType}, ${status}, ${error}, CURRENT_TIMESTAMP
      )
      ON CONFLICT (webhook_id) DO UPDATE SET
        status = EXCLUDED.status,
        error_message = EXCLUDED.error_message,
        completed_at = CASE
          WHEN EXCLUDED.status IN ('completed', 'failed')
          THEN CURRENT_TIMESTAMP
          ELSE webhook_processing_log.completed_at
        END
    `);
  } catch (err) {
    logger.error('Failed to log webhook processing:', err);
  }
}

// Enhanced Cruiseline Pricing Updated endpoint
router.post(
  '/traveltek/cruiseline-pricing-updated',
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const receivedAt = new Date().toISOString();

    try {
      logger.info('🚀 [WEBHOOK-RECEIVED] Enhanced cruiseline pricing webhook received', {
        webhookId,
        receivedAt,
        bodySize: JSON.stringify(req.body).length,
        lineId: req.body.lineid || req.body.lineId || req.body.line_id,
        currency: req.body.currency,
        timestamp: req.body.timestamp,
        processingMode: 'enhanced_parallel',
        userAgent: req.headers['user-agent'],
        sourceIP: req.ip || req.connection.remoteAddress,
        stage: 'WEBHOOK_RECEIVED',
      });

      // Validate required fields
      const lineId = req.body.lineid || req.body.lineId || req.body.line_id;

      if (!lineId) {
        logger.warn('⚠️ [WEBHOOK-VALIDATION-FAILED] Missing required lineId in webhook payload', {
          webhookId,
          body: req.body,
          stage: 'VALIDATION_FAILED',
          receivedAt,
        });

        return res.status(200).json({
          success: false,
          message: 'Missing required lineId field',
          timestamp: new Date().toISOString(),
          webhookId,
        });
      }

      // Log webhook start
      await logWebhookProcessing(webhookId, lineId, 'cruiseline_pricing_updated', 'processing');

      // Normalize the payload
      const payload = {
        event: 'cruiseline_pricing_updated',
        lineid: lineId,
        marketid: req.body.marketid || req.body.marketId || 0,
        currency: req.body.currency || 'USD',
        description: req.body.description || `Cruise line pricing update for line ${lineId}`,
        source: req.body.source || 'traveltek_webhook',
        timestamp: req.body.timestamp || Math.floor(Date.now() / 1000),
      };

      logger.info('📋 [WEBHOOK-NORMALIZED] Payload normalized for enhanced processing', {
        webhookId,
        payload,
        validationTime: Date.now() - startTime,
        stage: 'PAYLOAD_NORMALIZED',
        receivedAt,
      });

      // Immediately acknowledge webhook receipt (async processing)
      res.status(200).json({
        success: true,
        message: 'Webhook received and queued for enhanced processing',
        timestamp: new Date().toISOString(),
        webhookId,
        lineId: payload.lineid,
        mode: 'enhanced',
      });

      // Process webhook asynchronously with enhanced service
      logger.info('🔄 [WEBHOOK-PROCESSING] Starting enhanced webhook processing', {
        webhookId,
        lineId: payload.lineid,
        stage: 'PROCESSING_STARTED',
        processingAt: new Date().toISOString(),
      });

      // Process with enhanced service (async - don't await)
      enhancedWebhookService
        .processCruiselinePricingUpdate({
          eventType: payload.event,
          lineId: payload.lineid,
          timestamp: String(payload.timestamp),
        })
        .then(async () => {
          const processingTime = Date.now() - startTime;

          logger.info('✅ [WEBHOOK-COMPLETED] Enhanced webhook processing completed', {
            webhookId,
            lineId: payload.lineid,
            processingTime,
            completedAt: new Date().toISOString(),
            stage: 'COMPLETED',
          });

          await logWebhookProcessing(webhookId, lineId, 'cruiseline_pricing_updated', 'completed');
        })
        .catch(async (error) => {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          logger.error('❌ [WEBHOOK-FAILED] Enhanced webhook processing failed', {
            webhookId,
            lineId: payload.lineid,
            error: errorMessage,
            failedAt: new Date().toISOString(),
            stage: 'FAILED',
          });

          await logWebhookProcessing(
            webhookId,
            lineId,
            'cruiseline_pricing_updated',
            'failed',
            errorMessage
          );
        });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('❌ [WEBHOOK-ERROR] Webhook endpoint error', {
        webhookId,
        error: errorMessage,
        receivedAt,
        stage: 'ENDPOINT_ERROR',
      });

      // Still return 200 to prevent Traveltek from retrying
      res.status(200).json({
        success: false,
        message: 'Webhook processing error',
        error: errorMessage,
        timestamp: new Date().toISOString(),
        webhookId,
      });
    }
  }
);

// Specific cruise pricing update endpoint
router.post(
  '/traveltek/cruise-pricing-updated',
  async (req: Request, res: Response, next: NextFunction) => {
    const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      logger.info('🚢 [WEBHOOK-RECEIVED] Cruise pricing webhook received', {
        webhookId,
        cruiseId: req.body.cruiseid,
        cruiseIds: req.body.cruiseids,
        timestamp: req.body.timestamp,
      });

      const payload = {
        cruiseId: req.body.cruiseid,
        cruiseIds: req.body.cruiseids,
        eventType: 'cruise_pricing_updated',
        timestamp: req.body.timestamp || String(Date.now()),
      };

      // Acknowledge immediately
      res.status(200).json({
        success: true,
        message: 'Cruise pricing webhook received',
        webhookId,
      });

      // Process async
      enhancedWebhookService.processCruisePricingUpdate(payload).catch(error => {
        logger.error('Failed to process cruise pricing update:', error);
      });

    } catch (error) {
      logger.error('Cruise pricing webhook error:', error);
      res.status(200).json({
        success: false,
        message: 'Webhook processing error',
        webhookId,
      });
    }
  }
);

// Health check endpoint for webhook system
router.get('/traveltek/health', async (req: Request, res: Response) => {
  try {
    // Check if webhooks are paused
    const pauseResult = await db.execute(sql`
      SELECT value FROM system_flags
      WHERE key = 'webhooks_paused'
      LIMIT 1
    `);

    const isPaused = pauseResult.rows?.[0]?.value === 'true';

    // Get recent webhook stats
    const statsResult = await db.execute(sql`
      SELECT
        COUNT(*) as total_webhooks,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        AVG(processing_time_ms) as avg_processing_time
      FROM webhook_processing_log
      WHERE created_at > NOW() - INTERVAL '1 hour'
    `);

    const stats = statsResult.rows?.[0] || {};

    res.json({
      status: 'healthy',
      webhooks_paused: isPaused,
      recent_stats: {
        total_webhooks: parseInt(stats.total_webhooks || 0),
        completed: parseInt(stats.completed || 0),
        failed: parseInt(stats.failed || 0),
        processing: parseInt(stats.processing || 0),
        avg_processing_time_ms: parseFloat(stats.avg_processing_time || 0),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Webhook health check failed:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Test webhook endpoint for debugging
router.post('/traveltek/test', async (req: Request, res: Response) => {
  const testLineId = req.body.lineId || 22; // Default to Royal Caribbean for testing

  logger.info('🧪 Test webhook triggered', { lineId: testLineId });

  res.json({
    success: true,
    message: 'Test webhook triggered',
    lineId: testLineId,
    note: 'Check logs for processing details',
  });

  // Trigger test processing
  enhancedWebhookService
    .processCruiselinePricingUpdate({
      eventType: 'test_cruiseline_pricing_updated',
      lineId: testLineId,
      timestamp: String(Date.now()),
    })
    .catch(error => {
      logger.error('Test webhook processing failed:', error);
    });
});

// Get webhook processing stats
router.get('/traveltek/stats', async (req: Request, res: Response) => {
  try {
    const last24Hours = await db.execute(sql`
      SELECT
        line_id,
        COUNT(*) as webhook_count,
        SUM(cruises_processed) as total_cruises_processed,
        SUM(cruises_created) as total_created,
        SUM(cruises_updated) as total_updated,
        SUM(cruises_failed) as total_failed,
        AVG(processing_time_ms) as avg_processing_time,
        MAX(created_at) as last_webhook_at
      FROM webhook_processing_log
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY line_id
      ORDER BY webhook_count DESC
    `);

    res.json({
      success: true,
      stats: last24Hours.rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get webhook stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
