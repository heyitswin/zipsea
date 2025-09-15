#!/usr/bin/env node

/**
 * Emergency Database Memory Cleanup
 * Run this when PostgreSQL memory is critically high
 */

require('dotenv').config();
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { sql } = require('drizzle-orm');

async function emergencyCleanup() {
  console.log('🚨 EMERGENCY DATABASE MEMORY CLEANUP STARTING...\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 1, // Use minimal connection
  });

  const db = drizzle(pool);

  try {
    // 1. Kill idle connections to free memory
    console.log('🔪 Terminating idle connections...');
    const killedConnections = await db.execute(sql`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = current_database()
      AND pid <> pg_backend_pid()
      AND state = 'idle'
      AND state_change < NOW() - INTERVAL '5 minutes';
    `);
    console.log(`  Terminated ${killedConnections.rowCount} idle connections`);

    // 2. Aggressive cleanup of old departed cruises (anything that sailed over 3 days ago)
    console.log('\n🧹 Aggressively cleaning departed cruises...');
    const departedCleanup = await db.execute(sql`
      DELETE FROM cruises
      WHERE sailing_date < NOW() - INTERVAL '3 days'
      RETURNING id;
    `);
    console.log(`  Deleted ${departedCleanup.rowCount || 0} departed cruises`);

    // 3. Clean up cruises not updated in last 3 days
    console.log('\n🧹 Cleaning stale cruises...');
    const staleCleanup = await db.execute(sql`
      DELETE FROM cruises
      WHERE updated_at < NOW() - INTERVAL '3 days'
      AND sailing_date > NOW()
      RETURNING id;
    `);
    console.log(`  Deleted ${staleCleanup.rowCount || 0} stale future cruises`);

    // 4. Clean up all orphaned related data
    console.log('\n🧹 Cleaning orphaned data...');

    const pricingCleanup = await db.execute(sql`
      DELETE FROM pricing p
      WHERE NOT EXISTS (
        SELECT 1 FROM cruises c WHERE c.id = p.cruise_id
      )
      RETURNING id;
    `);
    console.log(`  Deleted ${pricingCleanup.rowCount || 0} orphaned pricing records`);

    const itineraryCleanup = await db.execute(sql`
      DELETE FROM itinerary i
      WHERE NOT EXISTS (
        SELECT 1 FROM cruises c WHERE c.id = i.cruise_id
      )
      RETURNING id;
    `);
    console.log(`  Deleted ${itineraryCleanup.rowCount || 0} orphaned itinerary records`);

    const cabinCleanup = await db.execute(sql`
      DELETE FROM cabin_categories cc
      WHERE NOT EXISTS (
        SELECT 1 FROM cruises c WHERE c.id = cc.cruise_id
      )
      RETURNING id;
    `);
    console.log(`  Deleted ${cabinCleanup.rowCount || 0} orphaned cabin categories`);

    // 5. Clean up old price snapshots
    console.log('\n🧹 Cleaning old price snapshots...');
    const snapshotCleanup = await db.execute(sql`
      DELETE FROM price_snapshots
      WHERE created_at < NOW() - INTERVAL '7 days'
      RETURNING id;
    `);
    console.log(`  Deleted ${snapshotCleanup.rowCount || 0} old price snapshots`);

    // 6. Run aggressive VACUUM FULL on all tables (this will lock tables but reclaim space)
    console.log('\n🔄 Running VACUUM FULL (this will lock tables temporarily)...');

    console.log('  Vacuuming cruises table...');
    await db.execute(sql`VACUUM FULL cruises;`);

    console.log('  Vacuuming pricing table...');
    await db.execute(sql`VACUUM FULL pricing;`);

    console.log('  Vacuuming itinerary table...');
    await db.execute(sql`VACUUM FULL itinerary;`);

    console.log('  Vacuuming cabin_categories table...');
    await db.execute(sql`VACUUM FULL cabin_categories;`);

    console.log('  Vacuuming price_snapshots table...');
    await db.execute(sql`VACUUM FULL price_snapshots;`);

    // 7. Analyze tables for query planner
    console.log('\n📊 Updating table statistics...');
    await db.execute(sql`ANALYZE;`);

    // 8. Report final status
    console.log('\n📈 Final database status:');

    const dbSize = await db.execute(sql`
      SELECT
        pg_size_pretty(pg_database_size(current_database())) as db_size,
        (SELECT count(*) FROM cruises) as cruise_count,
        (SELECT count(*) FROM cruises WHERE sailing_date > NOW()) as future_cruises,
        (SELECT count(*) FROM pricing) as pricing_count,
        (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as connections;
    `);

    if (dbSize.rows[0]) {
      console.log(`  Database size: ${dbSize.rows[0].db_size}`);
      console.log(`  Total cruises: ${dbSize.rows[0].cruise_count}`);
      console.log(`  Future cruises: ${dbSize.rows[0].future_cruises}`);
      console.log(`  Pricing records: ${dbSize.rows[0].pricing_count}`);
      console.log(`  Active connections: ${dbSize.rows[0].connections}`);
    }

    // 9. Memory status
    const memStatus = await db.execute(sql`
      SELECT
        name,
        setting,
        unit
      FROM pg_settings
      WHERE name IN ('shared_buffers', 'effective_cache_size', 'work_mem')
      ORDER BY name;
    `);

    console.log('\n💾 Memory settings:');
    memStatus.rows.forEach(row => {
      console.log(`  ${row.name}: ${row.setting}${row.unit || ''}`);
    });

    console.log('\n✅ EMERGENCY CLEANUP COMPLETE!');
    console.log('   Memory should start releasing within a few minutes.');

  } catch (error) {
    console.error('❌ Error during emergency cleanup:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  emergencyCleanup().catch(console.error);
}

module.exports = { emergencyCleanup };
