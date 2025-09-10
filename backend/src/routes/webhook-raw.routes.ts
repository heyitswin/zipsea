import { Router, Request, Response } from 'express';
import logger from '../config/logger';
import { WebhookProcessorOptimized } from '../services/webhook-processor-optimized.service';
import { WebhookProcessorSimple } from '../services/webhook-processor-simple.service';
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

    // Process webhook asynchronously - ensure it actually runs
    console.log(`[WEBHOOK] Scheduling async processing for webhook ${webhookEvent.id}`);

    // Use Promise constructor to ensure async work happens
    Promise.resolve()
      .then(async () => {
        try {
          console.log(
            `[ASYNC] Starting webhook processing for event ${webhookEvent.id}, line ${lineId}`
          );
          const processor = getWebhookProcessor();
          console.log(`[ASYNC] Got processor instance, calling processWebhooks...`);
          await processor.processWebhooks(lineId);
          console.log(`[ASYNC] Webhook processing completed for event ${webhookEvent.id}`);

          // Update webhook status using raw SQL
          const updateQuery = `
          UPDATE webhook_events
          SET status = $1, processed_at = $2
          WHERE id = $3
        `;
          await executeSQL(updateQuery, ['processed', new Date(), webhookEvent.id]);
          console.log(`[ASYNC] Updated webhook event ${webhookEvent.id} to processed`);
        } catch (error) {
          console.error(`[ASYNC] Failed to process webhook event ${webhookEvent.id}:`, error);
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
          console.log(`[ASYNC] Updated webhook event ${webhookEvent.id} to failed`);
        }
      })
      .catch(err => {
        console.error(`[ASYNC] Unhandled error in webhook processing:`, err);
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
 * Fix system_flags table endpoint
 * POST /api/webhooks/traveltek/fix-system-flags
 */
router.post('/traveltek/fix-system-flags', async (req: Request, res: Response) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();

    // Drop and recreate with correct schema
    await client.query('DROP TABLE IF EXISTS system_flags CASCADE');

    await client.query(`
      CREATE TABLE system_flags (
        id SERIAL PRIMARY KEY,
        flag_key VARCHAR(255) UNIQUE NOT NULL,
        flag_value TEXT,
        flag_type VARCHAR(50),
        description TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await client.query('CREATE INDEX idx_system_flags_type ON system_flags(flag_type)');
    await client.query('CREATE INDEX idx_system_flags_key ON system_flags(flag_key)');

    res.json({
      success: true,
      message: 'system_flags table recreated with correct schema',
    });
  } catch (error) {
    console.error('Error fixing system_flags:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fix system_flags',
    });
  } finally {
    await client.end();
  }
});

/**
 * Check sync locks endpoint
 * GET /api/webhooks/traveltek/check-locks
 */
router.get('/traveltek/check-locks', async (req: Request, res: Response) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();

    // Get all locks
    const result = await client.query(`
      SELECT *,
        EXTRACT(EPOCH FROM (NOW() - acquired_at)) as age_seconds,
        CASE
          WHEN is_active = true THEN 'ACTIVE'
          ELSE 'RELEASED'
        END as status
      FROM sync_locks
      ORDER BY id DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      totalLocks: result.rowCount,
      locks: result.rows.map(lock => ({
        ...lock,
        age_minutes: Math.floor(lock.age_seconds / 60),
        is_stale: lock.is_active && lock.age_seconds > 1800, // 30 minutes
      })),
    });
  } catch (error) {
    console.error('Error checking locks:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to check locks',
    });
  } finally {
    await client.end();
  }
});

/**
 * Clear sync locks endpoint
 * POST /api/webhooks/traveltek/clear-locks
 */
