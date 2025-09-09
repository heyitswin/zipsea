import { Router, Request, Response } from 'express';
import logger from '../config/logger';
import { WebhookProcessorOptimized } from '../services/webhook-processor-optimized.service';
import { db } from '../db/connection';
import { webhookEvents } from '../db/schema/webhook-events';
import { eq, sql } from 'drizzle-orm';

const router = Router();
const webhookProcessor = new WebhookProcessorOptimized();

/**
 * Main webhook endpoint - receives notifications from Traveltek
 * POST /api/webhooks/traveltek
 */
router.post('/traveltek', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const lineId = payload.lineid || payload.lineId;

    // Log incoming webhook
    logger.info('📨 Webhook received', {
      event: payload.event,
      lineId: lineId,
      timestamp: new Date().toISOString(),
    });

    // Store webhook event in database
    const [webhookEvent] = await db
      .insert(webhookEvents)
      .values({
        eventType: payload.event || 'update',
        lineId: lineId,
        status: 'pending',
        payload: payload,
        metadata: payload,
      })
      .returning();

    // Immediately acknowledge webhook to prevent timeout
    res.status(200).json({
      status: 'accepted',
      message: 'Webhook received and queued for processing',
      eventId: webhookEvent.id,
      timestamp: new Date().toISOString(),
    });

    // Process webhook asynchronously
    setImmediate(async () => {
      try {
        await webhookProcessor.processWebhooks(lineId);

        // Update webhook status
        await db
          .update(webhookEvents)
          .set({
            status: 'processed',
            processedAt: new Date(),
          })
          .where(eq(webhookEvents.id, webhookEvent.id));
      } catch (error) {
        logger.error('Failed to process webhook:', error);

        // Update webhook status to failed
        await db
          .update(webhookEvents)
          .set({
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          })
          .where(eq(webhookEvents.id, webhookEvent.id));
      }
    });
  } catch (error) {
    logger.error('Failed to handle webhook:', error);

    // Still return 200 to prevent retries from Traveltek
    if (!res.headersSent) {
      res.status(200).json({
        status: 'error',
        message: 'Webhook received but initial processing failed',
      });
    }
  }
});

/**
 * Test webhook endpoint - for testing webhook processing
 * POST /api/webhooks/traveltek/test
 */
router.post('/traveltek/test', async (req: Request, res: Response) => {
  try {
    const { lineId = 22 } = req.body;

    logger.info('📨 Test webhook triggered', {
      lineId: lineId,
      timestamp: new Date().toISOString(),
    });

    // Store test webhook event
    const [webhookEvent] = await db
      .insert(webhookEvents)
      .values({
        eventType: 'test',
        lineId: lineId,
        status: 'pending',
        payload: { test: true, lineId },
        metadata: { test: true, lineId },
      })
      .returning();

    res.json({
      status: 'accepted',
      message: 'Test webhook queued for processing',
      eventId: webhookEvent.id,
      lineId: lineId,
      timestamp: new Date().toISOString(),
    });

    // Process test webhook
    setImmediate(async () => {
      try {
        await webhookProcessor.processWebhooks(lineId);

        await db
          .update(webhookEvents)
          .set({
            status: 'processed',
            processedAt: new Date(),
          })
          .where(eq(webhookEvents.id, webhookEvent.id));
      } catch (error) {
        logger.error('Failed to process test webhook:', error);

        await db
          .update(webhookEvents)
          .set({
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          })
          .where(eq(webhookEvents.id, webhookEvent.id));
      }
    });
  } catch (error) {
    logger.error('Test webhook failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Test webhook failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get webhook processing status
 * GET /api/webhooks/traveltek/status
 */
router.get('/traveltek/status', async (req: Request, res: Response) => {
  try {
    // Get recent webhook events
    const recentEvents = await db
      .select()
      .from(webhookEvents)
      .orderBy(sql`${webhookEvents.createdAt} DESC`)
      .limit(10);

    // Get processing stats
    const stats = await db
      .select({
        status: webhookEvents.status,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(webhookEvents)
      .groupBy(webhookEvents.status);

    res.json({
      status: 'operational',
      recentEvents: recentEvents,
      statistics: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get webhook status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve webhook status',
    });
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
