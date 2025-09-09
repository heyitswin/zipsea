import { Router, Request, Response } from 'express';
import { webhookProcessorOptimized } from '../services/webhook-processor-optimized.service';
import { ftpConnectionPool } from '../services/ftp-connection-pool.service';
import { slackService } from '../services/slack-enhanced.service';
import logger from '../config/logger';
import { db } from '../db/connection';
import { webhookEvents, systemFlags } from '../db/schema';
import { desc, eq } from 'drizzle-orm';

const router = Router();

/**
 * Main webhook endpoint - receives notifications from Traveltek
 * POST /api/webhooks/traveltek
 */
router.post('/traveltek', async (req: Request, res: Response) => {
  const startTime = Date.now();

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
      message: 'Webhook received and queued for processing',
      timestamp: new Date().toISOString(),
    });

    // Process webhook asynchronously
    webhookProcessorOptimized.handleWebhook(payload)
      .then(() => {
        logger.info(`✅ Webhook processing initiated for line ${payload.lineid}`);
      })
      .catch(error => {
        logger.error(`❌ Webhook processing failed for line ${payload.lineid}:`, error);
        slackService.notifySyncError(
          error.message,
          `Failed to process webhook for line ${payload.lineid}`
        );
      });

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
 * Test webhook endpoint - for testing the processing flow
 * POST /api/webhooks/traveltek/test
 */
router.post('/traveltek/test', async (req: Request, res: Response) => {
  try {
    const testPayload = {
      event: 'cruiseline_pricing_updated',
      lineid: req.body.lineid || 16,
      currency: 'USD',
      marketid: 1,
      source: 'test',
      description: 'Test webhook trigger',
      timestamp: Date.now(),
    };

    logger.info('🧪 Test webhook triggered', testPayload);

    // Process webhook
    await webhookProcessorOptimized.handleWebhook(testPayload);

    res.json({
      status: 'success',
      message: 'Test webhook processing started',
      payload: testPayload,
    });

  } catch (error) {
    logger.error('Test webhook failed:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

/**
 * Get webhook processing status
 * GET /api/webhooks/status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    // Get recent webhook events
    const recentEvents = await db.select()
      .from(webhookEvents)
      .orderBy(desc(webhookEvents.createdAt))
      .limit(10);

    // Get FTP pool stats
    const poolStats = ftpConnectionPool.getStats();

    // Get processing flags
    const flags = await db.select()
      .from(systemFlags)
      .where(eq(systemFlags.flagType, 'webhook_processing'));

    res.json({
      status: 'operational',
      ftpPool: poolStats,
      recentWebhooks: recentEvents.map(e => ({
        id: e.id,
        event: e.eventType,
        lineId: e.lineId,
        status: e.status,
        createdAt: e.createdAt,
        processedAt: e.processedAt,
      })),
      activeProcessing: flags.filter(f => f.value === 'true').map(f => f.key),
    });

  } catch (error) {
    logger.error('Failed to get webhook status:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

/**
 * Manually trigger processing for a specific line
 * POST /api/webhooks/process/:lineId
 */
router.post('/process/:lineId', async (req: Request, res: Response) => {
  try {
    const lineId = parseInt(req.params.lineId);

    if (isNaN(lineId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid line ID',
      });
    }

    logger.info(`🔧 Manual processing triggered for line ${lineId}`);

    const payload = {
      event: 'manual_trigger',
      lineid: lineId,
      currency: 'USD',
      marketid: 1,
      source: 'manual',
      description: 'Manual processing trigger',
      timestamp: Date.now(),
    };

    // Process webhook
    webhookProcessorOptimized.handleWebhook(payload)
      .then(() => {
        logger.info(`✅ Manual processing initiated for line ${lineId}`);
      })
      .catch(error => {
        logger.error(`❌ Manual processing failed for line ${lineId}:`, error);
      });

    res.json({
      status: 'success',
      message: `Processing started for line ${lineId}`,
    });

  } catch (error) {
    logger.error('Manual processing failed:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

/**
 * Get FTP connection pool statistics
 * GET /api/webhooks/pool-stats
 */
router.get('/pool-stats', async (req: Request, res: Response) => {
  try {
    const stats = ftpConnectionPool.getStats();

    res.json({
      status: 'success',
      pool: stats,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Failed to get pool stats:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

/**
 * Health check endpoint
 * GET /api/webhooks/health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const poolStats = ftpConnectionPool.getStats();

    res.json({
      status: 'healthy',
      ftpPool: {
        available: poolStats.idle > 0,
        connections: poolStats.total,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

export default router;
