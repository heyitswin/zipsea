#!/usr/bin/env node

/**
 * Scheduled Database Cleanup Job
 * Runs periodically to maintain optimal database performance
 * Should be scheduled as a cron job to run daily at low-traffic times
 */

import { config } from 'dotenv';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

config();

const { Pool } = pg;

async function scheduledCleanup() {
  const startTime = Date.now();
  console.log(`[CLEANUP] Starting scheduled database cleanup at ${new Date().toISOString()}`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 2, // Minimal connections for cleanup
  });

  const db = drizzle(pool);

  try {
    // 1. Clean up old departed cruises (keep 30 days of historical data)
    console.log('[CLEANUP] Removing old departed cruises...');
    const departedCleanup = await db.execute(sql`
      DELETE FROM cruises
      WHERE departure_date < NOW() - INTERVAL '30 days'
      AND updated_at < NOW() - INTERVAL '7 days'
      RETURNING id;
    `);
    console.log(`[CLEANUP] Removed ${departedCleanup.rowCount || 0} old departed cruises`);

    // 2. Clean up cruises that haven't been updated in 14 days (likely removed from inventory)
    console.log('[CLEANUP] Removing stale cruises...');
    const staleCleanup = await db.execute(sql`
      DELETE FROM cruises
      WHERE updated_at < NOW() - INTERVAL '14 days'
      AND (departure_date IS NULL OR departure_date > NOW())
      RETURNING id;
    `);
    console.log(`[CLEANUP] Removed ${staleCleanup.rowCount || 0} stale cruises`);

    // 3. Clean up orphaned pricing records
    console.log('[CLEANUP] Removing orphaned pricing records...');
    const pricingCleanup = await db.execute(sql`
      DELETE FROM pricing p
      WHERE NOT EXISTS (
        SELECT 1 FROM cruises c WHERE c.id = p.cruise_id
      )
      RETURNING id;
    `);
    console.log(`[CLEANUP] Removed ${pricingCleanup.rowCount || 0} orphaned pricing records`);

    // 4. Clean up orphaned cabin records
    console.log('[CLEANUP] Removing orphaned cabin records...');
    const cabinCleanup = await db.execute(sql`
      DELETE FROM cabins cab
      WHERE NOT EXISTS (
        SELECT 1 FROM cruises c WHERE c.id = cab.cruise_id
      )
      RETURNING id;
    `);
    console.log(`[CLEANUP] Removed ${cabinCleanup.rowCount || 0} orphaned cabin records`);

    // 5. Clean up orphaned itinerary records
    console.log('[CLEANUP] Removing orphaned itinerary records...');
    const itineraryCleanup = await db.execute(sql`
      DELETE FROM itinerary i
      WHERE NOT EXISTS (
        SELECT 1 FROM cruises c WHERE c.id = i.cruise_id
      )
      RETURNING id;
    `);
    console.log(`[CLEANUP] Removed ${itineraryCleanup.rowCount || 0} orphaned itinerary records`);

    // 6. Clean up old price snapshots (keep last 30 days for analysis)
    console.log('[CLEANUP] Removing old price snapshots...');
    const snapshotCleanup = await db.execute(sql`
      DELETE FROM price_snapshots
      WHERE created_at < NOW() - INTERVAL '30 days'
      RETURNING id;
    `);
    console.log(`[CLEANUP] Removed ${snapshotCleanup.rowCount || 0} old price snapshots`);

    // 7. Run VACUUM on main tables (this is important for reclaiming space)
    console.log('[CLEANUP] Running VACUUM on tables...');
    await db.execute(sql`VACUUM cruises;`);
    await db.execute(sql`VACUUM pricing;`);
    await db.execute(sql`VACUUM cabins;`);
    await db.execute(sql`VACUUM itinerary;`);
    await db.execute(sql`VACUUM price_snapshots;`);
    console.log('[CLEANUP] VACUUM completed');

    // 8. Update table statistics for query planner
    console.log('[CLEANUP] Updating table statistics...');
    await db.execute(sql`ANALYZE cruises;`);
    await db.execute(sql`ANALYZE pricing;`);
    await db.execute(sql`ANALYZE cabins;`);
    await db.execute(sql`ANALYZE itinerary;`);
    console.log('[CLEANUP] Statistics updated');

    // 9. Report database size
    const dbSize = await db.execute(sql`
      SELECT
        pg_size_pretty(pg_database_size(current_database())) as db_size,
        (SELECT count(*) FROM cruises) as cruise_count,
        (SELECT count(*) FROM pricing) as pricing_count,
        (SELECT count(*) FROM cruises WHERE departure_date > NOW()) as future_cruises;
    `);

    if (dbSize.rows[0]) {
      console.log('[CLEANUP] Database status:');
      console.log(`  Total size: ${dbSize.rows[0].db_size}`);
      console.log(`  Active cruises: ${dbSize.rows[0].cruise_count}`);
      console.log(`  Future cruises: ${dbSize.rows[0].future_cruises}`);
      console.log(`  Pricing records: ${dbSize.rows[0].pricing_count}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[CLEANUP] ✅ Scheduled cleanup completed successfully in ${duration}ms`);

  } catch (error) {
    console.error('[CLEANUP] ❌ Error during scheduled cleanup:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  scheduledCleanup().catch(console.error);
}

export { scheduledCleanup };
