const { Pool } = require('pg');

async function checkFlags() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔍 Checking cruise flags...\n');

    // Check if column exists
    const colCheck = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'cruises'
      AND column_name = 'needs_price_update'
    `);

    console.log('Column info:', colCheck.rows);

    // Count true vs false
    const counts = await pool.query(`
      SELECT
        needs_price_update,
        COUNT(*) as count
      FROM cruises
      GROUP BY needs_price_update
    `);

    console.log('\n📊 Flag distribution:');
    counts.rows.forEach(row => {
      console.log(`  needs_price_update = ${row.needs_price_update}: ${row.count} cruises`);
    });

    // Sample some records
    const sample = await pool.query(`
      SELECT id, cruise_line_id, needs_price_update, price_update_requested_at
      FROM cruises
      WHERE needs_price_update = true
      LIMIT 5
    `);

    console.log('\n📋 Sample of flagged cruises:');
    sample.rows.forEach(row => {
      console.log(`  ID: ${row.id}, Line: ${row.cruise_line_id}, Flag: ${row.needs_price_update}, Requested: ${row.price_update_requested_at}`);
    });

    // Check if it's a NULL issue
    const nullCheck = await pool.query(`
      SELECT COUNT(*) as null_count
      FROM cruises
      WHERE needs_price_update IS NULL
    `);

    console.log(`\n❓ Cruises with NULL flag: ${nullCheck.rows[0].null_count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkFlags();
