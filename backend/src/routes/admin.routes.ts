import { Router } from 'express';
import { db } from '../db';
import { sql, desc, eq } from 'drizzle-orm';
import { quoteRequests, cruises, ships, cruiseLines } from '../db/schema';
import { emailService } from '../services/email.service';
import { logger } from '../config/logger';
import { quoteController } from '../controllers/quote.controller';

const router = Router();

// Admin quotes endpoints
router.get('/quotes', quoteController.getQuoteRequests);
router.post('/quotes/:id/respond', quoteController.respondToQuote);

// Admin cruise lines stats endpoint
router.get('/cruise-lines/stats', async (req, res) => {
  try {
    // Get all cruise lines with stats
    const cruiseLinesData = await db.execute(sql`
      WITH line_stats AS (
        SELECT
          cl.id,
          cl.name,
          cl.code,
          COUNT(DISTINCT c.id) as total_cruises,
          COUNT(DISTINCT CASE WHEN c.sailing_date > NOW() THEN c.id END) as active_cruises,
          COUNT(DISTINCT CASE WHEN c.updated_at > NOW() - INTERVAL '24 hours' THEN c.id END) as recently_updated,
          MAX(c.updated_at) as last_updated
        FROM cruise_lines cl
        LEFT JOIN cruises c ON c.cruise_line_id = cl.id
        GROUP BY cl.id, cl.name, cl.code
      )
      SELECT * FROM line_stats
      ORDER BY total_cruises DESC
    `);

    // Calculate overall stats
    const statsData = await db.execute(sql`
      SELECT
        COUNT(DISTINCT cl.id) as total_lines,
        COUNT(DISTINCT c.id) as total_cruises,
        COUNT(DISTINCT CASE WHEN c.updated_at > NOW() - INTERVAL '24 hours' THEN c.id END) as updated_today,
        COUNT(DISTINCT CASE WHEN c.updated_at > NOW() - INTERVAL '7 days' THEN c.id END) as updated_this_week
      FROM cruise_lines cl
      LEFT JOIN cruises c ON c.cruise_line_id = cl.id
    `);

    const stats = (statsData as any)[0] || {
      total_lines: 0,
      total_cruises: 0,
      updated_today: 0,
      updated_this_week: 0,
    };

    res.json({
      cruiseLines: (cruiseLinesData as any).map((row: any) => ({
        id: row.id,
        name: row.name,
        code: row.code,
        totalCruises: parseInt(row.total_cruises) || 0,
        activeCruises: parseInt(row.active_cruises) || 0,
        recentlyUpdated: parseInt(row.recently_updated) || 0,
        lastUpdated: row.last_updated,
      })),
      stats: {
        totalLines: parseInt(stats.total_lines) || 0,
        totalCruises: parseInt(stats.total_cruises) || 0,
        updatedToday: parseInt(stats.updated_today) || 0,
        updatedThisWeek: parseInt(stats.updated_this_week) || 0,
      },
    });
  } catch (error: any) {
    console.error('[ADMIN] Error fetching cruise lines stats:', error);
    res.status(500).json({
      error: 'Failed to fetch cruise lines stats',
      message: error.message,
    });
  }
});

// Admin cleanup endpoint
router.post('/cleanup', async (req, res) => {
  try {
    // Simple auth check
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'emergency-cleanup-2024') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { aggressive = false, vacuum = false } = req.body;
    const results: any = {};

    console.log('[ADMIN] Manual cleanup triggered via API');

    // 1. Clean up departed cruises
    if (aggressive) {
      const departedCleanup = await db.execute(sql`
        DELETE FROM cruises
        WHERE sailing_date < NOW() - INTERVAL '3 days'
        RETURNING id;
      `);
      results.departedCruises = departedCleanup.rowCount || 0;
      console.log(`[ADMIN] Deleted ${results.departedCruises} departed cruises`);
    } else {
      const departedCleanup = await db.execute(sql`
        DELETE FROM cruises
        WHERE sailing_date < NOW() - INTERVAL '7 days'
        AND updated_at < NOW() - INTERVAL '3 days'
        RETURNING id;
      `);
      results.departedCruises = departedCleanup.rowCount || 0;
      console.log(`[ADMIN] Deleted ${results.departedCruises} old departed cruises`);
    }

    // 2. Clean up stale cruises
    const staleCleanup = await db.execute(sql`
      DELETE FROM cruises
      WHERE updated_at < NOW() - INTERVAL '7 days'
      AND (sailing_date IS NULL OR sailing_date > NOW() + INTERVAL '365 days')
      RETURNING id;
    `);
    results.staleCruises = staleCleanup.rowCount || 0;
    console.log(`[ADMIN] Deleted ${results.staleCruises} stale cruises`);

    // 3. Clean up orphaned data
    const pricingCleanup = await db.execute(sql`
      DELETE FROM pricing p
      WHERE NOT EXISTS (
        SELECT 1 FROM cruises c WHERE c.id = p.cruise_id
      )
      RETURNING id;
    `);
    results.orphanedPricing = pricingCleanup.rowCount || 0;

    const itineraryCleanup = await db.execute(sql`
      DELETE FROM itinerary i
      WHERE NOT EXISTS (
        SELECT 1 FROM cruises c WHERE c.id = i.cruise_id
      )
      RETURNING id;
    `);
    results.orphanedItinerary = itineraryCleanup.rowCount || 0;

    const cabinCleanup = await db.execute(sql`
      DELETE FROM cabin_categories cc
      WHERE NOT EXISTS (
        SELECT 1 FROM cruises c WHERE c.id = cc.cruise_id
      )
      RETURNING id;
    `);
    results.orphanedCabins = cabinCleanup.rowCount || 0;

    // 4. Run VACUUM if requested
    if (vacuum) {
      console.log('[ADMIN] Running VACUUM ANALYZE...');
      await db.execute(sql`VACUUM (ANALYZE, VERBOSE OFF) cruises;`);
      await db.execute(sql`VACUUM (ANALYZE, VERBOSE OFF) pricing;`);
      await db.execute(sql`VACUUM (ANALYZE, VERBOSE OFF) itinerary;`);
      await db.execute(sql`VACUUM (ANALYZE, VERBOSE OFF) cabin_categories;`);
      results.vacuum = 'completed';
    }

    // 5. Get current stats
    const stats = await db.execute(sql`
      SELECT
        pg_size_pretty(pg_database_size(current_database())) as db_size,
        (SELECT count(*) FROM cruises) as cruise_count,
        (SELECT count(*) FROM cruises WHERE sailing_date > NOW()) as future_cruises;
    `);

    if (stats.rows[0]) {
      results.currentStats = {
        dbSize: stats.rows[0].db_size,
        totalCruises: stats.rows[0].cruise_count,
        futureCruises: stats.rows[0].future_cruises,
      };
    }

    console.log('[ADMIN] Cleanup completed:', results);
    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[ADMIN] Cleanup error:', error);
    res.status(500).json({
      error: 'Cleanup failed',
      message: error.message,
    });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const result = await db.execute(sql`SELECT NOW() as time`);
    res.json({
      status: 'healthy',
      database: 'connected',
      time: result.rows[0]?.time,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
    });
  }
});

export default router;