router.post('/traveltek/clear-locks', async (req: Request, res: Response) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();

    // Clear all active locks
    const result = await client.query(`
      UPDATE sync_locks
      SET is_active = false, released_at = NOW()
      WHERE is_active = true
      RETURNING *
    `);

    res.json({
      success: true,
      message: `Cleared ${result.rowCount} active locks`,
      clearedLocks: result.rows,
    });
  } catch (error) {
    console.error('Error clearing locks:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to clear locks',
    });
  } finally {
    await client.end();
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
      console.log(
        `[TEST] Starting async processing for webhook ${webhookEvent.id}, line ${lineId}`
      );
      try {
        console.log(`[TEST] Getting webhook processor instance...`);
        const processor = getWebhookProcessor();
        console.log(`[TEST] Calling processWebhooks for line ${lineId}...`);
        await processor.processWebhooks(lineId);
        console.log(`[TEST] processWebhooks completed successfully`);

        const updateQuery = `
          UPDATE webhook_events
          SET status = $1, processed_at = $2
          WHERE id = $3
        `;
        await executeSQL(updateQuery, ['processed', new Date(), webhookEvent.id]);
      } catch (error) {
        console.error(`[TEST] Failed to process webhook ${webhookEvent.id}:`, error);
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
// Simple processing test - uses simplified processor
router.post('/traveltek/simple-test', async (req: Request, res: Response) => {
  const { lineId = 22 } = req.body;
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();

    // Insert webhook event
    const insertResult = await client.query(
      'INSERT INTO webhook_events (line_id, webhook_type, status, metadata) VALUES ($1, $2, $3, $4) RETURNING *',
      [lineId, 'simple_test', 'processing', JSON.stringify({ test: true, lineId })]
    );

    const webhookEvent = insertResult.rows[0];
    console.log(`[SIMPLE-TEST] Created webhook ${webhookEvent.id} for line ${lineId}`);

    // Use simple processor
    try {
      const processor = new WebhookProcessorSimple();
      const result = await processor.processSimple(lineId);

      // Update status
      await client.query(
        'UPDATE webhook_events SET status = $1, processed_at = $2, error_message = $3 WHERE id = $4',
        ['completed', new Date(), result.message, webhookEvent.id]
      );

      res.json({
        success: true,
        message: 'Simple test completed',
        webhookId: webhookEvent.id,
        result: result,
      });
    } catch (processingError) {
      console.error(`[SIMPLE-TEST] Processing failed:`, processingError);

      // Update status to failed
      await client.query(
        'UPDATE webhook_events SET status = $1, processed_at = $2, error_message = $3 WHERE id = $4',
        [
          'failed',
          new Date(),
          processingError instanceof Error ? processingError.message : 'Unknown error',
          webhookEvent.id,
        ]
      );

      res.json({
        success: false,
        message: 'Simple test failed',
        webhookId: webhookEvent.id,
        error: processingError instanceof Error ? processingError.message : 'Unknown error',
      });
    }
  } catch (error) {
    console.error('[SIMPLE-TEST] Setup error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Simple test failed',
    });
  } finally {
    await client.end();
  }
});

// Synchronous processing test - runs webhook processor synchronously
router.post('/traveltek/sync-test', async (req: Request, res: Response) => {
  const { lineId = 22 } = req.body;
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();

    // Insert webhook event
    const insertResult = await client.query(
      'INSERT INTO webhook_events (line_id, webhook_type, status, metadata) VALUES ($1, $2, $3, $4) RETURNING *',
      [lineId, 'sync_test', 'processing', JSON.stringify({ test: true, lineId })]
    );

    const webhookEvent = insertResult.rows[0];
    console.log(`[SYNC-TEST] Created webhook ${webhookEvent.id} for line ${lineId}`);

    // Try to run the processor synchronously
    try {
      console.log(`[SYNC-TEST] Getting processor instance...`);
      const processor = getWebhookProcessor();

      console.log(`[SYNC-TEST] Calling processWebhooks synchronously...`);
      await processor.processWebhooks(lineId);

      console.log(`[SYNC-TEST] Process completed successfully`);

      // Update status
      await client.query('UPDATE webhook_events SET status = $1, processed_at = $2 WHERE id = $3', [
        'completed',
        new Date(),
        webhookEvent.id,
      ]);

      res.json({
        success: true,
        message: 'Synchronous test completed',
        webhookId: webhookEvent.id,
        status: 'completed',
      });
    } catch (processingError) {
      console.error(`[SYNC-TEST] Processing failed:`, processingError);

      // Update status to failed
      await client.query(
        'UPDATE webhook_events SET status = $1, processed_at = $2, error_message = $3 WHERE id = $4',
        [
          'failed',
          new Date(),
          processingError instanceof Error ? processingError.message : 'Unknown error',
          webhookEvent.id,
        ]
      );

      res.json({
        success: false,
        message: 'Synchronous test failed',
        webhookId: webhookEvent.id,
        error: processingError instanceof Error ? processingError.message : 'Unknown error',
      });
    }
  } catch (error) {
    console.error('[SYNC-TEST] Setup error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Sync test failed',
    });
  } finally {
    await client.end();
  }
});

// Direct processing test - bypasses all complex logic
router.post('/traveltek/direct-test', async (req: Request, res: Response) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();

    // Insert webhook event
    const insertResult = await client.query(
      'INSERT INTO webhook_events (line_id, webhook_type, status, metadata) VALUES ($1, $2, $3, $4) RETURNING *',
      [22, 'direct_test', 'processing', JSON.stringify({ test: true, timestamp: new Date() })]
    );

    const webhookEvent = insertResult.rows[0];
    console.log(`Created direct test webhook ${webhookEvent.id}`);

    // Simulate some processing work
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Update to completed
    await client.query(
      'UPDATE webhook_events SET status = $1, processed_at = $2, error_message = $3 WHERE id = $4',
      ['completed', new Date(), 'Direct test completed successfully', webhookEvent.id]
    );

    console.log(`Direct test webhook ${webhookEvent.id} completed`);

    res.json({
      success: true,
      message: 'Direct test completed',
      webhookId: webhookEvent.id,
      status: 'completed',
    });
  } catch (error) {
    console.error('Direct test error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Direct test failed',
    });
  } finally {
    await client.end();
  }
});

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
