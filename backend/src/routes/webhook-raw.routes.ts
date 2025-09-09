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
        console.log(`Starting webhook processing for event ${webhookEvent.id}, line ${lineId}`);
        await getWebhookProcessor().processWebhooks(lineId);
        console.log(`Webhook processing completed for event ${webhookEvent.id}`);

        // Update webhook status using raw SQL
        const updateQuery = `
          UPDATE webhook_events
          SET status = $1, processed_at = $2
          WHERE id = $3
        `;
        await executeSQL(updateQuery, ['processed', new Date(), webhookEvent.id]);
        console.log(`Updated webhook event ${webhookEvent.id} to processed`);
      } catch (error) {
        console.error(`Failed to process webhook event ${webhookEvent.id}:`, error);
        logger.error('Failed to process webhook:', error);

        // Update webhook status to failed using raw SQL
        const updateQuery = `
          UPDATE webhook_events
          SET status = $1, error_message = $2, processed_at = $3
          WHERE id = $4
        `;
        const errorMessage =
          error instanceof Error ? `${error.message}\n${error.stack}` : 'Unknown error';

        await executeSQL(updateQuery, ['failed', errorMessage, new Date(), webhookEvent.id]);
        console.log(`Updated webhook event ${webhookEvent.id} to failed`);
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

    logger.info('📨 Test webhook triggered (RAW SQL ROUTE)', {
      lineId: lineId,
      timestamp: new Date().toISOString(),
      route: 'webhook-raw.routes.ts',
    });

    // Add immediate response to verify route is hit
    console.log('RAW SQL ROUTE HIT - /traveltek/test');

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
    logger.error('Test webhook failed (RAW SQL):', error);
    console.error('RAW SQL ERROR:', error);
    res.status(500).json({
      status: 'error',
      message: 'Test webhook failed (RAW SQL ROUTE)',
      error: error instanceof Error ? error.message : 'Unknown error',
      route: 'webhook-raw.routes.ts',
      stack: error instanceof Error ? error.stack : undefined,
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

/**
 * Database diagnostic endpoint
 * GET /api/webhooks/traveltek/db-check
 */
router.get('/traveltek/db-check', async (req: Request, res: Response) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();

    // Get database info
    const dbInfo = await client.query('SELECT current_database(), current_user, current_schema()');

    // Check table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'webhook_events'
      )
    `);

    // Get columns if table exists
    let columns = [];
    if (tableCheck.rows[0].exists) {
      const colResult = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'webhook_events'
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      columns = colResult.rows.map(r => r.column_name);
    }

    // Masked DATABASE_URL
    const dbUrl = process.env.DATABASE_URL || 'not set';
    const maskedUrl = dbUrl.replace(/:([^@]+)@/, ':****@');

    res.json({
      status: 'success',
      database: dbInfo.rows[0].current_database,
      user: dbInfo.rows[0].current_user,
      schema: dbInfo.rows[0].current_schema,
      tableExists: tableCheck.rows[0].exists,
      columns: columns,
      hasLineIdColumn: columns.includes('line_id'),
      databaseUrl: maskedUrl,
    });
  } catch (error) {
    res.json({
      status: 'error',
      message: 'Database check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    await client.end();
  }
});

/**
 * Minimal test endpoint - just updates status
 * POST /api/webhooks/traveltek/minimal-test
 */
router.post('/traveltek/minimal-test', async (req: Request, res: Response) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();

    // Insert webhook event
    const insertResult = await client.query(
      'INSERT INTO webhook_events (line_id, webhook_type, status, metadata) VALUES ($1, $2, $3, $4) RETURNING *',
      [99, 'minimal_test', 'pending', JSON.stringify({ test: true })]
    );

    const webhookId = insertResult.rows[0].id;

    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update status to processed
    await client.query('UPDATE webhook_events SET status = $1, processed_at = $2 WHERE id = $3', [
      'processed',
      new Date(),
      webhookId,
    ]);

    res.json({
      status: 'success',
      message: 'Minimal test completed',
      webhookId: webhookId,
      finalStatus: 'processed',
    });
  } catch (error) {
    res.json({
      status: 'error',
      message: 'Minimal test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    await client.end();
  }
});

/**
 * Simple test endpoint - direct SQL without helper
 * GET /api/webhooks/traveltek/simple-test
 */
router.get('/traveltek/simple-test', async (req: Request, res: Response) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();

    const result = await client.query(
      'INSERT INTO webhook_events (line_id, webhook_type, status, metadata) VALUES ($1, $2, $3, $4) RETURNING *',
      [99, 'simple_test', 'pending', JSON.stringify({ test: true, direct: true })]
    );

    // Clean up
    await client.query('DELETE FROM webhook_events WHERE id = $1', [result.rows[0].id]);

    res.json({
      status: 'success',
      message: 'Simple test successful',
      route: 'webhook-raw.routes.ts',
      insertedAndDeleted: result.rows[0],
    });
  } catch (error) {
    res.json({
      status: 'error',
      message: 'Simple test failed',
      route: 'webhook-raw.routes.ts',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    await client.end();
  }
});

export default router;
