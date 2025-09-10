import { Router, Request, Response } from 'express';
import logger from '../config/logger';
import { WebhookProcessorOptimized } from '../services/webhook-processor-optimized.service';
import { WebhookProcessorSimple } from '../services/webhook-processor-simple.service';
import { WebhookProcessorDiscovery } from '../services/webhook-processor-discovery.service';
import { WebhookProcessorCorrect } from '../services/webhook-processor-correct.service';
import { WebhookProcessorFixed } from '../services/webhook-processor-fixed.service';
import { WebhookProcessorMinimal } from '../services/webhook-processor-minimal.service';
import { getWebhookProcessorSimple } from '../services/webhook-processor-simple.service';
import { Client } from 'pg';

const router = Router();

// Lazy-load webhook processor to ensure environment variables are loaded
let webhookProcessor: WebhookProcessorFixed | null = null;

function getWebhookProcessor(): WebhookProcessorFixed {
  if (!webhookProcessor) {
    webhookProcessor = new WebhookProcessorFixed();
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
// List available cruise lines using correct FTP structure
router.get('/traveltek/list-lines', async (req: Request, res: Response) => {
  try {
    console.log('[LIST-LINES] Listing available cruise lines...');

    const processor = new WebhookProcessorCorrect();
    const result = await processor.listAvailableLines();

    res.json({
      success: result.success,
      availableLines: result.lines,
      count: result.lines.length,
      suggestion:
        result.lines.length > 0
          ? `Found ${result.lines.length} lines! Try testing with line ${result.lines[0]}`
          : 'No lines found in current month',
      error: result.error,
    });
  } catch (error) {
    console.error('[LIST-LINES] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list lines',
    });
  }
});

// Discover cruise files for a specific line
router.post('/traveltek/discover-cruises', async (req: Request, res: Response) => {
  const { lineId = 22 } = req.body;

  try {
    console.log(`[DISCOVER-CRUISES] Discovering cruises for line ${lineId}...`);

    const processor = new WebhookProcessorCorrect();
    const result = await processor.discoverCruiseFiles(lineId);

    res.json({
      success: result.success,
      lineId: lineId,
      filesFound: result.files.length,
      files: result.files,
      error: result.error,
    });
  } catch (error) {
    console.error('[DISCOVER-CRUISES] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Discovery failed',
    });
  }
});

// Check FTP data availability
router.get('/traveltek/check-ftp-data', async (req: Request, res: Response) => {
  try {
    console.log('[CHECK-FTP] Checking FTP data availability...');

    const { ftpConnectionPool } = await import('../services/ftp-connection-pool.service');
    const conn = await ftpConnectionPool.getConnection();

    try {
      const dataOverview: any = {
        years: {},
        totalFiles: 0,
        sampleLines: new Set<number>(),
      };

      // Check root directory for years
      const rootItems = await conn.client.list('/');

      for (const item of rootItems) {
        if (item.type === 2 && /^\d{4}$/.test(item.name)) {
          const year = item.name;
          dataOverview.years[year] = { months: [] };

          // Check months in this year
          try {
            const monthItems = await conn.client.list(`/${year}`);

            for (const monthItem of monthItems) {
              if (monthItem.type === 2 && /^\d{2}$/.test(monthItem.name)) {
                const month = monthItem.name;
                const monthPath = `/${year}/${month}`;

                // Count days in this month
                const dayItems = await conn.client.list(monthPath);
                const dayCount = dayItems.filter(d => d.type === 2).length;

                // Sample first day for file count
                let fileCount = 0;
                if (dayCount > 0) {
                  const firstDay = dayItems.find(d => d.type === 2);
                  if (firstDay) {
                    const dayFiles = await conn.client.list(`${monthPath}/${firstDay.name}`);
                    fileCount = dayFiles.filter(
                      f => f.type === 1 && f.name.endsWith('.jsonl')
                    ).length;

                    // Extract some line IDs
                    for (const file of dayFiles.slice(0, 5)) {
                      if (file.name.endsWith('.jsonl')) {
                        const match = file.name.match(/line_(\d+)_/);
                        if (match) {
                          dataOverview.sampleLines.add(parseInt(match[1]));
                        }
                      }
                    }
                  }
                }

                dataOverview.years[year].months.push({
                  month,
                  days: dayCount,
                  filesPerDay: fileCount,
                  estimatedTotalFiles: fileCount * dayCount,
                });

                dataOverview.totalFiles += fileCount * dayCount;
              }
            }
          } catch (error) {
            console.log(`Error checking year ${year}:`, error);
          }
        }
      }

      ftpConnectionPool.releaseConnection(conn.id);

      res.json({
        success: true,
        overview: dataOverview.years,
        totalEstimatedFiles: dataOverview.totalFiles,
        sampleLineIds: Array.from(dataOverview.sampleLines)
          .sort((a: any, b: any) => Number(a) - Number(b))
          .slice(0, 10),
        suggestion:
          dataOverview.sampleLines.size > 0
            ? `Found data! Try line ${Array.from(dataOverview.sampleLines)[0]}`
            : 'No JSONL files found in FTP',
      });
    } catch (error) {
      ftpConnectionPool.releaseConnection(conn.id);
      throw error;
    }
  } catch (error) {
    console.error('[CHECK-FTP] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Check failed',
    });
  }
});

