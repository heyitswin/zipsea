import { Router, Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { traveltekWebhookService } from '../services/traveltek-webhook.service';

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
  try {
    logger.info('Cruiseline pricing updated webhook received', {
      bodySize: JSON.stringify(req.body).length,
      lineId: req.body.lineId || req.body.line_id,
    });

    // TEMPORARILY PAUSED - Schema recreation in progress
    logger.warn('⏸️ WEBHOOK PAUSED: Schema recreation in progress, skipping processing');
    
    // Acknowledge receipt but don't process
    res.status(200).json({
      success: true,
      message: 'Webhook received (processing paused for maintenance)',
      timestamp: new Date().toISOString(),
      paused: true,
    });
    
    return;

    // Process using new Traveltek webhook service
    // await traveltekWebhookService.handleStaticPricingUpdate(req.body);

    // res.status(200).json({
    //   success: true,
    //   message: 'Cruiseline pricing update processed successfully',
    //   timestamp: new Date().toISOString(),
    // });
  } catch (error) {
    logger.error('Error processing cruiseline pricing webhook', { error });
    // Always return 200 to prevent webhook retries
    res.status(200).json({
      success: false,
      message: 'Webhook received but processing failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/traveltek/cruises-pricing-updated', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Cruises pricing updated webhook received', {
      bodySize: JSON.stringify(req.body).length,
      cruiseId: req.body.cruiseId || req.body.cruise_id,
      cruiseIds: req.body.cruiseIds || req.body.cruise_ids,
    });

    // TEMPORARILY PAUSED - Schema recreation in progress
    logger.warn('⏸️ WEBHOOK PAUSED: Schema recreation in progress, skipping processing');

    res.status(200).json({
      success: true,
      message: 'Webhook received (processing paused for maintenance)',
      timestamp: new Date().toISOString(),
      paused: true,
    });
  } catch (error) {
    logger.error('Error processing cruise pricing webhook', { error });
    // Always return 200 to prevent webhook retries
    res.status(200).json({
      success: false,
      message: 'Webhook received but processing failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Generic Traveltek webhook endpoint (keep for other events)
// Note: Traveltek doesn't send signatures, so no validation needed
router.post('/traveltek', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { body, headers } = req;
    const webhookEvent = body.event || body.event_type || body.type;
    
    logger.info('Traveltek webhook received', {
      event: webhookEvent,
      headers: {
        'user-agent': headers['user-agent'],
        'content-type': headers['content-type'],
      },
      payload: body,
    });

    // TEMPORARILY PAUSED - Schema recreation in progress
    logger.warn('⏸️ WEBHOOK PAUSED: Schema recreation in progress, skipping processing');
    
    res.status(200).json({
      success: true,
      message: 'Webhook received (processing paused for maintenance)',
      timestamp: new Date().toISOString(),
      paused: true,
    });
    
    return;

    // Route to appropriate handler based on event type
    // if (webhookEvent === 'cruiseline_pricing_updated' || body.event === 'cruiseline_pricing_updated') {
    //   // Process static pricing update
    //   await traveltekWebhookService.handleStaticPricingUpdate(body);
    // } else if (webhookEvent === 'cruises_live_pricing_updated' || body.event === 'cruises_live_pricing_updated') {
    //   // Live pricing not currently used
      logger.info('Live pricing webhook acknowledged but not processed', {
        paths: body.paths?.length || 0
      });
    } else {
      logger.warn(`Unknown webhook event type: ${webhookEvent}`);
    }

    // Respond with 200 OK to acknowledge receipt
    res.status(200).json({
      success: true,
      message: 'Webhook received and processed',
      timestamp: new Date().toISOString(),
      event: webhookEvent,
    });

  } catch (error) {
    logger.error('Error processing Traveltek webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Always respond with 200 to prevent webhook retries for processing errors
    // Log the error but don't fail the webhook
    res.status(200).json({
      success: false,
      message: 'Webhook received but processing failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Webhook Health Check
 * Simple endpoint to verify webhook connectivity
 */
router.get('/traveltek/health', (req: Request, res: Response) => {
  res.status(200).json({
    service: 'Traveltek Webhook Endpoint',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    endpoint: req.originalUrl,
  });
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