import { Router, Request, Response } from 'express';
import logger from '../config/logger';
import { db } from '../db/connection';
import { sql } from 'drizzle-orm';

const router = Router();

/**
 * Simple test endpoint to verify webhook service is running
 */
router.get('/traveltek/test-status', async (req: Request, res: Response) => {
  try {
    // Check if system_flags table exists and webhooks are paused
    let webhooksPaused = false;
    let systemFlagsExists = false;

    try {
      const result = await db.execute(sql`
        SELECT value FROM system_flags
        WHERE key = 'webhooks_paused'
        LIMIT 1
      `);

      systemFlagsExists = true;
      if (result.rows && result.rows.length > 0) {
        const flag = result.rows[0] as any;
        webhooksPaused = flag.value === 'true';
      }
    } catch (error) {
      logger.debug('System flags check:', error);
    }

    // Check if webhook_processing_log table exists
    let processingLogExists = false;
    try {
      await db.execute(sql`
        SELECT COUNT(*) FROM webhook_processing_log LIMIT 1
      `);
      processingLogExists = true;
    } catch (error) {
      logger.debug('Processing log check:', error);
    }

    // Check enhanced service status
    const enhancedServiceAvailable = !!require('../services/webhook-enhanced.service').enhancedWebhookService;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        enhancedWebhookService: enhancedServiceAvailable,
        systemFlags: systemFlagsExists,
        processingLog: processingLogExists,
        webhooksPaused,
      },
      deployment: {
        version: process.env.RENDER_GIT_COMMIT || 'unknown',
        deployedAt: process.env.RENDER_DEPLOY_TIME || 'unknown',
      },
      improvements: {
        pricingSnapshots: 'active',
        lineLevelLocking: 'active',
        cruiseCreation: 'active',
        allDataUpdates: 'active',
        noDateLimit: 'active',
        flagClearingFixed: 'active',
      },
    });
  } catch (error) {
    logger.error('Test status error:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Simple webhook echo test
 */
router.post('/traveltek/echo', async (req: Request, res: Response) => {
  const webhookId = `echo_${Date.now()}`;

  logger.info('Echo webhook received', {
    webhookId,
    body: req.body,
  });

  res.json({
    success: true,
    message: 'Echo test successful',
    webhookId,
    received: req.body,
    timestamp: new Date().toISOString(),
  });
});

export default router;
