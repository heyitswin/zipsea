#!/usr/bin/env node

/**
 * Database Optimization Script
 * Implements memory optimization and data cleanup for PostgreSQL
 */

require('dotenv').config();
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { sql } = require('drizzle-orm');

async function optimizeDatabase() {
  console.log('🔧 Starting database optimization...\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 2, // Use minimal connections for admin tasks
  });

  const db = drizzle(pool);

  try {
    // 1. Check current settings
    console.log('📊 Current PostgreSQL settings:');
    const currentSettings = await db.execute(sql`
      SELECT name, setting, unit, category
      FROM pg_settings
      WHERE name IN ('shared_buffers', 'effective_cache_size', 'work_mem', 'maintenance_work_mem', 'max_connections')
      ORDER BY name;
    `);

    currentSettings.rows.forEach(row => {
      console.log(`  ${row.name}: ${row.setting}${row.unit || ''}`);
    });

    // 2. Clean up old batch sync data (keep only last 7 days)
    console.log('\n🧹 Cleaning up old batch sync data...');

    // Clean old cruise data that hasn't been updated in 7 days
    const cleanupResult = await db.execute(sql`
      WITH old_cruises AS (
        SELECT id
        FROM cruises
        WHERE updated_at < NOW() - INTERVAL '7 days'
        AND (
          sailing_date < NOW() - INTERVAL '30 days'
          OR sailing_date IS NULL
        )
      )
      DELETE FROM cruises
      WHERE id IN (SELECT id FROM old_cruises)
      RETURNING id;
    `);

    console.log(`  Deleted ${cleanupResult.rowCount} old cruises`);

    // 3. Clean up orphaned pricing data
    console.log('\n🧹 Cleaning up orphaned pricing data...');
    const pricingCleanup = await db.execute(sql`
      DELETE FROM pricing p
      WHERE NOT EXISTS (
        SELECT 1 FROM cruises c WHERE c.id = p.cruise_id
      )
      RETURNING id;
    `);
    console.log(`  Deleted ${pricingCleanup.rowCount} orphaned pricing records`);

    // 4. Clean up orphaned cabin category data
    const cabinCleanup = await db.execute(sql`
      DELETE FROM cabin_categories cab
      WHERE NOT EXISTS (
        SELECT 1 FROM cruises c WHERE c.id = cab.cruise_id
      )
      RETURNING id;
    `);
    console.log(`  Deleted ${cabinCleanup.rowCount} orphaned cabin category records`);

    // 5. Run VACUUM ANALYZE on main tables
    console.log('\n🔄 Running VACUUM ANALYZE on main tables...');
    await db.execute(sql`VACUUM ANALYZE cruises;`);
    console.log('  ✓ Vacuumed cruises table');

    await db.execute(sql`VACUUM ANALYZE pricing;`);
    console.log('  ✓ Vacuumed pricing table');

    await db.execute(sql`VACUUM ANALYZE cabin_categories;`);
    console.log('  ✓ Vacuumed cabin_categories table');

    await db.execute(sql`VACUUM ANALYZE itinerary;`);
    console.log('  ✓ Vacuumed itinerary table');

    // 6. Check table sizes after cleanup
    console.log('\n📏 Table sizes after cleanup:');
    const tableSizes = await db.execute(sql`
      SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 10;
    `);

    tableSizes.rows.forEach(row => {
      console.log(`  ${row.tablename}: ${row.size}`);
    });

    // 7. Memory usage report
    console.log('\n💾 Memory usage report:');
    const memoryStats = await db.execute(sql`
      SELECT
        count(*) as connections,
        sum(numbackends) as total_backends,
        pg_size_pretty(sum(pg_database_size(datname))::bigint) as total_db_size
      FROM pg_stat_database
      WHERE datname = current_database()
      GROUP BY datname;
    `);

    if (memoryStats.rows[0]) {
      console.log(`  Active connections: ${memoryStats.rows[0].total_backends || 0}`);
      console.log(`  Total database size: ${memoryStats.rows[0].total_db_size}`);
    }

    // 8. Cache hit ratio
    const cacheStats = await db.execute(sql`
      SELECT
        sum(heap_blks_read) as heap_read,
        sum(heap_blks_hit) as heap_hit,
        sum(idx_blks_read) as idx_read,
        sum(idx_blks_hit) as idx_hit,
        CASE
          WHEN sum(heap_blks_hit) + sum(heap_blks_read) > 0
          THEN round(100.0 * sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)), 2)
          ELSE 0
        END as heap_cache_hit_ratio,
        CASE
          WHEN sum(idx_blks_hit) + sum(idx_blks_read) > 0
          THEN round(100.0 * sum(idx_blks_hit) / (sum(idx_blks_hit) + sum(idx_blks_read)), 2)
          ELSE 0
        END as idx_cache_hit_ratio
      FROM pg_statio_user_tables;
    `);

    if (cacheStats.rows[0]) {
      console.log(`\n📈 Cache hit ratios:`);
      console.log(`  Heap cache hit ratio: ${cacheStats.rows[0].heap_cache_hit_ratio}%`);
      console.log(`  Index cache hit ratio: ${cacheStats.rows[0].idx_cache_hit_ratio}%`);
    }

    console.log('\n✅ Database optimization complete!');
  } catch (error) {
    console.error('❌ Error during optimization:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  optimizeDatabase().catch(console.error);
}

module.exports = { optimizeDatabase };
