import { Router, Request, Response } from 'express';
import { cronService } from '../services/cron.service';
import { logger } from '../config/logger';
import { slackService } from '../services/slack.service';
import { db } from '../db/connection';
import { sql } from 'drizzle-orm';

const router = Router();

/**
 * Admin routes for managing the application
 * These routes should be secured in production
 */

/**
 * Get cron job status
 */
router.get('/cron/status', (req: Request, res: Response) => {
  try {
    const status = cronService.getJobStatus();
    
    res.json({
      success: true,
      data: {
        jobs: status,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get cron status:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get cron job status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * Start a specific cron job
 */
router.post('/cron/start/:jobName', (req: Request, res: Response) => {
  try {
    const { jobName } = req.params;
    const success = cronService.startJob(jobName);
    
    if (success) {
      res.json({
        success: true,
        message: `Job ${jobName} started successfully`,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(404).json({
        success: false,
        error: {
          message: `Job ${jobName} not found`,
        },
      });
    }
  } catch (error) {
    logger.error(`Failed to start job ${req.params.jobName}:`, error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to start cron job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * Stop a specific cron job
 */
router.post('/cron/stop/:jobName', (req: Request, res: Response) => {
  try {
    const { jobName } = req.params;
    const success = cronService.stopJob(jobName);
    
    if (success) {
      res.json({
        success: true,
        message: `Job ${jobName} stopped successfully`,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(404).json({
        success: false,
        error: {
          message: `Job ${jobName} not found`,
        },
      });
    }
  } catch (error) {
    logger.error(`Failed to stop job ${req.params.jobName}:`, error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to stop cron job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * Start all cron jobs
 */
router.post('/cron/start-all', (req: Request, res: Response) => {
  try {
    cronService.startAllJobs();
    
    res.json({
      success: true,
      message: 'All jobs started successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to start all jobs:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to start all cron jobs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * Stop all cron jobs
 */
router.post('/cron/stop-all', (req: Request, res: Response) => {
  try {
    cronService.stopAllJobs();
    
    res.json({
      success: true,
      message: 'All jobs stopped successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to stop all jobs:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to stop all cron jobs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * Manually trigger data sync
 */
router.post('/sync/trigger', async (req: Request, res: Response) => {
  try {
    const { type = 'recent' } = req.body;
    
    if (!['recent', 'daily', 'weekly'].includes(type)) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Invalid sync type',
          details: 'Type must be one of: recent, daily, weekly',
        },
      });
      return;
    }

    // Trigger sync asynchronously
    cronService.triggerDataSync(type).catch(error => {
      logger.error(`Manual ${type} sync failed:`, error);
    });
    
    res.json({
      success: true,
      message: `${type} data sync triggered successfully`,
      type,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to trigger data sync:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to trigger data sync',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * System health check
 */
router.get('/health', (req: Request, res: Response) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  const cronStatus = cronService.getJobStatus();
  
  res.json({
    success: true,
    data: {
      status: 'healthy',
      uptime: `${Math.floor(uptime / 60)} minutes`,
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
        external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100,
        rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100,
      },
      cron: cronStatus,
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * Test Slack integration
 */
router.post('/slack/test', async (req: Request, res: Response) => {
  try {
    const success = await slackService.testConnection();
    
    if (success) {
      res.json({
        success: true,
        message: 'Slack test notification sent successfully',
      });
    } else {
      res.status(503).json({
        success: false,
        error: {
          message: 'Slack notifications not configured',
          details: 'SLACK_WEBHOOK_URL environment variable not set',
        },
      });
    }
  } catch (error) {
    logger.error('Failed to test Slack integration:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to send Slack test notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * Send test webhook notification to Slack
 */
router.post('/slack/test-webhook', async (req: Request, res: Response) => {
  try {
    // Simulate a webhook event
    const testData = {
      eventType: 'test_pricing_update',
      cruiseIds: [344359, 344361],
      timestamp: new Date().toISOString(),
    };
    
    await slackService.notifyCruisePricingUpdate(testData, { 
      successful: 2, 
      failed: 0 
    });
    
    res.json({
      success: true,
      message: 'Test webhook notification sent to Slack',
      data: testData,
    });
  } catch (error) {
    logger.error('Failed to send test webhook notification:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to send test webhook notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * Check cruise lines in database
 */
router.get('/cruise-lines', async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT cl.id, cl.name, cl.code, COUNT(c.id) as cruise_count
      FROM cruise_lines cl
      LEFT JOIN cruises c ON c.cruise_line_id = cl.id
      GROUP BY cl.id, cl.name, cl.code
      ORDER BY cl.id
      LIMIT 100
    `);
    
    res.json({
      success: true,
      count: result.length,
      lines: result
    });
  } catch (error) {
    logger.error('Error fetching cruise lines:', error);
    res.status(500).json({ 
      error: 'Failed to fetch cruise lines',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Check specific cruise details including cruise_line_id
 */
router.get('/cruise-details/:cruiseId', async (req: Request, res: Response) => {
  try {
    const cruiseId = req.params.cruiseId;
    
    const result = await db.execute(sql`
      SELECT c.id, c.cruise_id, c.cruise_line_id, c.name, 
             cl.name as line_name, cl.id as line_table_id
      FROM cruises c
      LEFT JOIN cruise_lines cl ON cl.id = c.cruise_line_id
      WHERE c.id = ${cruiseId} OR c.cruise_id = ${cruiseId}
      LIMIT 1
    `);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Cruise not found' });
    }
    
    res.json({
      success: true,
      cruise: result[0]
    });
  } catch (error) {
    logger.error('Error fetching cruise details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch cruise details',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get active sync locks
 */
router.get('/sync-locks', async (req: Request, res: Response) => {
  try {
    // Check if sync_locks table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sync_locks'
      )
    `);
    
    if (!tableExists || !tableExists[0]?.exists) {
      return res.json({
        message: 'sync_locks table does not exist yet',
        activeLocks: [],
        recentLocks: []
      });
    }
    
    // Get active locks
    const activeLocks = await db.execute(sql`
      SELECT 
        sl.*,
        cl.name as line_name
      FROM sync_locks sl
      LEFT JOIN cruise_lines cl ON cl.id = sl.cruise_line_id
      WHERE sl.status = 'processing'
      ORDER BY sl.locked_at DESC
    `);
    
    // Get recent completed locks
    const recentLocks = await db.execute(sql`
      SELECT 
        sl.*,
        cl.name as line_name,
        EXTRACT(EPOCH FROM (completed_at - locked_at))::INT as duration_seconds
      FROM sync_locks sl
      LEFT JOIN cruise_lines cl ON cl.id = sl.cruise_line_id
      WHERE sl.status != 'processing'
      ORDER BY sl.completed_at DESC
      LIMIT 10
    `);
    
    res.json({
      activeLocks: activeLocks || [],
      recentLocks: recentLocks || [],
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get sync lock status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get pending sync status
 */
router.get('/pending-syncs', async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total_pending,
        COUNT(DISTINCT cruise_line_id) as unique_lines,
        MIN(price_update_requested_at) as oldest_request,
        MAX(price_update_requested_at) as newest_request
      FROM cruises 
      WHERE needs_price_update = true
    `);
    
    const byLine = await db.execute(sql`
      SELECT 
        cruise_line_id,
        COUNT(*) as count,
        MIN(price_update_requested_at) as oldest,
        MAX(price_update_requested_at) as newest
      FROM cruises 
      WHERE needs_price_update = true
      GROUP BY cruise_line_id
      ORDER BY count DESC
      LIMIT 10
    `);

    res.json({
      summary: result && result.length > 0 ? result[0] : { total_pending: 0, unique_lines: 0 },
      byLine: byLine || [],
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get pending sync status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Manually trigger batch sync
 * This endpoint is called by Render cron job every 5 minutes
 */
router.post('/trigger-batch-sync', async (req: Request, res: Response) => {
  try {
    // Import the new V5 service - optimized with timeouts and limits
    const { priceSyncBatchServiceV5 } = require('../services/price-sync-batch-v5.service');
    
    // Check if there are any pending updates before proceeding
    const pendingResult = await db.execute(sql`
      SELECT COUNT(DISTINCT cruise_line_id) as pending_lines
      FROM cruises
      WHERE needs_price_update = true
    `);
    
    const pendingLines = (pendingResult && pendingResult[0]) ? 
      (pendingResult[0].pending_lines || 0) : 0;
    
    if (pendingLines === 0) {
      return res.json({
        message: 'No pending price updates',
        timestamp: new Date(),
        pendingLines: 0
      });
    }
    
    // Return response immediately for Render
    res.json({
      message: 'Batch sync triggered',
      timestamp: new Date(),
      pendingLines
    });
    
    // Run sync in background with V5 service (optimized)
    priceSyncBatchServiceV5.syncBatch()
      .then(result => {
        if (result.totalCruisesUpdated > 0 || result.totalCruisesCreated > 0) {
          logger.info(`✅ Batch sync V5 completed: ${result.totalCruisesCreated} created, ${result.totalCruisesUpdated} updated`);
          
          // Slack notification is sent by V4 service itself
        }
      })
      .catch(error => {
        logger.error('Batch sync failed:', error);
        
        // Send Slack notification for failures
        slackService.notifyCustomMessage({
          title: '❌ Price sync failed',
          message: 'Batch price sync encountered an error',
          details: { error: error.message }
        });
      });
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to trigger sync',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;