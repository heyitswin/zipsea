/**
 * Webhook Monitoring Dashboard Routes
 * Simple, elegant monitoring for webhook processing
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import logger from '../config/logger';
import redisClient from '../cache/redis';

const router = Router();

// Store webhook events in memory (last 50)
const webhookEvents: any[] = [];
const MAX_EVENTS = 50;

// Store active processing status
const activeProcessing = new Map<string, any>();

/**
 * Main monitoring dashboard endpoint
 * Shows everything you need to know about webhook processing
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const lineId = req.query.lineId ? parseInt(req.query.lineId as string) : null;

    // Get active processing from Redis
    const activeLocks = await getActiveLocks();

    // Get recent webhook events (last hour)
    const recentWebhooks = await getRecentWebhooks(lineId);

    // Get processing stats (last 24 hours)
    const stats = await getProcessingStats(lineId);

    // Get current FTP status
    const ftpStatus = await checkFTPStatus();

    res.json({
      timestamp: new Date().toISOString(),
      status: 'operational',

      // Current activity
      activeProcessing: {
        count: activeLocks.length,
        locks: activeLocks,
        details: activeLocks.map(lock => ({
          lineId: lock.lineId,
          startedAt: lock.startedAt,
          duration: `${Math.round((Date.now() - new Date(lock.startedAt).getTime()) / 1000)}s`
        }))
      },

      // Recent webhooks (what actually happened)
      recentWebhooks: recentWebhooks.map(w => ({
        lineId: w.line_id,
        lineName: w.line_name,
        receivedAt: w.received_at,
        status: w.status,
        cruisesProcessed: w.cruises_processed,
        pricingUpdated: w.pricing_updated,
        duration: w.duration_seconds ? `${w.duration_seconds}s` : 'processing',
        successRate: w.cruises_processed > 0
          ? `${Math.round((w.pricing_updated / w.cruises_processed) * 100)}%`
          : '0%'
      })),

      // Overall stats
      stats: {
        last24Hours: {
          totalWebhooks: stats.total_webhooks,
          totalCruisesUpdated: stats.total_cruises_updated,
          totalPricingUpdated: stats.total_pricing_updated,
          averageProcessingTime: stats.avg_processing_time ? `${Math.round(stats.avg_processing_time)}s` : 'N/A',
          successRate: stats.total_cruises_updated > 0
            ? `${Math.round((stats.total_pricing_updated / stats.total_cruises_updated) * 100)}%`
            : '0%'
        }
      },

      // System health
      health: {
        ftp: ftpStatus,
        redis: activeLocks !== null ? 'connected' : 'disconnected',
        database: 'connected'
      },

      // Quick links
      links: {
        triggerTest: '/api/webhooks/traveltek/test',
        logs: 'https://dashboard.render.com/web/srv-cqcph4lds78s739sl9og/logs',
        clearLocks: '/api/webhooks/traveltek/clear-locks'
      }
    });

  } catch (error) {
    logger.error('Error in webhook monitor:', error);
    res.status(500).json({
      error: 'Failed to get monitoring data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Real-time webhook feed (Server-Sent Events)
 * Connect to this to get live updates as webhooks process
 */
