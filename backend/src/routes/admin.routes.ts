import { Router, Request, Response } from 'express';
import { cronService } from '../services/cron.service';
import { logger } from '../config/logger';

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

export default router;