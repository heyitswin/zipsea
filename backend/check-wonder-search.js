const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { sql } = require('drizzle-orm');
require('dotenv').config({ path: __dirname + '/.env' });

async function checkWonderSearch() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION,
    ssl: {
      rejectUnauthorized: false
    }
  });
  const db = drizzle(pool);

  try {
    console.log('=== Checking Wonder of the Seas Search Issue ===\n');

    // Check cruises with "Wonder" in the name or ship_name field
    const wonderCruises = await db.execute(sql`
      SELECT
        c.id,
        c.name,
        c.ship_name,
        c.ship_id,
        c.sailing_date,
        c.line_id,
        s.name as linked_ship_name
      FROM cruises c
      LEFT JOIN ships s ON c.ship_id = s.id
      WHERE
        (c.name ILIKE '%wonder%' OR c.ship_name ILIKE '%wonder%')
        AND c.sailing_date >= '2026-01-01'
        AND c.sailing_date <= '2026-03-31'
      ORDER BY c.sailing_date
      LIMIT 20
    `);

    console.log('Wonder cruises in Q1 2026:', wonderCruises.rows.length);
    if (wonderCruises.rows.length > 0) {
      console.log('\nCruises found:');
      wonderCruises.rows.forEach(cruise => {
        console.log(`ID: ${cruise.id}`);
        console.log(`  Name: ${cruise.name}`);
        console.log(`  Ship Name (field): ${cruise.ship_name}`);
        console.log(`  Ship ID: ${cruise.ship_id}`);
        console.log(`  Linked Ship: ${cruise.linked_ship_name || 'NOT LINKED'}`);
        console.log(`  Date: ${cruise.sailing_date}`);
        console.log(`  Line ID: ${cruise.line_id}`);
        console.log('---');
      });
    }

    // Check if Wonder of the Seas exists in ships table
    const wonderShip = await db.execute(sql`
      SELECT id, name, cruise_line_id
      FROM ships
      WHERE name ILIKE '%wonder%seas%'
      LIMIT 5
    `);

    console.log('\nWonder of the Seas in ships table:', wonderShip.rows.length);
    if (wonderShip.rows.length > 0) {
      wonderShip.rows.forEach(ship => {
        console.log(`- Ship ID: ${ship.id}, Name: ${ship.name}, Line: ${ship.cruise_line_id}`);
      });
    }

    // Check how many cruises have ship_name but no ship_id
    const unmatchedShips = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN ship_name IS NOT NULL THEN 1 END) as has_ship_name,
        COUNT(CASE WHEN ship_id IS NOT NULL THEN 1 END) as has_ship_id,
        COUNT(CASE WHEN ship_name IS NOT NULL AND ship_id IS NULL THEN 1 END) as unlinked
      FROM cruises
      WHERE line_id IS NOT NULL
    `);

    console.log('\n=== Ship Linking Statistics ===');
    console.log('Total Traveltek cruises:', unmatchedShips.rows[0].total);
    console.log('Has ship_name:', unmatchedShips.rows[0].has_ship_name);
    console.log('Has ship_id:', unmatchedShips.rows[0].has_ship_id);
    console.log('UNLINKED (has name, no ID):', unmatchedShips.rows[0].unlinked);

    // Sample of unlinked ships
    const sampleUnlinked = await db.execute(sql`
      SELECT DISTINCT ship_name
      FROM cruises
      WHERE ship_name IS NOT NULL
      AND ship_id IS NULL
      AND line_id IS NOT NULL
      LIMIT 10
    `);

    if (sampleUnlinked.rows.length > 0) {
      console.log('\nSample unlinked ship names:');
      sampleUnlinked.rows.forEach(row => {
        console.log(`  - "${row.ship_name}"`);
      });
    }

  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await pool.end();
  }
}

checkWonderSearch();
