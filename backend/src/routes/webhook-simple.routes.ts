import { Router, Request, Response } from 'express';
import logger from '../config/logger';

const router = Router();

/**
 * Main webhook endpoint - receives notifications from Traveltek
 * POST /api/webhooks/traveltek
 */
router.post('/traveltek', async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    // Log incoming webhook
    logger.info('📨 Webhook received', {
      event: payload.event,
      lineId: payload.lineid,
      timestamp: new Date().toISOString(),
    });

    // Immediately acknowledge webhook to prevent timeout
    res.status(200).json({
      status: 'accepted',
      message: 'Webhook received and acknowledged',
      timestamp: new Date().toISOString(),
    });

    // TODO: Process webhook when schema tables are created
    logger.info(`Webhook acknowledged for line ${payload.lineid} - processing disabled temporarily`);

  } catch (error) {
    logger.error('Failed to handle webhook:', error);

    // Still return 200 to prevent retries from Traveltek
    if (!res.headersSent) {
      res.status(200).json({
        status: 'error',
        message: 'Webhook received but processing failed',
      });
    }
  }
});

/**
 * Health check endpoint
 * GET /api/webhooks/health
 */
router.get('/health', async (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    message: 'Webhook endpoint is operational',
    timestamp: new Date().toISOString(),
  });
});

export default router;
