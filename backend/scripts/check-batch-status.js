#!/usr/bin/env node
require('dotenv').config();
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { sql } = require('drizzle-orm');

const DATABASE_URL = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false,
});
const db = drizzle(pool);

async function checkStatus() {
  try {
    console.log('\n📊 BATCH SYNC STATUS\n' + '='.repeat(50));

    // 1. Check total flagged cruises
    const flaggedResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM cruises c
      WHERE c.needs_price_update = true
        AND c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
    `);

    const flaggedCount = parseInt(flaggedResult.rows[0].count);
    console.log(`\n📌 Cruises pending sync: ${flaggedCount}`);

    if (flaggedCount > 0) {
      // Show breakdown by line
      const byLineResult = await db.execute(sql`
        SELECT
          cl.name as line_name,
          cl.id as line_id,
          COUNT(c.id) as count
        FROM cruises c
        JOIN ships s ON c.ship_id = s.id
        JOIN cruise_lines cl ON s.cruise_line_id = cl.id
        WHERE c.needs_price_update = true
          AND c.is_active = true
          AND c.sailing_date >= CURRENT_DATE
        GROUP BY cl.id, cl.name
        ORDER BY count DESC
        LIMIT 10
      `);

      console.log('\nBy cruise line:');
      byLineResult.rows.forEach(row => {
        console.log(`  - ${row.line_name}: ${row.count} cruises (Line ID: ${row.line_id})`);
      });
    }

    // 2. Check recent processing activity
    console.log('\n⚡ Recent processing (last 10 minutes):');

    const recentResult = await db.execute(sql`
      SELECT
        cl.name as line_name,
        COUNT(c.id) as count,
        MAX(c.updated_at) as last_update
      FROM cruises c
      JOIN ships s ON c.ship_id = s.id
      JOIN cruise_lines cl ON s.cruise_line_id = cl.id
      WHERE c.updated_at >= NOW() - INTERVAL '10 minutes'
        AND c.needs_price_update = false
      GROUP BY cl.id, cl.name
      ORDER BY last_update DESC
      LIMIT 5
    `);

    if (recentResult.rows.length === 0) {
      console.log('  No cruises processed in last 10 minutes');
    } else {
      recentResult.rows.forEach(row => {
        const timeAgo = Math.round((Date.now() - new Date(row.last_update)) / 60000);
        console.log(`  - ${row.line_name}: ${row.count} cruises (${timeAgo} min ago)`);
      });
    }

    // 3. Check pricing data coverage
    console.log('\n💰 Pricing data coverage:');

    const pricingResult = await db.execute(sql`
      SELECT
        cl.name as line_name,
        COUNT(DISTINCT c.id) as total_cruises,
        COUNT(DISTINCT cp.cruise_id) as with_pricing,
        ROUND(COUNT(DISTINCT cp.cruise_id)::numeric / COUNT(DISTINCT c.id) * 100, 1) as coverage_pct
      FROM cruises c
      JOIN ships s ON c.ship_id = s.id
      JOIN cruise_lines cl ON s.cruise_line_id = cl.id
      LEFT JOIN pricing cp ON c.id = cp.cruise_id
      WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
      GROUP BY cl.id, cl.name
      HAVING COUNT(DISTINCT c.id) > 0
      ORDER BY total_cruises DESC
      LIMIT 10
    `);

    pricingResult.rows.forEach(row => {
      const bar =
        '█'.repeat(Math.floor(row.coverage_pct / 10)) +
        '░'.repeat(10 - Math.floor(row.coverage_pct / 10));
      console.log(
        `  ${row.line_name.padEnd(25)} ${bar} ${row.coverage_pct}% (${row.with_pricing}/${row.total_cruises})`
      );
    });

    // 4. Check Line 5 (Cunard) specifically
    console.log('\n🚢 Line 5 (Cunard) Status:');

    const cunardResult = await db.execute(sql`
      SELECT
        COUNT(DISTINCT c.id) as total_cruises,
        COUNT(DISTINCT CASE WHEN c.needs_price_update = true THEN c.id END) as pending_sync,
        COUNT(DISTINCT cp.cruise_id) as with_pricing,
        MIN(c.sailing_date) as earliest_sailing,
        MAX(c.sailing_date) as latest_sailing
      FROM cruises c
      JOIN ships s ON c.ship_id = s.id
      LEFT JOIN pricing cp ON c.id = cp.cruise_id
      WHERE s.cruise_line_id = 5
        AND c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
    `);

    const cunard = cunardResult.rows[0];
    if (cunard && cunard.total_cruises > 0) {
      console.log(`  Total cruises: ${cunard.total_cruises}`);
      console.log(`  Pending sync: ${cunard.pending_sync}`);
      console.log(`  With pricing: ${cunard.with_pricing}`);
      console.log(
        `  Coverage: ${((cunard.with_pricing / cunard.total_cruises) * 100).toFixed(1)}%`
      );
      console.log(`  Date range: ${cunard.earliest_sailing} to ${cunard.latest_sailing}`);
    } else {
      console.log('  No active cruises found');
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Status check complete\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkStatus();
