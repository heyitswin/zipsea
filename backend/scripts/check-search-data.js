#!/usr/bin/env node
/**
 * Check if cruise data exists and is searchable
 */

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

async function checkSearchData() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔍 CHECKING CRUISE SEARCH DATA');
    console.log('================================\n');

    // 1. Check Royal Caribbean data
    console.log('1️⃣ Royal Caribbean Cruises:');
    const rcResult = await pool.query(`
      SELECT
        cl.id as line_id,
        cl.name as line_name,
        COUNT(DISTINCT c.id) as total_cruises,
        COUNT(DISTINCT c.id) FILTER (WHERE c.sailing_date >= CURRENT_DATE) as future_cruises,
        COUNT(DISTINCT c.id) FILTER (WHERE c.sailing_date BETWEEN '2026-02-01' AND '2026-02-28') as feb_2026_cruises,
        COUNT(DISTINCT s.id) as total_ships,
        STRING_AGG(DISTINCT s.name, ', ' ORDER BY s.name) as ship_names
      FROM cruise_lines cl
      LEFT JOIN cruises c ON c.cruise_line_id = cl.id
      LEFT JOIN ships s ON s.cruise_line_id = cl.id
      WHERE cl.name ILIKE '%royal caribbean%'
      GROUP BY cl.id, cl.name
    `);

    if (rcResult.rows.length > 0) {
      const rc = rcResult.rows[0];
      console.log(`  Line ID: ${rc.line_id}`);
      console.log(`  Name: ${rc.line_name}`);
      console.log(`  Total Cruises: ${rc.total_cruises}`);
      console.log(`  Future Cruises: ${rc.future_cruises}`);
      console.log(`  Feb 2026 Cruises: ${rc.feb_2026_cruises}`);
      console.log(`  Ships: ${rc.total_ships}`);
      console.log(`  Ship Names: ${rc.ship_names?.substring(0, 100)}...`);
    } else {
      console.log('  ❌ No Royal Caribbean data found!');
    }
    console.log('');

    // 2. Check Quantum of the Seas specifically
    console.log('2️⃣ Quantum of the Seas:');
    const quantumResult = await pool.query(`
      SELECT
        s.id as ship_id,
        s.name as ship_name,
        s.cruise_line_id,
        cl.name as line_name,
        COUNT(DISTINCT c.id) as total_cruises,
        COUNT(DISTINCT c.id) FILTER (WHERE c.sailing_date >= CURRENT_DATE) as future_cruises,
        COUNT(DISTINCT c.id) FILTER (WHERE c.sailing_date BETWEEN '2026-02-01' AND '2026-02-28') as feb_2026_cruises,
        MIN(c.sailing_date) as earliest_sailing,
        MAX(c.sailing_date) as latest_sailing
      FROM ships s
      LEFT JOIN cruise_lines cl ON cl.id = s.cruise_line_id
      LEFT JOIN cruises c ON c.ship_id = s.id
      WHERE s.name ILIKE '%quantum%seas%'
      GROUP BY s.id, s.name, s.cruise_line_id, cl.name
    `);

    if (quantumResult.rows.length > 0) {
      const ship = quantumResult.rows[0];
      console.log(`  Ship ID: ${ship.ship_id}`);
      console.log(`  Ship Name: ${ship.ship_name}`);
      console.log(`  Cruise Line: ${ship.line_name}`);
      console.log(`  Total Cruises: ${ship.total_cruises}`);
      console.log(`  Future Cruises: ${ship.future_cruises}`);
      console.log(`  Feb 2026 Cruises: ${ship.feb_2026_cruises}`);
      console.log(`  Date Range: ${ship.earliest_sailing} to ${ship.latest_sailing}`);
    } else {
      console.log('  ❌ Quantum of the Seas not found!');
    }
    console.log('');

    // 3. Check Feb 2026 cruises specifically
    console.log('3️⃣ February 2026 Cruises (all lines):');
    const feb2026Result = await pool.query(`
      SELECT
        c.cruise_id,
        c.name,
        c.sailing_date,
        s.name as ship_name,
        cl.name as line_name,
        cp.cheapest_price
      FROM cruises c
      JOIN ships s ON s.id = c.ship_id
      JOIN cruise_lines cl ON cl.id = c.cruise_line_id
      LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE c.sailing_date BETWEEN '2026-02-01' AND '2026-02-28'
        AND cl.name ILIKE '%royal caribbean%'
      ORDER BY c.sailing_date
      LIMIT 10
    `);

    console.log(`  Found ${feb2026Result.rows.length} Royal Caribbean cruises in Feb 2026:`);
    feb2026Result.rows.forEach(cruise => {
      console.log(`    • ${cruise.sailing_date} - ${cruise.ship_name} - ${cruise.name} ($${cruise.cheapest_price || 'N/A'})`);
    });
    console.log('');

    // 4. Check if search index is working
    console.log('4️⃣ Search Index Test:');
    const searchTest = await pool.query(`
      SELECT COUNT(*) as count
      FROM cruises c
      WHERE c.sailing_date >= CURRENT_DATE
        AND c.is_active = true
    `);
    console.log(`  Active future cruises: ${searchTest.rows[0].count}`);

    // Test search with ILIKE
    const searchResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM cruises c
      JOIN ships s ON s.id = c.ship_id
      WHERE c.sailing_date >= CURRENT_DATE
        AND c.is_active = true
        AND (
          s.name ILIKE '%quantum%'
          OR c.name ILIKE '%quantum%'
        )
    `);
    console.log(`  Cruises matching 'quantum': ${searchResult.rows[0].count}`);
    console.log('');

    // 5. Check pricing data
    console.log('5️⃣ Pricing Data:');
    const pricingResult = await pool.query(`
      SELECT
        COUNT(DISTINCT c.id) as cruises_with_pricing,
        COUNT(DISTINCT c.id) FILTER (WHERE cp.cheapest_price IS NOT NULL) as valid_pricing,
        COUNT(DISTINCT c.id) FILTER (WHERE cp.cheapest_price > 0) as positive_pricing
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE c.sailing_date >= CURRENT_DATE
        AND c.cruise_line_id IN (
          SELECT id FROM cruise_lines WHERE name ILIKE '%royal caribbean%'
        )
    `);

    const pr = pricingResult.rows[0];
    console.log(`  Cruises with pricing records: ${pr.cruises_with_pricing}`);
    console.log(`  Valid pricing (not null): ${pr.valid_pricing}`);
    console.log(`  Positive pricing (>0): ${pr.positive_pricing}`);
    console.log('');

    // 6. Check the specific ship IDs from the error
    console.log('6️⃣ Ships from Error Messages:');
    const shipIds = [6677, 2472];
    for (const shipId of shipIds) {
      const shipCheck = await pool.query(`
        SELECT
          s.id,
          s.name,
          s.cruise_line_id,
          cl.name as line_name,
          COUNT(c.id) as cruise_count
        FROM ships s
        LEFT JOIN cruise_lines cl ON cl.id = s.cruise_line_id
        LEFT JOIN cruises c ON c.ship_id = s.id
        WHERE s.id = $1
        GROUP BY s.id, s.name, s.cruise_line_id, cl.name
      `, [shipId]);

      if (shipCheck.rows.length > 0) {
        const s = shipCheck.rows[0];
        console.log(`  Ship ${shipId}: ${s.name} (${s.line_name}) - ${s.cruise_count} cruises`);
      } else {
        console.log(`  Ship ${shipId}: NOT FOUND`);
      }
    }

    console.log('\n================================');
    console.log('📋 DIAGNOSIS:');

    if (rcResult.rows[0]?.future_cruises > 0) {
      console.log('✅ Royal Caribbean cruises exist in database');
    } else {
      console.log('❌ No future Royal Caribbean cruises found');
    }

    if (quantumResult.rows[0]?.future_cruises > 0) {
      console.log('✅ Quantum of the Seas has future cruises');
    } else {
      console.log('❌ Quantum of the Seas has no future cruises');
    }

    if (pricingResult.rows[0]?.positive_pricing > 0) {
      console.log('✅ Pricing data exists');
    } else {
      console.log('❌ No pricing data for Royal Caribbean');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkSearchData();
