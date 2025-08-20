import { Router, Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
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
 * - Cruise Pricing: https://zipsea-backend-staging.onrender.com/api/webhooks/traveltek/cruises-pricing-updated
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

router.post('/traveltek/cruises-pricing-updated', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Cruises pricing updated webhook received', {
      bodySize: JSON.stringify(req.body).length,
      cruiseId: req.body.cruiseId || req.body.cruise_id,
      cruiseIds: req.body.cruiseIds || req.body.cruise_ids,
    });

    // Process pricing update using webhook service
    await webhookService.processCruisePricingUpdate({
      eventType: 'cruises_pricing_updated',
      cruiseId: req.body.cruiseId || req.body.cruise_id,
      cruiseIds: req.body.cruiseIds || req.body.cruise_ids,
      priceData: req.body.priceData || req.body.price_data,
      timestamp: req.body.timestamp,
    });

    res.status(200).json({
      success: true,
      message: 'Cruise pricing update processed successfully',
      timestamp: new Date().toISOString(),
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

    // Route to appropriate handler based on event type
    if (webhookEvent === 'cruiseline_pricing_updated') {
      await webhookService.processCruiselinePricingUpdate({
        eventType: webhookEvent,
        lineId: body.lineid || body.lineId || body.line_id,
        priceData: body.priceData || body.price_data,
        timestamp: body.timestamp,
      });
    } else if (webhookEvent === 'cruises_pricing_updated') {
      await webhookService.processCruisePricingUpdate({
        eventType: webhookEvent,
        cruiseId: body.cruiseId || body.cruise_id,
        cruiseIds: body.cruiseIds || body.cruise_ids || body.paths,
        priceData: body.priceData || body.price_data,
        timestamp: body.timestamp,
      });
    } else {
      // Process other webhook types
      await webhookService.processWebhookEvent(webhookEvent, body);
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