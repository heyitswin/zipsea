const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { sql } = require('drizzle-orm');
require('dotenv').config({ path: __dirname + '/../.env' });

async function verifyDatabaseUpdates() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION,
    ssl: {
      rejectUnauthorized: false,
    },
  });
  const db = drizzle(pool);

  try {
    console.log('=== Database Update Verification ===\n');

    // Check cruises table
    const recentCruises = await db.execute(sql`
      SELECT
        id,
        name,
        sailing_date,
        market_id,
        owner_id,
        updated_at
      FROM cruises
      WHERE updated_at > NOW() - INTERVAL '1 hour'
      ORDER BY updated_at DESC
      LIMIT 10
    `);

    console.log(`Recently updated cruises (last hour): ${recentCruises.rows.length}`);
    if (recentCruises.rows.length > 0) {
      console.log('\nSample cruises:');
      recentCruises.rows.slice(0, 3).forEach(cruise => {
        console.log(`  - ID: ${cruise.id}, Name: ${cruise.name}`);
        console.log(`    Market ID: ${cruise.market_id}, Owner ID: ${cruise.owner_id}`);
        console.log(`    Updated: ${cruise.updated_at}\n`);
      });
    }

    // Check cheapest_pricing table
    const recentPricing = await db.execute(sql`
      SELECT
        cruise_id,
        cheapest_price,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        last_updated
      FROM cheapest_pricing
      WHERE last_updated > NOW() - INTERVAL '1 hour'
      ORDER BY last_updated DESC
      LIMIT 10
    `);

    console.log(`\nRecently updated pricing (last hour): ${recentPricing.rows.length}`);
    if (recentPricing.rows.length > 0) {
      console.log('\nSample pricing:');
      recentPricing.rows.slice(0, 3).forEach(pricing => {
        console.log(`  - Cruise ID: ${pricing.cruise_id}`);
        console.log(`    Cheapest: $${pricing.cheapest_price}`);
        console.log(
          `    Interior: $${pricing.interior_price}, Oceanview: $${pricing.oceanview_price}`
        );
        console.log(`    Balcony: $${pricing.balcony_price}, Suite: $${pricing.suite_price}`);
        console.log(`    Updated: ${pricing.last_updated}\n`);
      });
    }

    // Check price_snapshots table
    const recentSnapshots = await db.execute(sql`
      SELECT
        COUNT(*) as snapshot_count,
        MAX(created_at) as latest_snapshot
      FROM price_snapshots
      WHERE created_at > NOW() - INTERVAL '1 hour'
    `);

    console.log(`\nPrice snapshots (last hour): ${recentSnapshots.rows[0].snapshot_count}`);
    if (recentSnapshots.rows[0].latest_snapshot) {
      console.log(`Latest snapshot: ${recentSnapshots.rows[0].latest_snapshot}`);
    }

    // Check overall stats
    const overallStats = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM cruises WHERE updated_at > NOW() - INTERVAL '24 hours') as cruises_24h,
        (SELECT COUNT(*) FROM cheapest_pricing WHERE last_updated > NOW() - INTERVAL '24 hours') as pricing_24h,
        (SELECT COUNT(*) FROM price_snapshots WHERE created_at > NOW() - INTERVAL '24 hours') as snapshots_24h
    `);

    console.log('\n=== 24-Hour Stats ===');
    console.log(`Cruises updated: ${overallStats.rows[0].cruises_24h}`);
    console.log(`Pricing updated: ${overallStats.rows[0].pricing_24h}`);
    console.log(`Snapshots created: ${overallStats.rows[0].snapshots_24h}`);
  } catch (error) {
    console.error('Error checking database updates:', error);
  } finally {
    await pool.end();
  }
}

verifyDatabaseUpdates();
