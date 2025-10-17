/**
 * Admin endpoint to sync staging database from production
 * POST /api/admin/sync-from-production
 */

import { Router } from 'express';
import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import logger from '../config/logger';
import postgres from 'postgres';

const router = Router();

router.post('/sync-from-production', async (req, res) => {
  const startTime = Date.now();

  try {
    // Only allow in staging
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Not allowed in production' });
    }

    const prodUrl = process.env.DATABASE_URL_PRODUCTION;
    if (!prodUrl) {
      return res.status(500).json({ error: 'Production database URL not configured' });
    }

    logger.info('Starting production to staging sync via API...');

    const prod = postgres(prodUrl, { max: 3, ssl: 'require' });

    // Get counts
    const [prodResult] = await prod`SELECT COUNT(*)::int as count FROM cruises`;
    const prodCount = prodResult.count;

    logger.info(`Production has ${prodCount} cruises`);

    // Truncate staging
    await db.execute(sql`TRUNCATE TABLE cruises CASCADE`);
    logger.info('Truncated staging cruises');

    // Copy in batches
    const batchSize = 500;
    let copied = 0;

    while (copied < prodCount) {
      const batch = await prod`
        SELECT * FROM cruises
        ORDER BY id
        LIMIT ${batchSize} OFFSET ${copied}
      `;

      if (batch.length === 0) break;

      // Build insert query
      const values = batch.map(row => {
        const cols = Object.keys(row);
        const vals = cols.map(col => row[col]);
        return `(${vals.map(v => v === null ? 'NULL' : typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v).join(',')})`;
      }).join(',');

      const columns = Object.keys(batch[0]).map(c => `"${c}"`).join(',');

      await db.execute(sql.raw(`
        INSERT INTO cruises (${columns})
        VALUES ${values}
        ON CONFLICT (id) DO NOTHING
      `));

      copied += batch.length;
      logger.info(`Copied ${copied}/${prodCount} cruises`);
    }

    await prod.end();

    // Get final counts
    const [stagingResult] = await db.execute(sql`SELECT COUNT(*)::int as count FROM cruises`);
    const stagingCount = stagingResult.rows[0]?.count || 0;

    const [pricesResult] = await db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM cruises
      WHERE cheapest_price IS NOT NULL AND cheapest_price > 99
    `);
    const withPrices = pricesResult.rows[0]?.count || 0;

    const duration = Date.now() - startTime;

    logger.info(`Sync complete: ${stagingCount} cruises, ${withPrices} with prices, ${duration}ms`);

    return res.json({
      success: true,
      production: prodCount,
      staging: stagingCount,
      withPrices,
      durationMs: duration,
    });

  } catch (error: any) {
    logger.error('Sync failed:', error);
    return res.status(500).json({
      error: 'Sync failed',
      message: error.message
    });
  }
});

export default router;