router.get('/live', async (req: Request, res: Response) => {
  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Send updates every 2 seconds
  const interval = setInterval(async () => {
    try {
      const activeLocks = await getActiveLocks();
      const latestWebhook = await getLatestWebhookStatus();

      const update = {
        type: 'update',
        timestamp: new Date().toISOString(),
        activeProcessing: activeLocks.length,
        latestWebhook
      };

      res.write(`data: ${JSON.stringify(update)}\n\n`);
    } catch (error) {
      logger.error('Error sending live update:', error);
    }
  }, 2000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

/**
 * Simple webhook report for a specific line
 * Shows what was ACTUALLY updated
 */
router.get('/report/:lineId', async (req: Request, res: Response) => {
  try {
    const lineId = parseInt(req.params.lineId);
    const hours = parseInt(req.query.hours as string) || 1;

    // Get cruise line info
    const lineInfo = await db.execute(sql`
      SELECT id, name, code
      FROM cruise_lines
      WHERE id = ${lineId}
    `);

    if (lineInfo.length === 0) {
      return res.status(404).json({ error: 'Cruise line not found' });
    }

    // Get actual updates
    const updates = await db.execute(sql`
      SELECT
        COUNT(DISTINCT c.id) as cruises_updated,
        COUNT(DISTINCT cp.cruise_id) as pricing_updated,
        MIN(c.last_traveltek_update) as first_update,
        MAX(c.last_traveltek_update) as last_update,
        COUNT(DISTINCT c.id) FILTER (WHERE cp.cheapest_price IS NOT NULL) as with_valid_pricing,
        MIN(cp.cheapest_price) as min_price,
        AVG(cp.cheapest_price)::decimal(10,2) as avg_price,
        MAX(cp.cheapest_price) as max_price
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE c.cruise_line_id = ${lineId}
        AND c.last_traveltek_update > NOW() - INTERVAL '${hours} hours'
    `);

    // Get sample of actual updated cruises
    const samples = await db.execute(sql`
      SELECT
        c.cruise_id,
        c.name,
        c.sailing_date,
        c.last_traveltek_update,
        cp.cheapest_price,
        cp.interior_price,
        cp.oceanview_price,
        cp.balcony_price,
        cp.suite_price,
        cp.last_updated as pricing_updated
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE c.cruise_line_id = ${lineId}
        AND c.last_traveltek_update > NOW() - INTERVAL '${hours} hours'
      ORDER BY c.last_traveltek_update DESC
      LIMIT 10
    `);

    const report = updates[0] || {};

    res.json({
      lineId,
      lineName: lineInfo[0].name,
      period: `Last ${hours} hour(s)`,

      summary: {
        cruisesUpdated: parseInt(report.cruises_updated) || 0,
        pricingUpdated: parseInt(report.pricing_updated) || 0,
        withValidPricing: parseInt(report.with_valid_pricing) || 0,
        firstUpdate: report.first_update,
        lastUpdate: report.last_update,
        priceRange: {
          min: report.min_price ? `$${report.min_price}` : 'N/A',
          avg: report.avg_price ? `$${report.avg_price}` : 'N/A',
          max: report.max_price ? `$${report.max_price}` : 'N/A'
        }
      },

      samples: samples.map((s: any) => ({
        cruiseId: s.cruise_id,
        name: s.name,
        sailingDate: s.sailing_date,
        updatedAt: s.last_traveltek_update,
        pricing: {
          cheapest: s.cheapest_price ? `$${s.cheapest_price}` : 'N/A',
          interior: s.interior_price ? `$${s.interior_price}` : null,
          oceanview: s.oceanview_price ? `$${s.oceanview_price}` : null,
          balcony: s.balcony_price ? `$${s.balcony_price}` : null,
          suite: s.suite_price ? `$${s.suite_price}` : null,
          lastUpdated: s.pricing_updated
        }
      })),

      status: report.cruises_updated > 0 ? 'success' : 'no_updates'
    });

  } catch (error) {
    logger.error('Error generating report:', error);
    res.status(500).json({
      error: 'Failed to generate report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper functions

async function getActiveLocks() {
  try {
    if (!redisClient) return [];

    const keys = await redisClient.keys('webhook:line:*:lock');
    const locks = [];

    for (const key of keys) {
      const value = await redisClient.get(key);
      const lineId = key.match(/webhook:line:(\d+):lock/)?.[1];
      if (lineId && value) {
        // Try to get additional info from Redis
        const startTime = await redisClient.get(`webhook:${value}:start`);
        locks.push({
          lineId: parseInt(lineId),
          webhookId: value,
          startedAt: startTime || new Date().toISOString()
        });
      }
    }

    return locks;
  } catch (error) {
    logger.error('Error getting active locks:', error);
    return [];
  }
}

async function getRecentWebhooks(lineId?: number | null) {
  try {
    const whereClause = lineId ? sql`WHERE wl.line_id = ${lineId}` : sql``;

    const result = await db.execute(sql`
      WITH webhook_logs AS (
        SELECT DISTINCT ON (line_id)
          line_id,
          MAX(created_at) as received_at,
          'completed' as status
        FROM cruises
        WHERE last_traveltek_update > NOW() - INTERVAL '1 hour'
        GROUP BY line_id
      )
      SELECT
        wl.line_id,
        cl.name as line_name,
        wl.received_at,
        wl.status,
        COUNT(DISTINCT c.id) as cruises_processed,
        COUNT(DISTINCT cp.cruise_id) as pricing_updated,
        EXTRACT(EPOCH FROM (MAX(c.last_traveltek_update) - MIN(c.last_traveltek_update))) as duration_seconds
      FROM webhook_logs wl
      JOIN cruise_lines cl ON cl.id = wl.line_id
      LEFT JOIN cruises c ON c.cruise_line_id = wl.line_id
        AND c.last_traveltek_update >= wl.received_at
      LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
        AND cp.last_updated >= wl.received_at
      ${whereClause}
      GROUP BY wl.line_id, cl.name, wl.received_at, wl.status
      ORDER BY wl.received_at DESC
      LIMIT 10
    `);

    return result;
  } catch (error) {
    logger.error('Error getting recent webhooks:', error);
    return [];
  }
}

async function getProcessingStats(lineId?: number | null) {
  try {
    const whereClause = lineId
      ? sql`WHERE c.cruise_line_id = ${lineId} AND`
      : sql`WHERE`;

    const result = await db.execute(sql`
      SELECT
        COUNT(DISTINCT c.cruise_line_id) as total_webhooks,
        COUNT(DISTINCT c.id) as total_cruises_updated,
        COUNT(DISTINCT cp.cruise_id) as total_pricing_updated,
        AVG(EXTRACT(EPOCH FROM (c.last_traveltek_update - c.updated_at))) as avg_processing_time
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      ${whereClause} c.last_traveltek_update > NOW() - INTERVAL '24 hours'
    `);

    return result[0] || {};
  } catch (error) {
    logger.error('Error getting processing stats:', error);
    return {};
  }
}

async function checkFTPStatus() {
  try {
    if (!process.env.TRAVELTEK_FTP_HOST || !process.env.TRAVELTEK_FTP_USER) {
      return 'not_configured';
    }

    // Try a simple FTP operation
    const { traveltekFTPService } = await import('../services/traveltek-ftp.service');
    await traveltekFTPService.connect();
    await traveltekFTPService.disconnect();
    return 'connected';
  } catch (error) {
    return 'disconnected';
  }
}

async function getLatestWebhookStatus() {
  try {
    const result = await db.execute(sql`
      SELECT
        cl.id as line_id,
        cl.name as line_name,
        COUNT(DISTINCT c.id) as cruises_updating,
        MAX(c.last_traveltek_update) as last_update
      FROM cruises c
      JOIN cruise_lines cl ON cl.id = c.cruise_line_id
      WHERE c.last_traveltek_update > NOW() - INTERVAL '5 minutes'
      GROUP BY cl.id, cl.name
      ORDER BY MAX(c.last_traveltek_update) DESC
      LIMIT 1
    `);

    return result[0] || null;
  } catch (error) {
    return null;
  }
}

export default router;
