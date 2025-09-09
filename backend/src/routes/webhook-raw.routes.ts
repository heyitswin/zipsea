import { Router, Request, Response } from 'express';
import logger from '../config/logger';
import { WebhookProcessorOptimized } from '../services/webhook-processor-optimized.service';
import { Client } from 'pg';

const router = Router();

// Lazy-load webhook processor to ensure environment variables are loaded
let webhookProcessor: WebhookProcessorOptimized | null = null;

function getWebhookProcessor(): WebhookProcessorOptimized {
  if (!webhookProcessor) {
    webhookProcessor = new WebhookProcessorOptimized();
  }
  return webhookProcessor;
}

// Helper function to execute raw SQL
async function executeSQL(query: string, params: any[]): Promise<any> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    await client.end();
  }
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

    // Store webhook event in database using raw SQL
    const insertQuery = `
      INSERT INTO webhook_events (line_id, webhook_type, status, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await executeSQL(insertQuery, [
      lineId,
      payload.event || 'update',
      'pending',
      JSON.stringify(payload),
    ]);

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

        // Update webhook status using raw SQL
        const updateQuery = `
          UPDATE webhook_events
          SET status = $1, processed_at = $2
          WHERE id = $3
        `;
        await executeSQL(updateQuery, ['processed', new Date(), webhookEvent.id]);
      } catch (error) {
        logger.error('Failed to process webhook:', error);

        // Update webhook status to failed using raw SQL
        const updateQuery = `
          UPDATE webhook_events
          SET status = $1, error_message = $2
          WHERE id = $3
        `;
        await executeSQL(updateQuery, [
          'failed',
          error instanceof Error ? error.message : 'Unknown error',
          webhookEvent.id,
        ]);
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

    // Store test webhook event using raw SQL
    const insertQuery = `
      INSERT INTO webhook_events (line_id, webhook_type, status, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await executeSQL(insertQuery, [
      lineId,
      'test',
      'pending',
      JSON.stringify({ test: true, lineId }),
    ]);

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

        const updateQuery = `
          UPDATE webhook_events
          SET status = $1, processed_at = $2
          WHERE id = $3
        `;
        await executeSQL(updateQuery, ['processed', new Date(), webhookEvent.id]);
      } catch (error) {
        logger.error('Failed to process test webhook:', error);

        const updateQuery = `
          UPDATE webhook_events
          SET status = $1, error_message = $2
          WHERE id = $3
        `;
        await executeSQL(updateQuery, [
          'failed',
          error instanceof Error ? error.message : 'Unknown error',
          webhookEvent.id,
        ]);
      }
    });
  } catch (error) {
    logger.error('Test webhook failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Test webhook failed (RAW SQL)',
      error: error instanceof Error ? error.message : 'Unknown error',
      route: 'webhook-raw.routes.ts',
    });
  }
});

/**
 * Get webhook processing status
 * GET /api/webhooks/traveltek/status
 */
router.get('/traveltek/status', async (req: Request, res: Response) => {
  try {
    // Get recent webhook events using raw SQL
    const recentQuery = `
      SELECT * FROM webhook_events
      ORDER BY received_at DESC
      LIMIT 10
    `;
    const recentEvents = await executeSQL(recentQuery, []);

    // Get processing stats using raw SQL
    const statsQuery = `
      SELECT status, COUNT(*)::int as count
      FROM webhook_events
      GROUP BY status
    `;
    const stats = await executeSQL(statsQuery, []);

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
    message: 'Webhook endpoint is operational (raw SQL mode)',
    timestamp: new Date().toISOString(),
  });
});

export default router;
