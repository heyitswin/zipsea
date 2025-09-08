import { Router, Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { enhancedWebhookService } from '../services/webhook-enhanced.service';
import { db } from '../db/connection';
import { sql } from 'drizzle-orm';

console.log('🚨 WEBHOOK ROUTES LOADING - logger type:', typeof logger);
console.log(
  '🚨 WEBHOOK ROUTES LOADING - enhancedWebhookServiceV2 type:',
  typeof enhancedWebhookService
);

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
    console.log('🚨 WEBHOOK HANDLER CALLED - /traveltek/cruiseline-pricing-updated');
    const startTime = Date.now();
    const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const receivedAt = new Date().toISOString();

    try {
      console.log('🚨 About to call logger.info...');
      try {
        logger.info(
          '🚀 [WEBHOOK-RECEIVED] Cruiseline pricing updated webhook received (REAL-TIME)',
          {
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
          }
        );
        console.log('🚨 After logger.info call');
      } catch (logError) {
        console.error('🚨 ERROR calling logger.info:', logError);
      }

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

      // Immediate acknowledgment - don't wait for processing
      res.status(200).json({
        success: true,
        message: 'Webhook received and queued for processing',
        timestamp: new Date().toISOString(),
        webhookId,
        lineId: payload.lineid,
        processingMode: 'async_enhanced',
        note: 'Processing will happen asynchronously',
      });

      // Process webhook asynchronously (don't await)
      logger.info('🔄 [WEBHOOK-QUEUING] Starting async webhook processing', {
        webhookId,
        lineId: payload.lineid,
        stage: 'QUEUING_STARTED',
        queueAttemptAt: new Date().toISOString(),
      });

      // Add debug logging
      console.log('🚨 [DEBUG] About to check enhancedWebhookServiceV2...');
      console.log('🚨 [DEBUG] enhancedWebhookService exists:', !!enhancedWebhookService);
      console.log(
        '🚨 [DEBUG] processCruiselinePricingUpdate method exists:',
        !!enhancedWebhookService?.processCruiselinePricingUpdate
      );

      logger.info(
        '🔍 [DEBUG] About to call enhancedWebhookServiceV2.processCruiselinePricingUpdate',
        {
          serviceExists: !!enhancedWebhookService,
          methodExists: !!enhancedWebhookService?.processCruiselinePricingUpdate,
          payloadLineId: payload.lineid,
        }
      );

      try {
        console.log(
          '🚨 [DEBUG] Calling enhancedWebhookServiceV2.processCruiselinePricingUpdate...'
        );
        const promise = enhancedWebhookService.processCruiselinePricingUpdate({
          eventType: payload.event,
          lineId: payload.lineid,
          timestamp: String(payload.timestamp),
          webhookId,
        });
        console.log('🚨 [DEBUG] Enhanced service method called, promise:', !!promise);

        logger.info('🔍 [DEBUG] Promise created from enhanced service', {
          promiseType: typeof promise,
          isPromise: promise instanceof Promise,
        });

        promise
          .then(() => {
            logger.info('📨 [WEBHOOK-PROCESSED] Enhanced webhook processing completed', {
              webhookId,
              lineId: payload.lineid,
              processedAt: new Date().toISOString(),
              processingTime: Date.now() - startTime,
              stage: 'PROCESSING_COMPLETED',
            });
          })
          .catch(error => {
            logger.error('❌ [WEBHOOK-PROCESSING-FAILED] Enhanced processing failed', {
              webhookId,
              lineId: payload.lineid,
              error: error instanceof Error ? error.message : 'Unknown error',
              errorStack: error instanceof Error ? error.stack : undefined,
              failedAt: new Date().toISOString(),
              stage: 'PROCESSING_FAILED',
            });
          });
      } catch (syncError) {
        logger.error('❌ [WEBHOOK-SYNC-ERROR] Synchronous error calling enhanced service', {
          webhookId,
          error: syncError instanceof Error ? syncError.message : 'Unknown error',
          errorStack: syncError instanceof Error ? syncError.stack : undefined,
        });
      }

      logger.info('✅ [WEBHOOK-ACKNOWLEDGED] Webhook acknowledged to sender', {
        webhookId,
        lineId: payload.lineid,
        responseTime: Date.now() - startTime,
        stage: 'WEBHOOK_ACKNOWLEDGED',
      });
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
  console.log('🚨 GENERIC WEBHOOK HANDLER CALLED - /traveltek');
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
        // Process webhook using enhanced service
        await enhancedWebhookService.processCruiselinePricingUpdate({
          eventType: payload.event,
          lineId: payload.lineid,
          timestamp: String(payload.timestamp),
          webhookId,
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

    // Process the webhook using enhanced service
    await enhancedWebhookService.processCruiselinePricingUpdate({
      eventType: simulatedPayload.event,
      lineId: simulatedPayload.lineid,
      timestamp: String(simulatedPayload.timestamp),
      webhookId: `test_${Date.now()}`,
    });

    res.status(200).json({
      success: true,
      message: 'Webhook simulation - cruises flagged for batch processing',
      timestamp: new Date().toISOString(),
      simulation: {
        payload: simulatedPayload,
        processingMode: 'batch_flagging_v6',
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

/**
 * Clear stuck webhook locks
 * Usage: POST /api/webhooks/traveltek/clear-locks
 */
router.post('/traveltek/clear-locks', async (req: Request, res: Response) => {
  try {
    const redisClient = (await import('../cache/redis')).default;

    if (!redisClient) {
      return res.status(500).json({
        success: false,
        error: 'Redis not available',
        timestamp: new Date().toISOString(),
      });
    }

    // Find all webhook locks
    const lockKeys = await redisClient.keys('webhook:line:*:lock');
    const cleared = [];

    for (const key of lockKeys) {
      const value = await redisClient.get(key);
      const lineId = key.match(/webhook:line:(\d+):lock/)?.[1];
      await redisClient.del(key);
      cleared.push({ lineId, webhookId: value });
    }

    logger.info(`Cleared ${cleared.length} webhook locks`, { cleared });

    res.json({
      success: true,
      message: `Cleared ${cleared.length} webhook lock(s)`,
      cleared,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error clearing webhook locks:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Get recent webhook processing diagnostics
 * Usage: GET /api/webhooks/traveltek/diagnostics
 */
router.get('/traveltek/diagnostics', async (req: Request, res: Response) => {
  try {
    // Collect diagnostic information
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      ftpConfig: {
        host: process.env.TRAVELTEK_FTP_HOST || 'Not configured',
        user: process.env.TRAVELTEK_FTP_USER
          ? `${process.env.TRAVELTEK_FTP_USER.substring(0, 3)}***`
          : 'Not configured',
        hasPassword: !!process.env.TRAVELTEK_FTP_PASSWORD,
      },
      redisStatus: 'unknown',
      recentErrors: [],
      recentProcessing: [],
    };

    // Check Redis connection
    try {
      const redisClient = (await import('../cache/redis')).default;
      if (redisClient) {
        await redisClient.ping();
        diagnostics.redisStatus = 'connected';

        // Try to get recent processing locks
        const locks = await redisClient.keys('webhook:line:*:lock');
        diagnostics.activeLocks = locks.length;
      }
    } catch (redisError) {
      diagnostics.redisStatus = `error: ${redisError instanceof Error ? redisError.message : 'Unknown'}`;
    }

    // Check recent webhook processing
    try {
      const result = await db.execute(sql`
        SELECT
          cruise_line_id,
          COUNT(*) as count,
          MAX(updated_at) as last_update
        FROM cruises
        WHERE updated_at > NOW() - INTERVAL '10 minutes'
        GROUP BY cruise_line_id
        ORDER BY last_update DESC
        LIMIT 5
      `);

      diagnostics.recentProcessing = result.map((row: any) => ({
        lineId: row.cruise_line_id,
        cruisesUpdated: row.count,
        lastUpdate: row.last_update,
      }));
    } catch (dbError) {
      diagnostics.dbError = dbError instanceof Error ? dbError.message : 'Unknown error';
    }

    // Check if webhook service is loaded
    try {
      const serviceCheck = await import('../services/webhook-enhanced.service');
      diagnostics.webhookServiceLoaded = !!serviceCheck.enhancedWebhookService;
    } catch (serviceError) {
      diagnostics.webhookServiceError =
        serviceError instanceof Error ? serviceError.message : 'Unknown error';
    }

    // Test FTP connection if configured
    if (
      process.env.TRAVELTEK_FTP_HOST &&
      process.env.TRAVELTEK_FTP_USER &&
      process.env.TRAVELTEK_FTP_PASSWORD
    ) {
      try {
        const { traveltekFTPService } = await import('../services/traveltek-ftp.service');
        await traveltekFTPService.connect();
        diagnostics.ftpConnection = 'success';

        // Connection successful
        diagnostics.ftpTestPath = 'Connection verified';

        await traveltekFTPService.disconnect();
      } catch (ftpError) {
        diagnostics.ftpConnection = `failed: ${ftpError instanceof Error ? ftpError.message : 'Unknown'}`;
      }
    } else {
      diagnostics.ftpConnection = 'missing_credentials';
    }

    res.json({
      success: true,
      diagnostics,
      recommendations: generateRecommendations(diagnostics),
    });
  } catch (error) {
    logger.error('Error generating diagnostics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

function generateRecommendations(diagnostics: any): string[] {
  const recommendations = [];

  if (diagnostics.ftpConnection !== 'success') {
    recommendations.push('FTP connection is failing - check credentials and network access');
  }

  if (diagnostics.redisStatus !== 'connected') {
    recommendations.push('Redis is not connected - webhook locks may not work properly');
  }

  if (diagnostics.recentProcessing.length === 0) {
    recommendations.push('No recent cruise updates - webhook processing may be failing');
  }

  if (diagnostics.activeLocks > 0) {
    recommendations.push(
      `${diagnostics.activeLocks} webhook locks are active - may be blocking processing`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('All systems appear operational');
  }

  return recommendations;
}

/**
 * Check FTP configuration status
 * Usage: GET /api/webhooks/traveltek/ftp-status
 */
router.get('/traveltek/ftp-status', async (req: Request, res: Response) => {
  try {
    const ftpConfig = {
      host: process.env.TRAVELTEK_FTP_HOST || 'Not configured',
      user: process.env.TRAVELTEK_FTP_USER
        ? `${process.env.TRAVELTEK_FTP_USER.substring(0, 3)}***`
        : 'Not configured',
      hasPassword: !!process.env.TRAVELTEK_FTP_PASSWORD,
      environment: process.env.NODE_ENV || 'unknown',
    };

    // Try to test FTP connection if credentials exist
    let connectionStatus = 'unchecked';
    if (
      process.env.TRAVELTEK_FTP_HOST &&
      process.env.TRAVELTEK_FTP_USER &&
      process.env.TRAVELTEK_FTP_PASSWORD
    ) {
      try {
        const { traveltekFTPService } = await import('../services/traveltek-ftp.service');
        // Try to connect and list root directory
        await traveltekFTPService.connect();
        connectionStatus = 'connected';
        await traveltekFTPService.disconnect();
      } catch (ftpError) {
        connectionStatus = `failed: ${ftpError instanceof Error ? ftpError.message : 'Unknown error'}`;
      }
    } else {
      connectionStatus = 'missing_credentials';
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ftpConfig,
      connectionStatus,
      recommendation:
        connectionStatus === 'connected'
          ? 'FTP is properly configured'
          : 'FTP credentials need to be configured in Render environment variables',
    });
  } catch (error) {
    logger.error('Error checking FTP status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Get queue status for V2 processor
 * Usage: GET /api/webhooks/traveltek/queue-status
 */
router.get('/traveltek/queue-status', async (req: Request, res: Response) => {
  try {
    const { webhookProcessorV2 } = await import('../services/webhook-processor-v2.service');
    const stats = await webhookProcessorV2.getQueueStats();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      queue: stats || { message: 'Queue not available' },
    });
  } catch (error) {
    logger.error('Error getting queue status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Test webhook endpoint for triggering webhook processing
 * Usage: POST /api/webhooks/traveltek/test with { "lineId": 22 }
 */
router.post('/traveltek/test', async (req: Request, res: Response) => {
  const testLineId = req.body.lineId || 22; // Default to Royal Caribbean for testing
  const useV2 = req.body.useV2 !== false; // Default to V2 processor
  const webhookId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  logger.info('🧪 Test webhook triggered', {
    lineId: testLineId,
    webhookId,
    useV2,
    requestBody: req.body,
  });

  try {
    if (useV2) {
      // Use new V2 queue-based processor
      const { webhookProcessorV2 } = await import('../services/webhook-processor-v2.service');
      const jobId = await webhookProcessorV2.queueWebhook({
        eventType: 'test_cruiseline_pricing_updated',
        lineId: testLineId,
        timestamp: String(Date.now()),
        testMode: true,
      });

      logger.info('✅ Test webhook queued with V2 processor', {
        webhookId,
        jobId,
        lineId: testLineId,
      });

      res.json({
        success: true,
        message: 'Test webhook queued for processing (V2)',
        lineId: testLineId,
        webhookId,
        jobId,
        processor: 'v2-queue-based',
        note: 'Processing in background queue - check /api/webhooks/traveltek/queue-status for progress',
        timestamp: new Date().toISOString(),
      });
    } else {
      // Use old enhanced processor (for comparison)
      res.json({
        success: true,
        message: 'Test webhook triggered successfully',
        lineId: testLineId,
        webhookId,
        processor: 'v1-enhanced',
        note: 'Processing started - check logs and Slack for progress updates',
        timestamp: new Date().toISOString(),
      });

      // Trigger old processing asynchronously
      await enhancedWebhookService.processCruiselinePricingUpdate({
        eventType: 'test_cruiseline_pricing_updated',
        lineId: testLineId,
        timestamp: String(Date.now()),
        webhookId,
      });

      logger.info('✅ Test webhook processing initiated', {
        webhookId,
        lineId: testLineId,
      });
    }
  } catch (error) {
    logger.error('❌ Test webhook processing failed:', {
      webhookId,
      lineId: testLineId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
