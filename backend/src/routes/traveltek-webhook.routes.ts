import { Router, Request, Response } from 'express';
import { traveltekWebhookService } from '../services/traveltek-webhook.service';
import logger from '../config/logger';

const router = Router();

/**
 * Traveltek Webhook Endpoint
 * Handles static pricing updates only (cruiseline_pricing_updated)
 * 
 * Expected payload format:
 * {
 *   "event": "cruiseline_pricing_updated",
 *   "lineid": 123,
 *   "marketid": 0,
 *   "currency": "GBP",
 *   "description": "Cruiseline pricing data updated for marketid 0 in currency GBP",
 *   "source": "json_cruise_export",
 *   "timestamp": 1747822246
 * }
 */
router.post('/webhook/traveltek', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const payload = req.body;
    
    // Log incoming webhook
    logger.info('Received Traveltek webhook', {
      event: payload.event,
      lineid: payload.lineid,
      marketid: payload.marketid,
      currency: payload.currency
    });
    
    // Validate webhook type
    if (!payload.event) {
      logger.warn('Webhook missing event type');
      return res.status(400).json({ 
        error: 'Missing event type' 
      });
    }
    
    // We only process static pricing updates
    if (payload.event === 'cruiseline_pricing_updated') {
      // Process static pricing update asynchronously
      // Return 200 immediately to acknowledge receipt
      res.status(200).json({ 
        status: 'accepted',
        message: 'Static pricing update webhook received' 
      });
      
      // Process in background
      traveltekWebhookService.handleStaticPricingUpdate(payload)
        .then(() => {
          logger.info(`Static pricing update completed for line ${payload.lineid} in ${Date.now() - startTime}ms`);
        })
        .catch(error => {
          logger.error('Error processing static pricing webhook:', error);
        });
        
    } else if (payload.event === 'cruises_live_pricing_updated') {
      // Live pricing webhook - not currently used
      logger.info('Received live pricing webhook (not processed)', {
        paths: payload.paths?.length || 0
      });
      
      return res.status(200).json({ 
        status: 'acknowledged',
        message: 'Live pricing webhook received but not processed (only static pricing is enabled)' 
      });
      
    } else {
      logger.warn(`Unknown webhook event type: ${payload.event}`);
      return res.status(400).json({ 
        error: `Unknown event type: ${payload.event}` 
      });
    }
    
  } catch (error) {
    logger.error('Webhook processing error:', error);
    
    // Return 200 anyway to prevent retries
    // Log the error for investigation
    res.status(200).json({ 
      status: 'error_logged',
      message: 'Webhook received but error occurred - check logs' 
    });
  }
});

/**
 * Get webhook processing status
 */
router.get('/webhook/traveltek/status', async (req: Request, res: Response) => {
  try {
    const { db } = require('../db/connection');
    const { sql } = require('drizzle-orm');
    
    // Get recent webhook events
    const recentEvents = await db.execute(sql`
      SELECT 
        id,
        event_type,
        line_id,
        market_id,
        currency,
        processed,
        processed_at,
        created_at
      FROM webhook_events
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    // Get processing stats
    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE processed = true) as processed_count,
        COUNT(*) FILTER (WHERE processed = false) as pending_count,
        COUNT(*) as total_count,
        MAX(created_at) as last_received,
        MAX(processed_at) as last_processed
      FROM webhook_events
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    `);
    
    res.json({
      status: 'active',
      webhook_url: `${process.env.BASE_URL || 'https://zipsea-backend.onrender.com'}/api/webhook/traveltek`,
      supported_events: ['cruiseline_pricing_updated'],
      stats: stats.rows[0],
      recent_events: recentEvents.rows
    });
    
  } catch (error) {
    logger.error('Error getting webhook status:', error);
    res.status(500).json({ error: 'Failed to get webhook status' });
  }
});

/**
 * Test webhook endpoint (for debugging)
 */
router.post('/webhook/traveltek/test', async (req: Request, res: Response) => {
  const testPayload = {
    event: 'cruiseline_pricing_updated',
    lineid: 7,  // Test with a known cruise line
    marketid: 0,
    currency: 'USD',
    description: 'Test webhook - cruiseline pricing data updated',
    source: 'test',
    timestamp: Math.floor(Date.now() / 1000)
  };
  
  logger.info('Processing test webhook');
  
  try {
    await traveltekWebhookService.handleStaticPricingUpdate(testPayload);
    res.json({
      status: 'success',
      message: 'Test webhook processed successfully',
      payload: testPayload
    });
  } catch (error) {
    logger.error('Test webhook error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Test webhook failed',
      error: error.message
    });
  }
});

export default router;