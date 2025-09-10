import { Router, Request, Response } from 'express';
import logger from '../config/logger';
import { WebhookProcessorOptimized } from '../services/webhook-processor-optimized.service';
import { db } from '../db/connection';
import { webhookEvents } from '../db/schema/webhook-events';
import { sql as pgSql } from '../db/connection';

const router = Router();

// Create a new instance with explicit pricing extraction
const webhookProcessor = new WebhookProcessorOptimized();

/**
 * Explicit pricing extraction webhook endpoint
 * POST /api/webhooks-pricing/traveltek
 */
router.post('/traveltek', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const lineId = payload.lineId || payload.lineid || 10;

    logger.info('📨 Pricing webhook received', {
      lineId: lineId,
      timestamp: new Date().toISOString(),
    });

    // Store webhook event
    const result = await pgSql`
      INSERT INTO webhook_events (line_id, webhook_type, status, metadata)
      VALUES (${lineId}, 'pricing_extraction', 'pending', ${JSON.stringify(payload)})
      RETURNING *
    `;

    const webhookEvent = result[0];

    // Acknowledge immediately
    res.status(200).json({
      status: 'accepted',
      message: 'Pricing extraction webhook received and queued',
      eventId: webhookEvent.id,
      processor: 'WebhookProcessorOptimized-V3',
      timestamp: new Date().toISOString(),
    });

    // Process asynchronously
    setImmediate(async () => {
      try {
        console.log('[PRICING-WEBHOOK] Starting pricing extraction for line', lineId);
        await webhookProcessor.processWebhooks(lineId);

        // Update status
        await pgSql`
          UPDATE webhook_events
          SET status = 'processed', processed_at = NOW()
          WHERE id = ${webhookEvent.id}
        `;

        console.log('[PRICING-WEBHOOK] Completed pricing extraction for line', lineId);
      } catch (error) {
        logger.error('[PRICING-WEBHOOK] Failed:', error);

        await pgSql`
          UPDATE webhook_events
          SET status = 'failed',
              error_message = ${error instanceof Error ? error.message : 'Unknown error'}
          WHERE id = ${webhookEvent.id}
        `;
      }
    });

  } catch (error) {
    logger.error('Failed to handle pricing webhook:', error);

    if (!res.headersSent) {
      res.status(200).json({
        status: 'error',
        message: 'Webhook received but processing failed',
      });
    }
  }
});

export default router;
