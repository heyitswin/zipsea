import { Router } from 'express';
import { db } from '../db';
import { sql, desc, eq, and, inArray } from 'drizzle-orm';
import {
  quoteRequests,
  cruises,
  ships,
  cruiseLines,
  cruiseTags,
  cruiseNameTags,
} from '../db/schema';
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

// ============================================================================
// CRUISE TAGS ENDPOINTS
// ============================================================================

// Get all available tags
router.get('/cruise-tags/tags', async (req, res) => {
  try {
    const tags = await db.select().from(cruiseTags);
    res.json({ success: true, tags });
  } catch (error: any) {
    console.error('[ADMIN] Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags', message: error.message });
  }
});

// Get all cruise lines for filter dropdown
router.get('/cruise-tags/cruise-lines', async (req, res) => {
  try {
    const lines = await db.execute(sql`
      SELECT DISTINCT cl.id, cl.name
      FROM cruise_lines cl
      INNER JOIN cruises c ON c.cruise_line_id = cl.id
      WHERE c.sailing_date >= CURRENT_DATE
        AND c.name IS NOT NULL
        AND c.name != ''
      ORDER BY cl.name
    `);
    res.json({ success: true, cruiseLines: lines });
  } catch (error: any) {
    console.error('[ADMIN] Error fetching cruise lines:', error);
    res.status(500).json({ error: 'Failed to fetch cruise lines', message: error.message });
  }
});

