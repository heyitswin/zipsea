const { Pool } = require('pg');
require('dotenv').config();

async function checkWonderOfTheSeas() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('=== Checking for Wonder of the Seas ===\n');

    // Check ships first
    const shipResult = await pool.query(`
      SELECT id, name, cruise_line_id
      FROM ships
      WHERE name ILIKE '%wonder%'
      LIMIT 10
    `);

    console.log('Ships with "wonder" in name:', shipResult.rows.length);
    if (shipResult.rows.length > 0) {
      console.log('Ships found:', shipResult.rows);
    }

    // Check cruises for Wonder of the Seas in Feb 2026
    const cruiseResult = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.sailing_date,
        c.nights,
        s.name as ship_name,
        cl.name as cruise_line_name,
        c.line_id,
        c.updated_at
      FROM cruises c
      LEFT JOIN ships s ON c.ship_id = s.id
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE
        (c.name ILIKE '%wonder%seas%' OR s.name ILIKE '%wonder%seas%')
        AND c.sailing_date >= '2026-02-01'
        AND c.sailing_date <= '2026-02-28'
      ORDER BY c.sailing_date
      LIMIT 10
    `);

    console.log('\nCruises for Wonder of the Seas in Feb 2026:', cruiseResult.rows.length);
    if (cruiseResult.rows.length > 0) {
      cruiseResult.rows.forEach(cruise => {
        console.log(`- ${cruise.name} | ${cruise.sailing_date} | ${cruise.ship_name} | ${cruise.cruise_line_name}`);
      });
    }

    // Check all cruises from Traveltek data (line_id exists)
    const traveltekResult = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.sailing_date,
        c.line_id,
        c.ship_name as traveltek_ship_name,
        s.name as matched_ship_name
      FROM cruises c
      LEFT JOIN ships s ON c.ship_id = s.id
      WHERE
        c.line_id IS NOT NULL
        AND c.name ILIKE '%wonder%'
        AND c.sailing_date >= '2026-02-01'
        AND c.sailing_date <= '2026-02-28'
      LIMIT 10
    `);

    console.log('\nTraveltek cruises with "wonder" in Feb 2026:', traveltekResult.rows.length);
    if (traveltekResult.rows.length > 0) {
      traveltekResult.rows.forEach(cruise => {
        console.log(`- ${cruise.name} | ${cruise.sailing_date} | Line: ${cruise.line_id} | Ship: ${cruise.traveltek_ship_name || cruise.matched_ship_name}`);
      });
    }

    // Check Royal Caribbean cruises in Feb 2026
    const royalResult = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.sailing_date,
        c.ship_name,
        cl.name as cruise_line_name
      FROM cruises c
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE
        (cl.name ILIKE '%royal%caribbean%' OR c.line_id = 22)
        AND c.sailing_date >= '2026-02-01'
        AND c.sailing_date <= '2026-02-28'
      ORDER BY c.sailing_date
      LIMIT 20
    `);

    console.log('\nRoyal Caribbean cruises in Feb 2026:', royalResult.rows.length);
    if (royalResult.rows.length > 0) {
      console.log('First few Royal Caribbean cruises:');
      royalResult.rows.slice(0, 5).forEach(cruise => {
        console.log(`- ${cruise.name} | ${cruise.sailing_date} | ${cruise.ship_name}`);
      });
    }

    // Check total cruise count
    const countResult = await pool.query(`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN line_id IS NOT NULL THEN 1 END) as traveltek_cruises,
        MIN(sailing_date) as earliest_date,
        MAX(sailing_date) as latest_date
      FROM cruises
    `);

    console.log('\n=== Database Statistics ===');
    console.log('Total cruises:', countResult.rows[0].total_cruises);
    console.log('Traveltek cruises:', countResult.rows[0].traveltek_cruises);
    console.log('Date range:', countResult.rows[0].earliest_date, 'to', countResult.rows[0].latest_date);

  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await pool.end();
  }
}

checkWonderOfTheSeas();
