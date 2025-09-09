/**
 * Minimal Webhook Routes - Production Ready
 * Only includes the working production webhook service
 */

import { Router, Request, Response } from 'express';
import logger from '../config/logger';
import { webhookProductionFixService } from '../services/webhook-production-fix.service';
import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import redisClient from '../cache/redis';

const router = Router();

// Main Traveltek webhook endpoint
router.post('/traveltek/cruiseline-pricing-updated', async (req: Request, res: Response) => {
  const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const receivedAt = new Date().toISOString();

  try {
    const payload = req.body;
    const lineId = payload.lineid || payload.lineId || payload.line_id;

    logger.info('🚀 Webhook received', {
      webhookId,
      receivedAt,
      lineId,
      event: payload.event,
    });

    // Return success immediately to prevent webhook timeout
    res.status(200).json({
      success: true,
      message: 'Webhook received and queued for processing',
      timestamp: receivedAt,
      webhookId,
      lineId,
      processingMode: 'production_sequential',
    });

    // Process asynchronously with production service
    webhookProductionFixService
      .processWebhook(lineId)
      .then(result => {
        logger.info('✅ Webhook processing completed', {
          webhookId,
          lineId,
          result,
        });
      })
      .catch(error => {
        logger.error('❌ Webhook processing failed', {
          webhookId,
          lineId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

  } catch (error) {
    logger.error('❌ Error in webhook handler', {
      webhookId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Still return 200 to prevent retries
    res.status(200).json({
      success: false,
      message: 'Webhook received but processing failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: receivedAt,
      webhookId,
    });
  }
});

// Generic Traveltek webhook endpoint
router.post('/traveltek', async (req: Request, res: Response) => {
  const webhookId = `generic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    const body = req.body;
    const webhookEvent = body.event || 'unknown';

    if (webhookEvent === 'cruiseline_pricing_updated') {
      const lineId = body.lineid || body.lineId || body.line_id;

      logger.info('📝 Static pricing webhook received', {
        webhookId,
        lineId,
        event: webhookEvent,
      });

      res.status(200).json({
        success: true,
        message: 'Webhook received and queued for processing',
        timestamp: new Date().toISOString(),
        event: webhookEvent,
        webhookId,
        lineId,
        processingMode: 'production_sequential',
      });

      // Process with production service
      webhookProductionFixService
        .processWebhook(lineId)
        .then(result => {
          logger.info('✅ Processing completed', {
            webhookId,
            lineId,
            result,
          });
        })
        .catch(error => {
          logger.error('❌ Processing failed', {
            webhookId,
            lineId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });

    } else {
      // Acknowledge but don't process other events
      logger.info(`⚠️ Unknown webhook event: ${webhookEvent}`, {
        webhookId,
        event: webhookEvent,
      });

      res.status(200).json({
        success: true,
        message: `Event '${webhookEvent}' acknowledged`,
        timestamp: new Date().toISOString(),
        event: webhookEvent,
        webhookId,
      });
    }

  } catch (error) {
    logger.error('❌ Error processing webhook', {
      webhookId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(200).json({
      success: false,
      message: 'Webhook received but processing failed',
      timestamp: new Date().toISOString(),
      webhookId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Test endpoint
router.post('/traveltek/test', async (req: Request, res: Response) => {
  const webhookId = `test_${Date.now()}`;
  const testLineId = req.body.lineId || 21; // Default to Crystal

  try {
    logger.info('🧪 Test webhook triggered', {
      webhookId,
      lineId: testLineId,
    });

    res.status(200).json({
      success: true,
      message: 'Test webhook accepted',
      webhookId,
      lineId: testLineId,
      timestamp: new Date().toISOString(),
    });

    // Process with production service
    webhookProductionFixService
      .processWebhook(testLineId)
      .then(result => {
        logger.info('✅ Test completed', {
          webhookId,
          lineId: testLineId,
          result,
        });
      })
      .catch(error => {
        logger.error('❌ Test failed', {
          webhookId,
          lineId: testLineId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

  } catch (error) {
    logger.error('❌ Test webhook error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Diagnostics endpoint
router.get('/traveltek/diagnostics', async (req: Request, res: Response) => {
  try {
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      ftpConfig: {
        host: process.env.TRAVELTEK_FTP_HOST || 'not configured',
        user: process.env.TRAVELTEK_FTP_USER ? 'SET' : 'NOT SET',
        hasPassword: !!process.env.TRAVELTEK_FTP_PASSWORD,
      },
      redisStatus: 'unknown',
      activeLocks: 0,
    };

    // Check Redis
    try {
      await redisClient.ping();
      diagnostics.redisStatus = 'connected';

      // Check for locks
      const keys = await redisClient.keys('webhook:lock:*');
      diagnostics.activeLocks = keys.length;
    } catch (redisError) {
      diagnostics.redisStatus = 'disconnected';
      diagnostics.redisError = redisError instanceof Error ? redisError.message : 'Unknown error';
    }

    // Check FTP
    if (process.env.TRAVELTEK_FTP_USER && process.env.TRAVELTEK_FTP_PASSWORD) {
      diagnostics.ftpConnection = 'configured';
    } else {
      diagnostics.ftpConnection = 'not configured';
    }

    res.json({
      success: true,
      diagnostics,
    });

  } catch (error) {
    logger.error('Error in diagnostics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Clear locks endpoint
router.post('/traveltek/clear-locks', async (req: Request, res: Response) => {
  try {
    const keys = await redisClient.keys('webhook:lock:*');
    const cleared = [];

    for (const key of keys) {
      const value = await redisClient.get(key);
      await redisClient.del(key);
      const lineId = key.split(':').pop();
      cleared.push({ lineId, webhookId: value });
    }

    res.json({
      success: true,
      message: `Cleared ${cleared.length} webhook lock(s)`,
      cleared,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Error clearing locks:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// FTP status endpoint
router.get('/traveltek/ftp-status', async (req: Request, res: Response) => {
  try {
    const ftpConfig = {
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER ? `${process.env.TRAVELTEK_FTP_USER.substring(0, 3)}***` : 'NOT SET',
      hasPassword: !!process.env.TRAVELTEK_FTP_PASSWORD,
      environment: process.env.NODE_ENV || 'unknown',
    };

    let connectionStatus = 'unknown';
    let recommendation = '';

    if (!process.env.TRAVELTEK_FTP_USER || !process.env.TRAVELTEK_FTP_PASSWORD) {
      connectionStatus = 'not configured';
      recommendation = 'FTP credentials not found in environment variables';
    } else {
      connectionStatus = 'configured';
      recommendation = 'FTP is properly configured';
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ftpConfig,
      connectionStatus,
      recommendation,
    });

  } catch (error) {
    logger.error('Error checking FTP status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
