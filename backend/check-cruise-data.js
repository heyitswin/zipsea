const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { sql } = require('drizzle-orm');
require('dotenv').config({ path: __dirname + '/.env' });

async function checkCruiseData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION,
    ssl: {
      rejectUnauthorized: false
    }
  });
  const db = drizzle(pool);

  try {
    console.log('=== Checking Cruise Data ===\n');

    // Check total cruise count
    const totalCount = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN line_id IS NOT NULL THEN 1 END) as traveltek_cruises,
        MIN(sailing_date) as earliest,
        MAX(sailing_date) as latest
      FROM cruises
    `);

    console.log('Total cruises in database:', totalCount.rows[0].total);
    console.log('Traveltek cruises:', totalCount.rows[0].traveltek_cruises);
    console.log('Date range:', totalCount.rows[0].earliest, 'to', totalCount.rows[0].latest);

    // Check for Wonder of the Seas
    const wonderCruises = await db.execute(sql`
      SELECT
        c.id,
        c.name,
        c.sailing_date,
        c.nights,
        c.ship_name,
        c.line_id,
        c.updated_at
      FROM cruises c
      WHERE
        (c.name ILIKE '%wonder%' OR c.ship_name ILIKE '%wonder%')
        AND c.sailing_date >= '2026-02-01'
        AND c.sailing_date <= '2026-02-28'
      ORDER BY c.sailing_date
      LIMIT 10
    `);

    console.log('\nWonder of the Seas cruises in Feb 2026:', wonderCruises.rows.length);
    if (wonderCruises.rows.length > 0) {
      wonderCruises.rows.forEach(cruise => {
        console.log(`- ID: ${cruise.id} | ${cruise.name} | ${cruise.sailing_date} | Ship: ${cruise.ship_name}`);
      });
    }

    // Check Royal Caribbean cruises (line_id = 22)
    const royalCruises = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        MIN(sailing_date) as earliest,
        MAX(sailing_date) as latest
      FROM cruises
      WHERE line_id = 22
    `);

    console.log('\nRoyal Caribbean (line_id=22) cruises:', royalCruises.rows[0].total);
    console.log('Date range:', royalCruises.rows[0].earliest, 'to', royalCruises.rows[0].latest);

    // Check recent cruises added
    const recentCruises = await db.execute(sql`
      SELECT
        id,
        name,
        sailing_date,
        line_id,
        ship_name,
        updated_at
      FROM cruises
      WHERE updated_at > NOW() - INTERVAL '24 hours'
      ORDER BY updated_at DESC
      LIMIT 10
    `);

    console.log('\nCruises updated in last 24 hours:', recentCruises.rows.length);
    if (recentCruises.rows.length > 0) {
      recentCruises.rows.forEach(cruise => {
        console.log(`- ${cruise.name} | ${cruise.sailing_date} | Updated: ${cruise.updated_at}`);
      });
    }

    // Check if search is working
    const searchTest = await db.execute(sql`
      SELECT
        c.id,
        c.name,
        c.sailing_date,
        cp.cheapest_price
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE
        c.sailing_date >= '2026-01-01'
        AND c.sailing_date <= '2026-03-31'
      ORDER BY c.sailing_date
      LIMIT 10
    `);

    console.log('\nSample cruises in Q1 2026:', searchTest.rows.length);
    if (searchTest.rows.length > 0) {
      searchTest.rows.forEach(cruise => {
        console.log(`- ${cruise.name} | ${cruise.sailing_date} | Price: $${cruise.cheapest_price || 'N/A'}`);
      });
    }

  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await pool.end();
  }
}

checkCruiseData();
