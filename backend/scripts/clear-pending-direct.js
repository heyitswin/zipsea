const { Pool } = require('pg');

async function clearPending() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Simple, direct update
    console.log('🔧 Running direct UPDATE to clear flags...');
    console.time('Update time');

    const result = await pool.query(`
      UPDATE cruises
      SET needs_price_update = false
      WHERE needs_price_update = true
    `);

    console.timeEnd('Update time');
    console.log(`✅ Updated ${result.rowCount} rows`);

    // Verify
    const check = await pool.query(`
      SELECT COUNT(*) as remaining
      FROM cruises
      WHERE needs_price_update = true
    `);

    console.log(`📊 Remaining pending: ${check.rows[0].remaining}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

clearPending();
