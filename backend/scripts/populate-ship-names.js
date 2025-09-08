const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function populateShipNames() {
  console.log('Populating ship_name column from raw_data...\n');

  try {
    console.log('Starting update...');
    const startTime = Date.now();

    // Do the update in one go
    const result = await pool.query(`
      UPDATE cruises
      SET ship_name = raw_data->'shipcontent'->>'name'
      WHERE is_active = true
        AND (ship_name IS NULL OR ship_name = '')
        AND raw_data->'shipcontent'->>'name' IS NOT NULL
    `);

    const elapsed = Date.now() - startTime;
    console.log(`✅ Updated ${result.rowCount} records in ${(elapsed/1000).toFixed(1)} seconds\n`);

    // Verify the update
    const verifyResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(ship_name) as with_ship_name,
        COUNT(CASE WHEN ship_name = '' THEN NULL ELSE ship_name END) as with_valid_ship_name
      FROM cruises
      WHERE is_active = true
    `);

    const stats = verifyResult.rows[0];
    console.log('Verification:');
    console.log(`Total active cruises: ${stats.total}`);
    console.log(`With ship_name populated: ${stats.with_ship_name} (${(stats.with_ship_name/stats.total*100).toFixed(1)}%)`);
    console.log(`With valid ship_name: ${stats.with_valid_ship_name} (${(stats.with_valid_ship_name/stats.total*100).toFixed(1)}%)`);

    // Show some samples
    const sampleResult = await pool.query(`
      SELECT
        ship_name,
        COUNT(*) as count
      FROM cruises
      WHERE is_active = true
        AND ship_name IS NOT NULL
      GROUP BY ship_name
      ORDER BY count DESC
      LIMIT 10
    `);

    console.log('\nTop 10 ships by cruise count:');
    sampleResult.rows.forEach((row, i) => {
      console.log(`${i+1}. ${row.ship_name}: ${row.count} cruises`);
    });

    console.log('\n✅ Ship name population completed!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

populateShipNames();
