const { Pool } = require('pg');

async function testPendingQuery() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔍 Testing the exact query from pending-syncs endpoint...\n');

    // Run the exact query from the endpoint
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_pending,
        COUNT(DISTINCT cruise_line_id) as unique_lines,
        MIN(price_update_requested_at) as oldest_request,
        MAX(price_update_requested_at) as newest_request
      FROM cruises
      WHERE needs_price_update = true
    `);

    console.log('Summary query result:');
    console.log(result.rows[0]);

    // Check what happens without WHERE clause
    const allCount = await pool.query(`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(DISTINCT cruise_line_id) as unique_lines
      FROM cruises
    `);

    console.log('\nTotal cruises in database:');
    console.log(allCount.rows[0]);

    // Check if there's a view or something interfering
    const tableInfo = await pool.query(`
      SELECT
        schemaname,
        tablename,
        tableowner
      FROM pg_tables
      WHERE tablename = 'cruises'
    `);

    console.log('\nTable info:');
    console.log(tableInfo.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testPendingQuery();
