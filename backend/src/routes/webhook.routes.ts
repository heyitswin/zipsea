import { Router, Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { webhookSimpleService } from '../services/webhook-simple.service';
import { db } from '../db/connection';
import { sql } from 'drizzle-orm';

const router = Router();

/**
 * Traveltek Webhook Endpoint
 *
 * This endpoint receives webhook notifications from Traveltek for:
 * - Price updates
 * - Availability changes
 * - Booking confirmations
 * - Cancellations
 *
 * Webhook URL for Traveltek registration in iSell:
 * Production: https://zipsea-production.onrender.com/api/webhooks/traveltek
 *
 * Note: We only use static pricing webhooks (cruiseline_pricing_updated)
 */
// Specific Traveltek webhook endpoints - REAL-TIME PROCESSING
router.post(
  '/traveltek/cruiseline-pricing-updated',
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const receivedAt = new Date().toISOString();

    try {
      logger.info('🚀 [WEBHOOK-RECEIVED] Cruiseline pricing updated webhook received (REAL-TIME)', {
        webhookId,
        receivedAt,
        bodySize: JSON.stringify(req.body).length,
        lineId: req.body.lineid || req.body.lineId || req.body.line_id,
        currency: req.body.currency,
        timestamp: req.body.timestamp,
        processingMode: 'realtime_parallel',
        userAgent: req.headers['user-agent'],
        sourceIP: req.ip || req.connection.remoteAddress,
        stage: 'WEBHOOK_RECEIVED',
      });

      // Validate required fields
      if (!req.body.lineid && !req.body.lineId && !req.body.line_id) {
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

      // Normalize the payload
      const payload = {
        event: 'cruiseline_pricing_updated',
        lineid: req.body.lineid || req.body.lineId || req.body.line_id,
        marketid: req.body.marketid || req.body.marketId || 0,
        currency: req.body.currency || 'USD',
        description:
          req.body.description ||
          `Cruise line pricing update for line ${req.body.lineid || req.body.lineId || req.body.line_id}`,
        source: req.body.source || 'traveltek_webhook',
        timestamp: req.body.timestamp || Math.floor(Date.now() / 1000),
      };

      logger.info('📋 [WEBHOOK-NORMALIZED] Payload normalized and ready for processing', {
        webhookId,
        payload,
        validationTime: Date.now() - startTime,
        stage: 'PAYLOAD_NORMALIZED',
        receivedAt,
      });

      try {
        logger.info('🔄 [WEBHOOK-QUEUING] Starting webhook queue process', {
          webhookId,
          lineId: payload.lineid,
          stage: 'QUEUING_STARTED',
          queueAttemptAt: new Date().toISOString(),
        });

        // Process webhook using simple flagging service
        const processingResult = await webhookSimpleService.processCruiselinePricingUpdate({
          eventType: payload.event,
          lineId: payload.lineid,
          timestamp: String(payload.timestamp),
        });

        logger.info('📨 [WEBHOOK-PROCESSED] Cruises flagged for batch processing', {
          webhookId,
          lineId: payload.lineid,
          processedAt: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          stage: 'FLAGGED_FOR_BATCH',
        });

        // Immediate acknowledgment
        res.status(200).json({
          success: true,
          message: 'Webhook received and cruises flagged for batch processing',
          timestamp: new Date().toISOString(),
          webhookId,
          lineId: payload.lineid,
          processingMode: 'batch_flagging_v5',
          note: 'Cruises will be updated in the next batch sync run',
        });

        logger.info('✅ [WEBHOOK-ACKNOWLEDGED] Webhook acknowledged to sender', {
          webhookId,
          lineId: payload.lineid,
          responseTime: Date.now() - startTime,
          stage: 'WEBHOOK_ACKNOWLEDGED',
        });
      } catch (processingError) {
        logger.error('❌ [WEBHOOK-FLAG-FAILED] Failed to flag cruises for batch processing', {
          webhookId,
          lineId: payload.lineid,
          error: processingError instanceof Error ? processingError.message : 'Unknown error',
          flagFailedAt: new Date().toISOString(),
          stage: 'FLAG_FAILED',
        });

        // Still acknowledge webhook to prevent retries, but note the error
        res.status(200).json({
          success: false,
          message: 'Webhook received but failed to flag cruises for processing',
          timestamp: new Date().toISOString(),
          webhookId,
          lineId: payload.lineid,
          error: processingError instanceof Error ? processingError.message : 'Unknown error',
          note: 'Check system logs and database connection',
        });
      }
    } catch (error) {
      logger.error('❌ Error in cruiseline pricing webhook handler', {
        webhookId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Always return 200 to prevent webhook retries, even on errors
      res.status(200).json({
        success: false,
        message: 'Webhook received but processing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        webhookId,
      });
    }
  }
);

router.post(
  '/traveltek/cruises-pricing-updated',
  async (req: Request, res: Response, next: NextFunction) => {
    const webhookId = `cruises_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      logger.info('🚢 Cruises pricing updated webhook received', {
        webhookId,
        bodySize: JSON.stringify(req.body).length,
        cruiseId: req.body.cruiseId || req.body.cruise_id,
        cruiseIds: req.body.cruiseIds || req.body.cruise_ids,
        hasCruiseIds: !!(req.body.cruiseIds || req.body.cruise_ids),
      });

      // This endpoint is for individual cruise updates (not cruise line updates)
      // For now, we'll acknowledge but not process since we focus on cruise line updates
      logger.info('📝 Individual cruise pricing webhook acknowledged (not currently processed)', {
        webhookId,
        cruiseIds: req.body.cruiseIds ||
          req.body.cruise_ids || [req.body.cruiseId || req.body.cruise_id],
      });

      res.status(200).json({
        success: true,
        message: 'Individual cruise pricing webhook received and acknowledged',
        timestamp: new Date().toISOString(),
        webhookId,
        note: 'Individual cruise updates are not currently processed - only cruise line updates',
        cruiseIds: req.body.cruiseIds ||
          req.body.cruise_ids || [req.body.cruiseId || req.body.cruise_id],
      });
    } catch (error) {
      logger.error('❌ Error processing cruise pricing webhook', {
        webhookId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Always return 200 to prevent webhook retries
      res.status(200).json({
        success: false,
        message: 'Webhook received but processing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        webhookId,
      });
    }
  }
);

// Generic Traveltek webhook endpoint (keep for other events)
// Note: Traveltek doesn't send signatures, so no validation needed
router.post('/traveltek', async (req: Request, res: Response, next: NextFunction) => {
  const webhookId = `generic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    const { body, headers } = req;
    const webhookEvent = body.event || body.event_type || body.type;

    logger.info('🔔 Traveltek generic webhook received', {
      webhookId,
      event: webhookEvent,
      headers: {
        'user-agent': headers['user-agent'],
        'content-type': headers['content-type'],
      },
      payloadSize: JSON.stringify(body).length,
      hasLineId: !!(body.lineid || body.lineId || body.line_id),
      hasPaths: !!(body.paths && Array.isArray(body.paths)),
    });

    // Route to appropriate handler based on event type
    if (
      webhookEvent === 'cruiseline_pricing_updated' ||
      body.event === 'cruiseline_pricing_updated'
    ) {
      // Normalize payload for real-time processing
      const payload = {
        event: 'cruiseline_pricing_updated',
        lineid: body.lineid || body.lineId || body.line_id,
        marketid: body.marketid || body.marketId || 0,
        currency: body.currency || 'USD',
        description: body.description || `Cruise line pricing update (generic webhook)`,
        source: body.source || 'traveltek_webhook_generic',
        timestamp: body.timestamp || Math.floor(Date.now() / 1000),
      };

      try {
        // Process webhook using simple flagging
        await webhookSimpleService.processCruiselinePricingUpdate({
          eventType: payload.event,
          lineId: payload.lineid,
          timestamp: String(payload.timestamp),
        });

        logger.info('📨 Generic webhook processed - cruises flagged', {
          webhookId,
          lineId: payload.lineid,
        });

        res.status(200).json({
          success: true,
          message:
            'Generic cruise line pricing webhook received and cruises flagged for batch processing',
          timestamp: new Date().toISOString(),
          event: webhookEvent,
          webhookId,
          lineId: payload.lineid,
          processingMode: 'batch_flagging_v6',
        });
      } catch (processingError) {
        logger.error('❌ Failed to flag cruises from generic webhook', {
          webhookId,
          lineId: payload.lineid,
          error: processingError instanceof Error ? processingError.message : 'Unknown error',
        });

        res.status(200).json({
          success: false,
          message: 'Generic webhook received but failed to flag cruises',
          timestamp: new Date().toISOString(),
          event: webhookEvent,
          webhookId,
          lineId: payload.lineid,
          error: processingError instanceof Error ? processingError.message : 'Unknown error',
        });
      }
    } else if (
      webhookEvent === 'cruises_live_pricing_updated' ||
      body.event === 'cruises_live_pricing_updated'
    ) {
      // Live pricing not currently used but acknowledge it
      logger.info('📝 Live pricing webhook acknowledged (not processed)', {
        webhookId,
        pathsCount: body.paths?.length || 0,
        currency: body.currency,
      });

      res.status(200).json({
        success: true,
        message: 'Live pricing webhook acknowledged (not currently processed)',
        timestamp: new Date().toISOString(),
        event: webhookEvent,
        webhookId,
        pathsReceived: body.paths?.length || 0,
      });
    } else {
      logger.warn(`⚠️ Unknown webhook event type: ${webhookEvent}`, {
        webhookId,
        event: webhookEvent,
        availableFields: Object.keys(body),
      });

      res.status(200).json({
        success: true,
        message: `Unknown event type '${webhookEvent}' acknowledged`,
        timestamp: new Date().toISOString(),
        event: webhookEvent,
        webhookId,
      });
    }
  } catch (error) {
    logger.error('❌ Error processing generic Traveltek webhook', {
      webhookId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Always respond with 200 to prevent webhook retries for processing errors
    res.status(200).json({
      success: false,
      message: 'Webhook received but processing failed',
      timestamp: new Date().toISOString(),
      webhookId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Webhook Health Check with comprehensive status
 */
router.get('/traveltek/health', async (req: Request, res: Response) => {
  try {
    const healthData = {
      service: 'Traveltek Webhook Endpoint',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      endpoint: req.originalUrl,
    };

    // Get recent webhook statistics from database
    try {
      const stats = await db.execute(sql`
        SELECT
          COUNT(*) as total_webhooks,
          COUNT(*) FILTER (WHERE processed = true) as processed_webhooks,
          COUNT(*) FILTER (WHERE processed = false) as pending_webhooks,
          AVG(processing_time_ms) as avg_processing_time,
          MAX(processing_time_ms) as max_processing_time,
          SUM(successful_count) as total_successful,
          SUM(failed_count) as total_failed
        FROM webhook_events
        WHERE created_at >= CURRENT_DATE - 7::integer * INTERVAL '1 day'
      `);

      const recentWebhooks = await db.execute(sql`
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
        LIMIT 5
      `);

      const statsRow = stats[0] || {};
      const webhooksRows = recentWebhooks || [];

      Object.assign(healthData, {
        statistics: {
          last7Days: {
            totalWebhooks: parseInt(statsRow.total_webhooks) || 0,
            processedWebhooks: parseInt(statsRow.processed_webhooks) || 0,
            pendingWebhooks: parseInt(statsRow.pending_webhooks) || 0,
            averageProcessingTime: statsRow.avg_processing_time
              ? Math.round(statsRow.avg_processing_time)
              : null,
            maxProcessingTime: statsRow.max_processing_time
              ? Math.round(statsRow.max_processing_time)
              : null,
            totalSuccessful: parseInt(statsRow.total_successful) || 0,
            totalFailed: parseInt(statsRow.total_failed) || 0,
          },
        },
        recentWebhooks: webhooksRows.map((webhook: any) => ({
          eventType: webhook.event_type,
          lineId: webhook.line_id,
          processed: webhook.processed,
          successful: webhook.successful_count || 0,
          failed: webhook.failed_count || 0,
          processingTimeMs: webhook.processing_time_ms,
          createdAt: webhook.created_at,
          processedAt: webhook.processed_at,
        })),
      });
    } catch (statsError) {
      logger.warn('Could not retrieve webhook statistics for health check', { error: statsError });
    }

    res.status(200).json(healthData);
  } catch (error) {
    logger.error('Error in webhook health check', { error });
    res.status(200).json({
      service: 'Traveltek Webhook Endpoint',
      status: 'degraded',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      endpoint: req.originalUrl,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Simple Mapping Test Endpoint - Test line ID mapping only (no DB queries)
 * Usage: GET /api/webhooks/traveltek/mapping-test?lineId=3
 */
router.get('/traveltek/mapping-test', async (req: Request, res: Response) => {
  try {
    const webhookLineId = parseInt(req.query.lineId as string);

    if (!webhookLineId) {
      return res.status(400).json({
        error: 'Missing lineId parameter',
        usage: 'GET /api/webhooks/traveltek/mapping-test?lineId=3',
        timestamp: new Date().toISOString(),
      });
    }

    const { getDatabaseLineId } = await import('../config/cruise-line-mapping');
    const databaseLineId = getDatabaseLineId(webhookLineId);

    logger.info(`🔍 Testing webhook line ID mapping`, {
      webhookLineId,
      databaseLineId,
      mappingApplied: webhookLineId !== databaseLineId,
    });

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      mapping: {
        webhookLineId,
        databaseLineId,
        mappingApplied: webhookLineId !== databaseLineId,
      },
    };

    res.status(200).json(result);
  } catch (error) {
    logger.error('Error in mapping test endpoint', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Webhook Debugging Endpoint - Test line ID mapping and cruise queries
 * Usage: GET /api/webhooks/traveltek/debug?lineId=3
 */
router.get('/traveltek/debug', async (req: Request, res: Response) => {
  try {
    const webhookLineId = parseInt(req.query.lineId as string);

    if (!webhookLineId) {
      return res.status(400).json({
        error: 'Missing lineId parameter',
        usage: 'GET /api/webhooks/traveltek/debug?lineId=3',
        timestamp: new Date().toISOString(),
      });
    }

    const { getDatabaseLineId } = await import('../config/cruise-line-mapping');
    const databaseLineId = getDatabaseLineId(webhookLineId);

    logger.info(`🔍 Debugging webhook line ID mapping`, {
      webhookLineId,
      databaseLineId,
      mappingApplied: webhookLineId !== databaseLineId,
    });

    // Test database queries
    const cruiseLineResult = await db.execute(sql`
      SELECT id, name, code, is_active
      FROM cruise_lines
      WHERE id = ${databaseLineId}
    `);

    const cruisesResult = await db.execute(sql`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(*) FILTER (WHERE sailing_date >= CURRENT_DATE) as future_cruises,
        COUNT(*) FILTER (WHERE sailing_date >= CURRENT_DATE AND sailing_date <= CURRENT_DATE + INTERVAL '2 years') as target_cruises,
        COUNT(*) FILTER (WHERE needs_price_update = true) as needs_updates,
        MIN(sailing_date) as earliest_sailing,
        MAX(sailing_date) as latest_sailing
      FROM cruises
      WHERE cruise_line_id = ${databaseLineId}
    `);

    const sampleCruises = await db.execute(sql`
      SELECT id, cruise_id, name, sailing_date, needs_price_update, price_update_requested_at
      FROM cruises
      WHERE cruise_line_id = ${databaseLineId}
        AND sailing_date >= CURRENT_DATE
        AND sailing_date <= CURRENT_DATE + INTERVAL '2 years'
      ORDER BY sailing_date
      LIMIT 10
    `);

    const debugInfo = {
      webhook: {
        lineId: webhookLineId,
        mappedToDatabaseId: databaseLineId,
        mappingApplied: webhookLineId !== databaseLineId,
      },
      cruiseLine: {
        exists: cruiseLineResult.length > 0,
        data: cruiseLineResult[0] || null,
      },
      cruises: {
        statistics: cruisesResult[0] || {},
        sampleCruises: sampleCruises || [],
        queryUsed: `cruise_line_id = ${databaseLineId} AND sailing_date >= CURRENT_DATE AND sailing_date <= CURRENT_DATE + INTERVAL '2 years'`,
      },
      recommendations: [],
    };

    // Add recommendations
    if (!debugInfo.cruiseLine.exists) {
      debugInfo.recommendations.push(
        `Cruise line ${databaseLineId} does not exist in the database`
      );
    }

    if (debugInfo.cruises.statistics.target_cruises === 0) {
      debugInfo.recommendations.push(`No future cruises found for cruise line ${databaseLineId}`);
    } else {
      debugInfo.recommendations.push(
        `Found ${debugInfo.cruises.statistics.target_cruises} cruises that would be updated by this webhook`
      );
    }

    if (webhookLineId !== databaseLineId) {
      debugInfo.recommendations.push(
        `Webhook line ID ${webhookLineId} is being mapped to database line ID ${databaseLineId}`
      );
    }

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      debug: debugInfo,
    });
  } catch (error) {
    logger.error('Error in webhook debug endpoint', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Webhook Status and Statistics Dashboard
 */
router.get('/traveltek/status', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const limit = parseInt(req.query.limit as string) || 20;

    const [stats, recentWebhooks] = await Promise.all([
      db.execute(sql`
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
      `),
      db.execute(sql`
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
      `),
    ]);

    const statsRow = stats[0] || {};
    const webhooksRows = recentWebhooks || [];

    const response = {
      service: 'Real-time Webhook Status Dashboard',
      timestamp: new Date().toISOString(),
      period: `Last ${days} days`,
      summary: {
        totalWebhooks: parseInt(statsRow.total_webhooks) || 0,
        processedWebhooks: parseInt(statsRow.processed_webhooks) || 0,
        pendingWebhooks: parseInt(statsRow.pending_webhooks) || 0,
        successfulCruises: parseInt(statsRow.total_successful) || 0,
        failedCruises: parseInt(statsRow.total_failed) || 0,
        averageProcessingTimeMs: statsRow.avg_processing_time
          ? Math.round(statsRow.avg_processing_time)
          : null,
        maxProcessingTimeMs: statsRow.max_processing_time
          ? Math.round(statsRow.max_processing_time)
          : null,
      },
      recentWebhooks: webhooksRows.map((webhook: any) => ({
        id: webhook.id,
        eventType: webhook.event_type,
        lineId: webhook.line_id,
        processed: webhook.processed,
        successful: webhook.successful_count || 0,
        failed: webhook.failed_count || 0,
        processingTimeMs: webhook.processing_time_ms,
        createdAt: webhook.created_at,
        processedAt: webhook.processed_at,
        description: webhook.description,
      })),
      healthStatus: {
        healthy: (parseInt(statsRow.pending_webhooks) || 0) < 10,
        pendingThreshold: 10,
        avgProcessingOk: !statsRow.avg_processing_time || statsRow.avg_processing_time < 60000, // Less than 60s
        processingThreshold: 60000,
      },
      processingMode: 'realtime_parallel',
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error('Error retrieving webhook status', { error });
    res.status(500).json({
      service: 'Traveltek Webhook Status Dashboard',
      error: 'Failed to retrieve status',
      timestamp: new Date().toISOString(),
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Test webhook simulation endpoint
 * Simulates a Traveltek webhook for debugging
 * Usage: POST /api/webhooks/test-simulate with { "lineId": 3 }
 */
router.post('/test-simulate', async (req: Request, res: Response) => {
  try {
    const { lineId } = req.body;

    if (!lineId) {
      return res.status(400).json({
        error: 'Missing lineId in request body',
        usage: 'POST /api/webhooks/test-simulate with { "lineId": 3 }',
        timestamp: new Date().toISOString(),
      });
    }

    // Simulate the webhook payload that Traveltek would send
    const simulatedPayload = {
      event: 'cruiseline_pricing_updated',
      lineid: parseInt(lineId),
      marketid: 0,
      currency: 'USD',
      description: `TEST: Cruise line pricing update for line ${lineId}`,
      source: 'test_simulation',
      timestamp: Math.floor(Date.now() / 1000),
    };

    logger.info('🧨 TEST: Simulating webhook call with real-time processing', {
      simulatedPayload,
      testEndpoint: '/test-simulate',
    });

    // Process the webhook using our new real-time service
    const processingResult = await realtimeWebhookService.processWebhook(simulatedPayload);

    res.status(200).json({
      success: true,
      message: 'Webhook simulation queued for real-time processing',
      timestamp: new Date().toISOString(),
      simulation: {
        payload: simulatedPayload,
        processingJobId: processingResult.jobId,
        processingMode: 'realtime_parallel',
        note: 'Check Slack for accurate processing results with FTP connection status',
      },
    });
  } catch (error) {
    logger.error('Error in webhook simulation', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Generic webhook endpoint for testing
 * Accepts any POST request and logs the payload
 */
router.post('/test', (req: Request, res: Response) => {
  logger.info('Test webhook received', {
    body: req.body,
    headers: req.headers,
  });

  res.status(200).json({
    success: true,
    message: 'Test webhook received',
    timestamp: new Date().toISOString(),
    received: {
      body: req.body,
      headers: req.headers,
    },
  });
});

export default router;