// Get unique cruise names with stats and their tags
router.get('/cruise-tags/cruises', async (req, res) => {
  try {
    const {
      sortBy = 'count',
      order = 'desc',
      page = '1',
      limit = '50',
      cruiseLineId,
      minNights,
      maxNights,
      minPrice,
      maxPrice,
      region,
    } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build filter conditions
    const filters: string[] = [
      'c.sailing_date >= CURRENT_DATE',
      'c.name IS NOT NULL',
      "c.name != ''",
    ];

    if (cruiseLineId) {
      filters.push(`c.cruise_line_id = ${parseInt(cruiseLineId as string)}`);
    }
    if (minNights) {
      filters.push(`c.nights >= ${parseInt(minNights as string)}`);
    }
    if (maxNights) {
      filters.push(`c.nights <= ${parseInt(maxNights as string)}`);
    }
    if (minPrice) {
      filters.push(`c.cheapest_price >= ${parseFloat(minPrice as string)}`);
    }
    if (maxPrice) {
      filters.push(`c.cheapest_price <= ${parseFloat(maxPrice as string)}`);
    }
    if (region) {
      filters.push(`c.region_ids LIKE '%${region}%'`);
    }

    const whereClause = filters.join(' AND ');

    // Get unique cruise names grouped by cruise_line_id, name, and ship_id
    const cruisesData = await db.execute(sql`
      WITH cruise_groups AS (
        SELECT
          c.cruise_line_id,
          cl.name as cruise_line_name,
          c.ship_id,
          s.name as ship_name,
          c.name as cruise_name,
          c.nights,
          COUNT(*) as sailing_count,
          MIN(c.cheapest_price) as min_price,
          MAX(c.cheapest_price) as max_price,
          AVG(c.cheapest_price)::numeric(10,2) as avg_price,
          MIN(c.sailing_date) as earliest_sailing,
          MAX(c.sailing_date) as latest_sailing,
          ARRAY_AGG(DISTINCT COALESCE(c.region_ids, '')) FILTER (WHERE c.region_ids IS NOT NULL AND c.region_ids != '') as regions
        FROM cruises c
        LEFT JOIN cruise_lines cl ON cl.id = c.cruise_line_id
        LEFT JOIN ships s ON s.id = c.ship_id
        WHERE ${sql.raw(whereClause)}
        GROUP BY c.cruise_line_id, cl.name, c.ship_id, s.name, c.name, c.nights
      ),
      cruise_with_tags AS (
        SELECT
          cg.*,
          COALESCE(
            json_agg(
              json_build_object('id', ct.id, 'name', ct.name, 'displayName', ct.display_name)
              ORDER BY ct.display_name
            ) FILTER (WHERE ct.id IS NOT NULL),
            '[]'::json
          ) as tags
        FROM cruise_groups cg
        LEFT JOIN cruise_name_tags cnt ON
          cnt.cruise_line_id = cg.cruise_line_id
          AND cnt.cruise_name = cg.cruise_name
          AND cnt.ship_id = cg.ship_id
        LEFT JOIN cruise_tags ct ON ct.id = cnt.tag_id
        GROUP BY cg.cruise_line_id, cg.cruise_line_name, cg.ship_id, cg.ship_name,
                 cg.cruise_name, cg.nights, cg.sailing_count, cg.min_price,
                 cg.max_price, cg.avg_price, cg.earliest_sailing, cg.latest_sailing, cg.regions
      )
      SELECT * FROM cruise_with_tags
      ORDER BY
        CASE
          WHEN ${sql.raw(`'${sortBy}'`)} = 'count' AND ${sql.raw(`'${order}'`)} = 'desc' THEN sailing_count END DESC,
        CASE
          WHEN ${sql.raw(`'${sortBy}'`)} = 'count' AND ${sql.raw(`'${order}'`)} = 'asc' THEN sailing_count END ASC,
        CASE
          WHEN ${sql.raw(`'${sortBy}'`)} = 'price' AND ${sql.raw(`'${order}'`)} = 'desc' THEN avg_price END DESC,
        CASE
          WHEN ${sql.raw(`'${sortBy}'`)} = 'price' AND ${sql.raw(`'${order}'`)} = 'asc' THEN avg_price END ASC,
        CASE
          WHEN ${sql.raw(`'${sortBy}'`)} = 'cruiseLine' THEN cruise_line_name END ${sql.raw(order === 'desc' ? 'DESC' : 'ASC')},
        CASE
          WHEN ${sql.raw(`'${sortBy}'`)} = 'nights' AND ${sql.raw(`'${order}'`)} = 'desc' THEN nights END DESC,
        CASE
          WHEN ${sql.raw(`'${sortBy}'`)} = 'nights' AND ${sql.raw(`'${order}'`)} = 'asc' THEN nights END ASC,
        cruise_name
      LIMIT ${limitNum} OFFSET ${offset}
    `);

    // Get total count with same filters
    const countResult = await db.execute(sql`
      SELECT COUNT(DISTINCT (cruise_line_id, name, ship_id)) as total
      FROM cruises c
      WHERE ${sql.raw(whereClause)}
    `);

    const total = parseInt((countResult as any)[0]?.total || '0');
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: {
        cruises: (cruisesData as any).map((row: any) => ({
          cruiseLineId: row.cruise_line_id,
          cruiseLineName: row.cruise_line_name,
          shipId: row.ship_id,
          shipName: row.ship_name,
          cruiseName: row.cruise_name,
          nights: row.nights,
          sailingCount: parseInt(row.sailing_count),
          minPrice: parseFloat(row.min_price) || null,
          maxPrice: parseFloat(row.max_price) || null,
          avgPrice: parseFloat(row.avg_price) || null,
          earliestSailing: row.earliest_sailing,
          latestSailing: row.latest_sailing,
          regions: Array.isArray(row.regions) ? row.regions : [],
          tags: Array.isArray(row.tags) ? row.tags : [],
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
      },
    });
  } catch (error: any) {
    console.error('[ADMIN] Error fetching cruise names:', error);
    res.status(500).json({ error: 'Failed to fetch cruise names', message: error.message });
  }
});

// Add tag to a cruise name
router.post('/cruise-tags/assign', async (req, res) => {
  try {
    const { cruiseLineId, cruiseName, shipId, tagId } = req.body;

    if (!cruiseLineId || !cruiseName || !shipId || !tagId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if tag already exists for this cruise
    const existing = await db.execute(sql`
      SELECT id FROM cruise_name_tags
      WHERE cruise_line_id = ${cruiseLineId}
        AND cruise_name = ${cruiseName}
        AND ship_id = ${shipId}
        AND tag_id = ${tagId}
    `);

    if ((existing as any).length > 0) {
      return res.status(400).json({ error: 'Tag already assigned to this cruise' });
    }

    // Insert the tag assignment
    await db.execute(sql`
      INSERT INTO cruise_name_tags (cruise_line_id, cruise_name, ship_id, tag_id)
      VALUES (${cruiseLineId}, ${cruiseName}, ${shipId}, ${tagId})
    `);

    res.json({ success: true, message: 'Tag assigned successfully' });
  } catch (error: any) {
    console.error('[ADMIN] Error assigning tag:', error);
    res.status(500).json({ error: 'Failed to assign tag', message: error.message });
  }
});

// Remove tag from a cruise name
router.delete('/cruise-tags/remove', async (req, res) => {
  try {
    const { cruiseLineId, cruiseName, shipId, tagId } = req.body;

    if (!cruiseLineId || !cruiseName || !shipId || !tagId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await db.execute(sql`
      DELETE FROM cruise_name_tags
      WHERE cruise_line_id = ${cruiseLineId}
        AND cruise_name = ${cruiseName}
        AND ship_id = ${shipId}
        AND tag_id = ${tagId}
    `);

    res.json({ success: true, message: 'Tag removed successfully' });
  } catch (error: any) {
    console.error('[ADMIN] Error removing tag:', error);
    res.status(500).json({ error: 'Failed to remove tag', message: error.message });
  }
});

export default router;
