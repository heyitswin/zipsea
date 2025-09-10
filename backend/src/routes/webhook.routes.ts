import { Router, Request, Response } from 'express';
import logger from '../config/logger';
import { WebhookProcessorOptimizedV2 } from '../services/webhook-processor-optimized-v2.service';
import { db } from '../db/connection';
import { webhookEvents } from '../db/schema/webhook-events';
import { eq, sql } from 'drizzle-orm';
import { sql as pgSql } from '../db/connection';

const router = Router();

// Lazy-load webhook processor to ensure environment variables are loaded
let webhookProcessor: WebhookProcessorOptimizedV2 | null = null;

function getWebhookProcessor(): WebhookProcessorOptimizedV2 {
  if (!webhookProcessor) {
    webhookProcessor = new WebhookProcessorOptimizedV2();
  }
  return webhookProcessor;
}

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
    // Using raw SQL temporarily due to Drizzle caching issue
    const result = await pgSql`
      INSERT INTO webhook_events (line_id, webhook_type, status, metadata)
      VALUES (${lineId}, ${payload.event || 'update'}, 'pending', ${JSON.stringify(payload)})
      RETURNING *
    `;
    const webhookEvent = result[0];

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
        await getWebhookProcessor().processWebhooks(lineId);

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
    // Using raw SQL temporarily due to Drizzle caching issue
    const result = await pgSql`
      INSERT INTO webhook_events (line_id, webhook_type, status, metadata)
      VALUES (${lineId}, 'test', 'pending', ${JSON.stringify({ test: true, lineId })})
      RETURNING *
    `;
    const webhookEvent = result[0];

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
        await getWebhookProcessor().processWebhooks(lineId);

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
      .orderBy(sql`${webhookEvents.receivedAt} DESC`)
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

/**
 * Debug endpoint - test direct SQL insert
 * GET /api/webhooks/traveltek/debug
 */
router.get('/traveltek/debug', async (req: Request, res: Response) => {
  try {
    // Test what Drizzle is actually generating
    const testInsert = {
      lineId: 99,
      webhookType: 'debug_test',
      status: 'pending',
      metadata: { debug: true, timestamp: new Date().toISOString() },
    };

    // Try the insert
    const [result] = await db.insert(webhookEvents).values(testInsert).returning();

    // Clean up
    await db.delete(webhookEvents).where(eq(webhookEvents.id, result.id));

    res.json({
      status: 'success',
      message: 'Debug insert successful',
      insertedAndDeleted: result,
      testData: testInsert,
    });
  } catch (error) {
    res.json({
      status: 'error',
      message: 'Debug insert failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
});

export default router;
