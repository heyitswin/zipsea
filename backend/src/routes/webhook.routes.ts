import { Router, Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { validateWebhookSignature } from '../middleware/validation';

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
 * Webhook URL for registration:
 * - Staging: https://zipsea-staging.onrender.com/api/webhooks/traveltek
 * - Production: https://zipsea.onrender.com/api/webhooks/traveltek
 */
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

    // Process different webhook event types
    switch (webhookEvent) {
      case 'price_update':
        logger.info('Processing price update webhook', { cruiseId: payload.cruise_id });
        // TODO: Implement price update processing
        break;

      case 'availability_change':
        logger.info('Processing availability change webhook', { cruiseId: payload.cruise_id });
        // TODO: Implement availability change processing
        break;

      case 'booking_confirmation':
        logger.info('Processing booking confirmation webhook', { bookingId: payload.booking_id });
        // TODO: Implement booking confirmation processing
        break;

      case 'booking_cancellation':
        logger.info('Processing booking cancellation webhook', { bookingId: payload.booking_id });
        // TODO: Implement booking cancellation processing
        break;

      default:
        logger.warn('Unknown webhook event type received', { event: webhookEvent });
        break;
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