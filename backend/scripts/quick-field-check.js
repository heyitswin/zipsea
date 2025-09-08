const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function quickFieldCheck() {
  console.log('Quick check of field population status...\n');

  try {
    // Quick count
    const result = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(ship_name) as with_ship_name,
        COUNT(CASE WHEN ship_name = '' THEN NULL ELSE ship_name END) as with_valid_ship_name
      FROM cruises
      WHERE is_active = true
      LIMIT 1000
    `);

    const stats = result.rows[0];
    console.log(`Active cruises (sample): ${stats.total}`);
    console.log(`With ship_name: ${stats.with_ship_name}`);
    console.log(`With valid ship_name: ${stats.with_valid_ship_name}\n`);

    // Check a few samples
    const sampleResult = await pool.query(`
      SELECT
        id,
        ship_name,
        raw_data->'shipcontent'->>'name' as raw_ship_name
      FROM cruises
      WHERE is_active = true
      LIMIT 5
    `);

    console.log('Sample records:');
    sampleResult.rows.forEach((row, i) => {
      console.log(`${i+1}. ID: ${row.id}`);
      console.log(`   Current ship_name: ${row.ship_name || '(null)'}`);
      console.log(`   Raw data ship_name: ${row.raw_ship_name || '(null)'}\n`);
    });

    // Count how many need updating
    const needUpdateResult = await pool.query(`
      SELECT COUNT(*) as need_update
      FROM cruises
      WHERE is_active = true
        AND (ship_name IS NULL OR ship_name = '')
        AND raw_data->'shipcontent'->>'name' IS NOT NULL
    `);

    console.log(`Records needing ship_name update: ${needUpdateResult.rows[0].need_update}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

quickFieldCheck();