// Check available lines in FTP
router.get('/traveltek/check-lines', async (req: Request, res: Response) => {
  try {
    console.log('[CHECK-LINES] Checking available lines in FTP...');

    const { ftpConnectionPool } = await import('../services/ftp-connection-pool.service');
    const conn = await ftpConnectionPool.getConnection();

    try {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
      const basePath = `/${year}/${month}`;

      const availableLines = new Set<number>();
      const filesByLine: { [key: number]: number } = {};

      // Check first few days
      const dayDirs = await conn.client.list(basePath);

      for (const dayDir of dayDirs.slice(0, 3)) {
        // Check first 3 days
        if (dayDir.type === 2) {
          const dayPath = `${basePath}/${dayDir.name}`;
          const dayFiles = await conn.client.list(dayPath);

          for (const file of dayFiles) {
            if (file.type === 1 && file.name.endsWith('.jsonl')) {
              const match = file.name.match(/line_(\d+)_/);
              if (match) {
                const lineId = parseInt(match[1]);
                availableLines.add(lineId);
                filesByLine[lineId] = (filesByLine[lineId] || 0) + 1;
              }
            }
          }
        }
      }

      ftpConnectionPool.releaseConnection(conn.id);

      res.json({
        success: true,
        path: basePath,
        daysChecked: Math.min(3, dayDirs.length),
        totalDays: dayDirs.length,
        availableLines: Array.from(availableLines).sort((a, b) => a - b),
        filesByLine: filesByLine,
        suggestion:
          availableLines.size > 0
            ? `Try testing with line ${Array.from(availableLines)[0]}`
            : 'No lines found in current month',
      });
    } catch (error) {
      ftpConnectionPool.releaseConnection(conn.id);
      throw error;
    }
  } catch (error) {
    console.error('[CHECK-LINES] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Check failed',
    });
  }
});

// Test file discovery only
router.post('/traveltek/test-discovery', async (req: Request, res: Response) => {
  const { lineId = 22 } = req.body;

  try {
    console.log(`[TEST-DISCOVERY] Testing file discovery for line ${lineId}`);

    const processor = new WebhookProcessorDiscovery();
    const result = await processor.testDiscovery(lineId);

    res.json({
      success: result.success,
      message: result.success ? 'Discovery completed' : 'Discovery failed',
      filesFound: result.files.length,
      files: result.files,
      error: result.error,
    });
  } catch (error) {
    console.error('[TEST-DISCOVERY] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Discovery test failed',
    });
  }
});

