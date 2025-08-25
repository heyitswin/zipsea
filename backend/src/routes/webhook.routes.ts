import { Router, Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { traveltekWebhookService } from '../services/traveltek-webhook.service';
import { webhookQueue, getQueueStats, retryFailedJobs } from '../queues/webhook-queue';

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
// Specific Traveltek webhook endpoints as per their documentation
router.post('/traveltek/cruiseline-pricing-updated', async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    logger.info('🚀 Cruiseline pricing updated webhook received', {
      webhookId,
      bodySize: JSON.stringify(req.body).length,
      lineId: req.body.lineid || req.body.lineId || req.body.line_id,
      currency: req.body.currency,
      timestamp: req.body.timestamp
    });

    // Validate required fields
    if (!req.body.lineid && !req.body.lineId && !req.body.line_id) {
      logger.warn('⚠️ Missing required lineId in webhook payload', { webhookId, body: req.body });
      return res.status(200).json({
        success: false,
        message: 'Missing required lineId field',
        timestamp: new Date().toISOString(),
        webhookId
      });
    }

    // Normalize the payload
    const payload = {
      event: 'cruiseline_pricing_updated',
      lineid: req.body.lineid || req.body.lineId || req.body.line_id,
      marketid: req.body.marketid || req.body.marketId || 0,
      currency: req.body.currency || 'USD',
      description: req.body.description || `Cruise line pricing update for line ${req.body.lineid || req.body.lineId || req.body.line_id}`,
      source: req.body.source || 'traveltek_webhook',
      timestamp: req.body.timestamp || Math.floor(Date.now() / 1000)
    };

    // Always acknowledge receipt first (prevent webhook retries)
    // Add webhook to BullMQ queue for parallel processing
    const job = await webhookQueue.add('cruiseline-pricing-updated', {
      webhookId,
      eventType: 'cruiseline_pricing_updated',
      lineId: payload.lineid,
      payload,
      timestamp: new Date().toISOString(),
    }, {
      jobId: webhookId,
      priority: 1,
    });

    logger.info('📨 Webhook added to processing queue', {
      webhookId,
      jobId: job.id,
      lineId: payload.lineid,
      queueName: 'webhook-processing',
    });

    res.status(200).json({
      success: true,
      message: 'Cruiseline pricing update webhook received and queued for processing',
      timestamp: new Date().toISOString(),
      webhookId,
      lineId: payload.lineid,
      jobId: job.id,
    });

  } catch (error) {
    logger.error('❌ Error in cruiseline pricing webhook handler', { 
      webhookId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Always return 200 to prevent webhook retries, even on errors
    res.status(200).json({
      success: false,
      message: 'Webhook received but processing failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      webhookId
    });
  }
});

router.post('/traveltek/cruises-pricing-updated', async (req: Request, res: Response, next: NextFunction) => {
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
      cruiseIds: req.body.cruiseIds || req.body.cruise_ids || [req.body.cruiseId || req.body.cruise_id]
    });

    res.status(200).json({
      success: true,
      message: 'Individual cruise pricing webhook received and acknowledged',
      timestamp: new Date().toISOString(),
      webhookId,
      note: 'Individual cruise updates are not currently processed - only cruise line updates',
      cruiseIds: req.body.cruiseIds || req.body.cruise_ids || [req.body.cruiseId || req.body.cruise_id]
    });

  } catch (error) {
    logger.error('❌ Error processing cruise pricing webhook', { 
      webhookId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Always return 200 to prevent webhook retries
    res.status(200).json({
      success: false,
      message: 'Webhook received but processing failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      webhookId
    });
  }
});

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
      hasPaths: !!(body.paths && Array.isArray(body.paths))
    });

    // Route to appropriate handler based on event type
    if (webhookEvent === 'cruiseline_pricing_updated' || body.event === 'cruiseline_pricing_updated') {
      // Normalize payload and redirect to enhanced handler
      const payload = {
        event: 'cruiseline_pricing_updated',
        lineid: body.lineid || body.lineId || body.line_id,
        marketid: body.marketid || body.marketId || 0,
        currency: body.currency || 'USD',
        description: body.description || `Cruise line pricing update (generic webhook)`,
        source: body.source || 'traveltek_webhook_generic',
        timestamp: body.timestamp || Math.floor(Date.now() / 1000)
      };

      // Always acknowledge receipt first
      res.status(200).json({
        success: true,
        message: 'Cruise line pricing webhook received and queued for processing',
        timestamp: new Date().toISOString(),
        event: webhookEvent,
        webhookId,
        lineId: payload.lineid
      });

      // Process asynchronously
      setImmediate(async () => {
        try {
          const result = await traveltekWebhookService.handleStaticPricingUpdate(payload);
          logger.info('✅ Generic webhook cruise line pricing processing completed', {
            webhookId,
            lineId: payload.lineid,
            successful: result.successful,
            failed: result.failed,
            totalCruises: result.totalCruises
          });
        } catch (processingError) {
          logger.error('❌ Error during generic webhook processing', {
            webhookId,
            lineId: payload.lineid,
            error: processingError instanceof Error ? processingError.message : 'Unknown error'
          });
        }
      });

    } else if (webhookEvent === 'cruises_live_pricing_updated' || body.event === 'cruises_live_pricing_updated') {
      // Live pricing not currently used but acknowledge it
      logger.info('📝 Live pricing webhook acknowledged (not processed)', {
        webhookId,
        pathsCount: body.paths?.length || 0,
        currency: body.currency
      });

      res.status(200).json({
        success: true,
        message: 'Live pricing webhook acknowledged (not currently processed)',
        timestamp: new Date().toISOString(),
        event: webhookEvent,
        webhookId,
        pathsReceived: body.paths?.length || 0
      });

    } else {
      logger.warn(`⚠️ Unknown webhook event type: ${webhookEvent}`, {
        webhookId,
        event: webhookEvent,
        availableFields: Object.keys(body)
      });

      res.status(200).json({
        success: true,
        message: `Unknown event type '${webhookEvent}' acknowledged`,
        timestamp: new Date().toISOString(),
        event: webhookEvent,
        webhookId
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
      error: error instanceof Error ? error.message : 'Unknown error'
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

    // Get recent webhook statistics
    try {
      const stats = await traveltekWebhookService.getWebhookStats(7);
      const recentWebhooks = await traveltekWebhookService.getRecentWebhooks(5);

      Object.assign(healthData, {
        statistics: {
          last7Days: {
            totalWebhooks: parseInt(stats.total_webhooks) || 0,
            processedWebhooks: parseInt(stats.processed_webhooks) || 0,
            pendingWebhooks: parseInt(stats.pending_webhooks) || 0,
            averageProcessingTime: stats.avg_processing_time ? Math.round(stats.avg_processing_time) : null,
            maxProcessingTime: stats.max_processing_time ? Math.round(stats.max_processing_time) : null,
            totalSuccessful: parseInt(stats.total_successful) || 0,
            totalFailed: parseInt(stats.total_failed) || 0
          }
        },
        recentWebhooks: recentWebhooks.map(webhook => ({
          eventType: webhook.event_type,
          lineId: webhook.line_id,
          processed: webhook.processed,
          successful: webhook.successful_count || 0,
          failed: webhook.failed_count || 0,
          processingTimeMs: webhook.processing_time_ms,
          createdAt: webhook.created_at,
          processedAt: webhook.processed_at
        }))
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
      error: error instanceof Error ? error.message : 'Unknown error'
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
      traveltekWebhookService.getWebhookStats(days),
      traveltekWebhookService.getRecentWebhooks(limit)
    ]);

    const response = {
      service: 'Traveltek Webhook Status Dashboard',
      timestamp: new Date().toISOString(),
      period: `Last ${days} days`,
      summary: {
        totalWebhooks: parseInt(stats.total_webhooks) || 0,
        processedWebhooks: parseInt(stats.processed_webhooks) || 0,
        pendingWebhooks: parseInt(stats.pending_webhooks) || 0,
        successfulCruises: parseInt(stats.total_successful) || 0,
        failedCruises: parseInt(stats.total_failed) || 0,
        averageProcessingTimeMs: stats.avg_processing_time ? Math.round(stats.avg_processing_time) : null,
        maxProcessingTimeMs: stats.max_processing_time ? Math.round(stats.max_processing_time) : null
      },
      recentWebhooks: recentWebhooks.map(webhook => ({
        id: webhook.id,
        eventType: webhook.event_type,
        lineId: webhook.line_id,
        processed: webhook.processed,
        successful: webhook.successful_count || 0,
        failed: webhook.failed_count || 0,
        processingTimeMs: webhook.processing_time_ms,
        createdAt: webhook.created_at,
        processedAt: webhook.processed_at,
        description: webhook.description
      })),
      healthStatus: {
        healthy: (parseInt(stats.pending_webhooks) || 0) < 10,
        pendingThreshold: 10,
        avgProcessingOk: !stats.avg_processing_time || stats.avg_processing_time < 60000, // Less than 60s
        processingThreshold: 60000
      }
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error('Error retrieving webhook status', { error });
    res.status(500).json({
      service: 'Traveltek Webhook Status Dashboard',
      error: 'Failed to retrieve status',
      timestamp: new Date().toISOString(),
      details: error instanceof Error ? error.message : 'Unknown error'
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