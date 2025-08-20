import { Router, Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { validateWebhookSignature } from '../middleware/validation';
import { webhookService } from '../services/webhook.service';

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
 * Webhook URLs for Traveltek registration:
 * - Cruiseline Pricing: https://zipsea-backend-staging.onrender.com/api/webhooks/traveltek/cruiseline-pricing-updated
 * - Live Pricing: https://zipsea-backend-staging.onrender.com/api/webhooks/traveltek/cruises-live-pricing-updated
 * - Generic Events: https://zipsea-backend-staging.onrender.com/api/webhooks/traveltek
 */
// Specific Traveltek webhook endpoints as per their documentation
router.post('/traveltek/cruiseline-pricing-updated', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Cruiseline pricing updated webhook received', {
      bodySize: JSON.stringify(req.body).length,
      lineId: req.body.lineId || req.body.line_id,
    });

    // Process cruiseline pricing update using webhook service
    await webhookService.processCruiselinePricingUpdate({
      eventType: 'cruiseline_pricing_updated',
      lineId: req.body.lineId || req.body.line_id,
      priceData: req.body.priceData || req.body.price_data,
      timestamp: req.body.timestamp,
    });

    res.status(200).json({
      success: true,
      message: 'Cruiseline pricing update processed successfully',
      timestamp: new Date().toISOString(),
    });
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

router.post('/traveltek/cruises-live-pricing-updated', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Cruises live pricing updated webhook received', {
      bodySize: JSON.stringify(req.body).length,
      cruiseId: req.body.cruiseId || req.body.cruise_id,
      cruiseIds: req.body.cruiseIds || req.body.cruise_ids,
    });

    // Process live pricing update using webhook service
    await webhookService.processLivePricingUpdate({
      eventType: 'cruises_live_pricing_updated',
      cruiseId: req.body.cruiseId || req.body.cruise_id,
      cruiseIds: req.body.cruiseIds || req.body.cruise_ids,
      priceData: req.body.priceData || req.body.price_data,
      timestamp: req.body.timestamp,
    });

    res.status(200).json({
      success: true,
      message: 'Live pricing update processed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error processing live pricing webhook', { error });
    // Always return 200 to prevent webhook retries
    res.status(200).json({
      success: false,
      message: 'Webhook received but processing failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Generic Traveltek webhook endpoint (keep for other events)
router.post('/traveltek', validateWebhookSignature, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { body, headers } = req;
    const webhookEvent = body.event_type || body.type;
    const payload = body.data || body;

    logger.info('Traveltek webhook received', {
      event: webhookEvent,
      headers: {
        'user-agent': headers['user-agent'],
        'content-type': headers['content-type'],
        'x-webhook-signature': headers['x-webhook-signature'] ? 'present' : 'missing',
      },
      payloadSize: JSON.stringify(payload).length,
    });

    // Process different webhook event types using webhook service
    await webhookService.processWebhookEvent(webhookEvent, payload);

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