// Test with FIXED webhook processor (correct FTP structure)
router.post('/traveltek/test-fixed', async (req: Request, res: Response) => {
  const { lineId = 22 } = req.body;

  try {
    console.log(`[TEST-FIXED] Testing fixed processor for line ${lineId}`);

    // Insert webhook event
    const insertQuery = `
      INSERT INTO webhook_events (line_id, webhook_type, status, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await executeSQL(insertQuery, [
      lineId,
      'test_fixed',
      'processing',
      JSON.stringify({ test: true, lineId, processor: 'fixed' }),
    ]);

    const webhookEvent = result[0];

    // Process with timeout
    try {
      const processor = new WebhookProcessorFixed();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Processing timeout after 180 seconds')), 180000)
      );

      await Promise.race([processor.processWebhooks(lineId), timeoutPromise]);

      // Update status to processed
      await executeSQL('UPDATE webhook_events SET status = $1, processed_at = $2 WHERE id = $3', [
        'processed',
        new Date(),
        webhookEvent.id,
      ]);

      res.json({
        status: 'success',
        message: 'Fixed webhook processor completed',
        eventId: webhookEvent.id,
        lineId: lineId,
      });
    } catch (error) {
      console.error(`[TEST-FIXED] Processing failed:`, error);

      // Update status to failed
      await executeSQL(
        'UPDATE webhook_events SET status = $1, processed_at = $2, error_message = $3 WHERE id = $4',
        [
          'failed',
          new Date(),
          error instanceof Error ? error.message : 'Unknown error',
          webhookEvent.id,
        ]
      );

      res.json({
        status: 'error',
        message: 'Fixed webhook processing failed',
        eventId: webhookEvent.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } catch (error) {
    console.error('[TEST-FIXED] Setup error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to test fixed processor',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Test file discovery only - no processing
router.post('/traveltek/test-discovery-only', async (req: Request, res: Response) => {
  const { lineId = 22 } = req.body;

  try {
    console.log(`[DISCOVERY-ONLY] Testing file discovery for line ${lineId}`);

    const processor = new WebhookProcessorFixed();

    // Temporarily expose discovery method for testing
    const discoveryResult = await (processor as any).discoverFiles(lineId);

    res.json({
      status: 'success',
      message: 'File discovery completed',
      lineId,
      filesFound: discoveryResult?.length || 0,
      files:
        discoveryResult?.slice(0, 10).map((f: any) => ({
          path: f.path,
          name: f.name,
          size: f.size,
        })) || [],
      totalFiles: discoveryResult?.length || 0,
    });
  } catch (error) {
    console.error('[DISCOVERY-ONLY] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'File discovery failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Test processing with limited files
router.post('/traveltek/test-limited', async (req: Request, res: Response) => {
  const { lineId = 22, limit = 5 } = req.body;

  try {
    console.log(`[LIMITED-TEST] Testing processing of ${limit} files for line ${lineId}`);

    // This endpoint needs refactoring - methods are private
    res.status(501).json({
      success: false,
      message: 'This endpoint needs refactoring to work with WebhookProcessorFixed',
    });
    return;

    // const processor = new WebhookProcessorFixed();
    // Code commented out - needs refactoring
  } catch (error) {
    console.error('[LIMITED-TEST] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Limited processing test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Test with simple processor (no queue, direct processing)
router.post('/traveltek/test-simple', async (req: Request, res: Response) => {
  const { lineId = 22 } = req.body;

  try {
    console.log(`[TEST-SIMPLE] Testing simple processor for line ${lineId}`);

    // Insert webhook event
    const insertQuery = `
      INSERT INTO webhook_events (line_id, webhook_type, status, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await executeSQL(insertQuery, [
      lineId,
      'test_simple',
      'processing',
      JSON.stringify({ test: true, lineId, processor: 'simple' }),
    ]);

    const webhookEvent = result[0];

    // Process with timeout
    try {
      const processor = getWebhookProcessorSimple();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Processing timeout after 180 seconds')), 180000)
      );

      await Promise.race([processor.processWebhooks(lineId), timeoutPromise]);

      // Update status to processed
      await executeSQL('UPDATE webhook_events SET status = $1, processed_at = $2 WHERE id = $3', [
        'processed',
        new Date(),
        webhookEvent.id,
      ]);

      res.json({
        status: 'success',
        message: 'Simple webhook processor completed',
        eventId: webhookEvent.id,
        lineId: lineId,
      });
    } catch (error) {
      console.error(`[TEST-SIMPLE] Processing failed:`, error);

      // Update status to failed
      await executeSQL(
        'UPDATE webhook_events SET status = $1, processed_at = $2, error_message = $3 WHERE id = $4',
        [
          'failed',
          new Date(),
          error instanceof Error ? error.message : 'Unknown error',
          webhookEvent.id,
        ]
      );

      res.json({
        status: 'error',
        message: 'Simple webhook processing failed',
        eventId: webhookEvent.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } catch (error) {
    console.error('[TEST-SIMPLE] Setup error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to test simple processor',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Minimal test - just discover files, no processing
router.post('/traveltek/test-minimal', async (req: Request, res: Response) => {
  const { lineId = 22 } = req.body;

  try {
    console.log(`[MINIMAL-TEST] Starting minimal test for line ${lineId}`);
    const startTime = Date.now();

    // Step 1: Try to discover files
    console.log(`[MINIMAL-TEST] Step 1: Discovering files...`);
    const processor = getWebhookProcessorSimple();

    let files;
    try {
      files = await processor.discoverFiles(lineId);
      console.log(
        `[MINIMAL-TEST] Discovery completed in ${Date.now() - startTime}ms, found ${files.length} files`
      );
    } catch (error) {
      console.error(`[MINIMAL-TEST] Discovery failed after ${Date.now() - startTime}ms:`, error);
      return res.json({
        status: 'error',
        message: 'File discovery failed',
        duration: `${Date.now() - startTime}ms`,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Step 2: Try to process just 1 file
    if (files.length > 0) {
      console.log(`[MINIMAL-TEST] Step 2: Processing first file...`);
      const processStart = Date.now();

      try {
        await processor.processFile(files[0]);
        console.log(`[MINIMAL-TEST] File processed in ${Date.now() - processStart}ms`);

        res.json({
          status: 'success',
          message: 'Minimal test completed',
          lineId,
          filesDiscovered: files.length,
          firstFileProcessed: files[0].path,
          discoveryTime: `${processStart - startTime}ms`,
          processingTime: `${Date.now() - processStart}ms`,
          totalTime: `${Date.now() - startTime}ms`,
        });
      } catch (error) {
        console.error(
          `[MINIMAL-TEST] Processing failed after ${Date.now() - processStart}ms:`,
          error
        );
        res.json({
          status: 'partial',
          message: 'Discovery succeeded but processing failed',
          lineId,
          filesDiscovered: files.length,
          discoveryTime: `${processStart - startTime}ms`,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } else {
      res.json({
        status: 'success',
        message: 'No files found',
        lineId,
        filesDiscovered: 0,
        totalTime: `${Date.now() - startTime}ms`,
      });
    }
  } catch (error) {
    console.error('[MINIMAL-TEST] Unexpected error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Minimal test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Test without locks - skip lock management entirely
router.post('/traveltek/test-no-locks', async (req: Request, res: Response) => {
  const { lineId = 22 } = req.body;

  try {
    console.log(`[NO-LOCKS-TEST] Starting test without locks for line ${lineId}`);
    const startTime = Date.now();

    // Get processor
    const processor = getWebhookProcessorSimple();

    // Discover files
    console.log(`[NO-LOCKS-TEST] Discovering files...`);
    const files = await processor.discoverFiles(lineId);
    console.log(`[NO-LOCKS-TEST] Found ${files.length} files in ${Date.now() - startTime}ms`);

    // Process up to 5 files
    const filesToProcess = files.slice(0, 5);
    console.log(`[NO-LOCKS-TEST] Processing ${filesToProcess.length} files...`);

    let processed = 0;
    let failed = 0;

    for (const file of filesToProcess) {
      try {
        const fileStart = Date.now();
        await processor.processFile(file);
        processed++;
        console.log(`[NO-LOCKS-TEST] Processed ${file.path} in ${Date.now() - fileStart}ms`);
      } catch (error) {
        failed++;
        console.error(`[NO-LOCKS-TEST] Failed to process ${file.path}:`, error);
      }
    }

    res.json({
      status: 'success',
      message: 'Test without locks completed',
      lineId,
      filesDiscovered: files.length,
      filesProcessed: processed,
      filesFailed: failed,
      totalTime: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error('[NO-LOCKS-TEST] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Test without locks failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Test webhook synchronously - waits for processing to complete
router.post('/traveltek/test-sync', async (req: Request, res: Response) => {
  try {
    const { lineId = 22 } = req.body;
    console.log(`[TEST-SYNC] Processing webhook for line ${lineId}`);

    // Insert webhook event
    const insertQuery = `
      INSERT INTO webhook_events (line_id, webhook_type, status, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await executeSQL(insertQuery, [
      lineId,
      'test_sync',
      'processing',
      JSON.stringify({ test: true, lineId, sync: true }),
    ]);

    const webhookEvent = result[0];

    // Process synchronously with timeout
    try {
      console.log(`[TEST-SYNC] Calling webhook processor...`);
      const processor = getWebhookProcessor();

      // Add 30 second timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Processing timeout after 30 seconds')), 30000)
      );

      await Promise.race([processor.processWebhooks(lineId), timeoutPromise]);

      // Update status to processed
      await executeSQL('UPDATE webhook_events SET status = $1, processed_at = $2 WHERE id = $3', [
        'processed',
        new Date(),
        webhookEvent.id,
      ]);

      res.json({
        status: 'success',
        message: 'Webhook processed successfully',
        eventId: webhookEvent.id,
        lineId: lineId,
      });
    } catch (error) {
      console.error(`[TEST-SYNC] Processing failed:`, error);

      // Update status to failed
      await executeSQL(
        'UPDATE webhook_events SET status = $1, processed_at = $2, error_message = $3 WHERE id = $4',
        [
          'failed',
          new Date(),
          error instanceof Error ? error.message : 'Unknown error',
          webhookEvent.id,
        ]
      );

      res.json({
        status: 'error',
        message: 'Webhook processing failed',
        eventId: webhookEvent.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } catch (error) {
    console.error('[TEST-SYNC] Setup error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to handle webhook',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// FTP test endpoint - just tests FTP connection
router.get('/traveltek/ftp-test', async (req: Request, res: Response) => {
  try {
    console.log('[FTP-TEST] Testing FTP connection...');

    // Import ftpConnectionPool
    const { ftpConnectionPool } = await import('../services/ftp-connection-pool.service');

    // Try to get a connection
    const conn = await ftpConnectionPool.getConnection();
    console.log(`[FTP-TEST] Got FTP connection: ${conn.id}`);

    // Try to list root directory
    const items = await conn.client.list('/');
    console.log(`[FTP-TEST] Listed root directory: ${items.length} items`);

    // Try to list a specific path
    const testPath = '/2025/09';
    const monthItems = await conn.client.list(testPath);
    console.log(`[FTP-TEST] Listed ${testPath}: ${monthItems.length} items`);

    // Release connection
    ftpConnectionPool.releaseConnection(conn.id);
    console.log('[FTP-TEST] Released connection');

    res.json({
      success: true,
      message: 'FTP connection test successful',
      rootItems: items.length,
      monthItems: monthItems.length,
      testPath: testPath,
    });
  } catch (error) {
    console.error('[FTP-TEST] FTP test failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'FTP test failed',
    });
  }
});

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
      await processor.processWebhooks(lineId);

      // Update status
      await client.query(
        'UPDATE webhook_events SET status = $1, processed_at = $2, error_message = $3 WHERE id = $4',
        ['completed', new Date(), 'Processing completed successfully', webhookEvent.id]
      );

      res.json({
        success: true,
        message: 'Simple test completed',
        webhookId: webhookEvent.id,
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

// Test with minimal processor to isolate FTP issues
router.post('/traveltek/test-minimal-processor', async (req: Request, res: Response) => {
  try {
    const { lineId = 14 } = req.body;
    console.log(`[TEST-MINIMAL] Testing minimal processor for line ${lineId}`);

    const processor = new WebhookProcessorMinimal();
    const result = await processor.processWebhooks(lineId);

    res.json({
      status: 'success',
      ...result,
      lineId,
    });
  } catch (error) {
    console.error('[TEST-MINIMAL] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
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
