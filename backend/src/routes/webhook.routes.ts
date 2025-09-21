import { Router, Request, Response } from 'express';
import logger from '../config/logger';
import { WebhookProcessorOptimizedV2 } from '../services/webhook-processor-optimized-v2.service';
import { webhookQueueProcessor } from '../services/webhook-queue.service';
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

    // For cruises_live_pricing_updated events, extract lineIds from paths
    let lineIds: number[] = [];

    if (
      payload.event === 'cruises_live_pricing_updated' &&
      payload.paths &&
      Array.isArray(payload.paths)
    ) {
      // Extract unique lineIds from paths (format: year/month/lineId/shipId/cruiseId.json)
      const uniqueLineIds = new Set<number>();

      for (const path of payload.paths) {
        const parts = path.split('/');
        if (parts.length >= 3) {
          const lineId = parseInt(parts[2]);
          if (!isNaN(lineId) && lineId > 0) {
            uniqueLineIds.add(lineId);
          }
        }
      }

      lineIds = Array.from(uniqueLineIds);
      logger.info('📨 Webhook received with pricing updates', {
        event: payload.event,
        lineIds: lineIds,
        pathCount: payload.paths.length,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Try to extract single lineId from various possible fields, default to 0 if not found
      const lineId =
        payload.lineid ||
        payload.lineId ||
        payload.line_id ||
        payload.LineId ||
        payload.LineID ||
        payload.cruiseLineId ||
        payload.cruise_line_id ||
        0; // Default to 0 if no lineId found

      lineIds = [lineId];

      // Log incoming webhook
      logger.info('📨 Webhook received', {
        event: payload.event,
        lineId: lineId,
        timestamp: new Date().toISOString(),
        payloadKeys: Object.keys(payload), // Log payload keys to debug missing lineId
      });

      // Warn if lineId was not found in payload
      if (lineId === 0) {
        logger.warn('⚠️ No lineId found in webhook payload, using default value 0', {
          payloadKeys: Object.keys(payload),
          payload: JSON.stringify(payload).substring(0, 500), // Log first 500 chars of payload
        });
      }
    }

    // Store webhook event in database for each lineId
    const webhookEventIds: number[] = [];

    for (const lineId of lineIds) {
      try {
        if (!pgSql) {
          logger.error('Database connection is not available');
          continue;
        }
        const result = await pgSql`
          INSERT INTO webhook_events (line_id, webhook_type, status, metadata)
          VALUES (${lineId}, ${payload.event || 'update'}, 'pending', ${JSON.stringify(payload)}::jsonb)
          RETURNING id
        `;
        if (result && result.length > 0 && result[0].id) {
          webhookEventIds.push(result[0].id);
          logger.info(`Successfully inserted webhook event ${result[0].id} for lineId ${lineId}`);
        }
      } catch (insertError) {
        logger.error(`Failed to insert webhook event for lineId ${lineId}:`, insertError);
        // Continue with other lineIds even if one fails
      }
    }

    // Immediately acknowledge webhook to prevent timeout
    res.status(200).json({
      status: 'accepted',
      message: 'Webhook received and queued for processing',
      eventIds: webhookEventIds,
      lineIds: lineIds,
      timestamp: new Date().toISOString(),
    });

    // Queue webhook for processing for each lineId
    setImmediate(async () => {
      for (let i = 0; i < lineIds.length; i++) {
        const lineId = lineIds[i];
        const webhookEventId = webhookEventIds[i];

        try {
          // Use V2 processor (the only one we should be using)
          // Pass webhook event ID for status tracking
          const result = await getWebhookProcessor().processWebhooks(lineId, webhookEventId);

          // Update webhook status based on result
          await db
            .update(webhookEvents)
            .set({
              status: result.status === 'queued' ? 'processing' : result.status,
              processedAt: new Date(),
              metadata: {
                ...payload,
                result,
              },
            })
            .where(eq(webhookEvents.id, webhookEventId));

          logger.info(`Webhook ${webhookEventId} for lineId ${lineId} status: ${result.status}`);
        } catch (error) {
          logger.error(`Failed to process webhook for lineId ${lineId}:`, error);

          // Update webhook status to failed
          await db
            .update(webhookEvents)
            .set({
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            })
            .where(eq(webhookEvents.id, webhookEventId));
        }
      }
    });
  } catch (error) {
    logger.error('Failed to handle webhook:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      payload: JSON.stringify(req.body).substring(0, 500),
    });

    // Still return 200 to prevent retries from Traveltek
    if (!res.headersSent) {
      res.status(200).json({
        status: 'error',
        message: 'Webhook received but initial processing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
});

/**
 * Simple test endpoint to check database connectivity
 * GET /api/webhooks/test-db
 */
router.get('/test-db', async (req: Request, res: Response) => {
  try {
    logger.info('Testing database connection for webhook_events');

    // Test if pgSql is available
    if (!pgSql) {
      return res.status(500).json({
        status: 'error',
        message: 'Database connection is not available',
        pgSql: 'null',
      });
    }

    // Try a simple insert
    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
      endpoint: 'test-db',
    };

    const result = await pgSql`
      INSERT INTO webhook_events (line_id, webhook_type, status, metadata)
      VALUES (999, 'test-db', 'test', ${JSON.stringify(testData)}::jsonb)
      RETURNING id, line_id, webhook_type, status
    `;

    logger.info('Test insert successful:', result);

    res.json({
      status: 'success',
      message: 'Database test successful',
      insertedId: result[0]?.id,
      result: result[0],
    });

    // Clean up test record
    if (result[0]?.id) {
      await pgSql`DELETE FROM webhook_events WHERE id = ${result[0].id}`;
    }
  } catch (error) {
    logger.error('Database test failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Database test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
});

/**
 * Test webhook with queue - for testing queue-based processing
 * POST /api/webhooks/traveltek/test-queue
 */
router.post('/traveltek/test-queue', async (req: Request, res: Response) => {
  try {
    const { lineId = 22 } = req.body;

    logger.info('📨 Test webhook with queue triggered', {
      lineId: lineId,
      timestamp: new Date().toISOString(),
    });

    // Store test webhook event
    const result = await pgSql`
      INSERT INTO webhook_events (line_id, webhook_type, status, metadata)
      VALUES (${lineId}, 'test_queue', 'processing', ${JSON.stringify({ test: true, lineId, queue: true })})
      RETURNING *
    `;

    const webhookEvent = result[0];

    // Queue for processing
    try {
      const queueResult = await webhookQueueProcessor.processWebhook(lineId);

      // Update webhook with job info
      await db
        .update(webhookEvents)
        .set({
          status: 'queued',
          metadata: {
            test: true,
            lineId,
            jobIds: queueResult.jobIds,
            queue: true,
          },
        })
        .where(eq(webhookEvents.id, webhookEvent.id));

      res.status(200).json({
        status: 'success',
        message: 'Test webhook queued for processing',
        eventId: webhookEvent.id,
        jobIds: queueResult.jobIds,
        lineId: lineId,
      });
    } catch (queueError) {
      logger.error('Failed to queue test webhook:', queueError);

      // Update webhook status
      await db
        .update(webhookEvents)
        .set({
          status: 'failed',
          errorMessage: queueError instanceof Error ? queueError.message : 'Unknown error',
        })
        .where(eq(webhookEvents.id, webhookEvent.id));

      res.status(500).json({
        status: 'error',
        message: 'Failed to queue test webhook',
        error: queueError instanceof Error ? queueError.message : 'Unknown error',
      });
    }
  } catch (error) {
    logger.error('Failed to handle test webhook:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process test webhook',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Test webhook - directly processes without queue
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
    const result = await pgSql`
      INSERT INTO webhook_events (line_id, webhook_type, status, metadata)
      VALUES (${lineId}, 'test', 'processing', ${JSON.stringify({ test: true, lineId })})
      RETURNING *
    `;

    const webhookEvent = result[0];

    // Process immediately
    try {
      const processingResult = await getWebhookProcessor().processWebhooks(lineId);

      // Update webhook with result
      await db
        .update(webhookEvents)
        .set({
          status: processingResult.status === 'queued' ? 'processing' : processingResult.status,
          processedAt: new Date(),
          metadata: {
            test: true,
            lineId,
            result: processingResult,
          },
        })
        .where(eq(webhookEvents.id, webhookEvent.id));

      res.status(200).json({
        status: 'success',
        message: 'Test webhook processed',
        eventId: webhookEvent.id,
        result: processingResult,
      });
    } catch (processingError) {
      logger.error('Failed to process test webhook:', processingError);

      // Update webhook status
      await db
        .update(webhookEvents)
        .set({
          status: 'failed',
          errorMessage:
            processingError instanceof Error ? processingError.message : 'Unknown error',
        })
        .where(eq(webhookEvents.id, webhookEvent.id));

      res.status(500).json({
        status: 'error',
        message: 'Failed to process test webhook',
        error: processingError instanceof Error ? processingError.message : 'Unknown error',
      });
    }
  } catch (error) {
    logger.error('Failed to handle test webhook:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to handle test webhook',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get webhook event status
 * GET /api/webhooks/status/:eventId
 */
router.get('/status/:eventId', async (req: Request, res: Response) => {
  try {
    const eventId = parseInt(req.params.eventId);

    if (isNaN(eventId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid event ID',
      });
    }

    const event = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.id, eventId))
      .limit(1);

    if (event.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Webhook event not found',
      });
    }

    res.status(200).json({
      status: 'success',
      event: event[0],
    });
  } catch (error) {
    logger.error('Failed to get webhook status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get webhook status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * List recent webhook events
 * GET /api/webhooks/recent
 */
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const events = await db
      .select()
      .from(webhookEvents)
      .orderBy(sql`created_at DESC`)
      .limit(limit)
      .offset(offset);

    res.status(200).json({
      status: 'success',
      events: events,
      limit: limit,
      offset: offset,
    });
  } catch (error) {
    logger.error('Failed to list recent webhooks:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to list recent webhooks',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
