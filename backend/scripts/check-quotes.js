const { Pool } = require('pg');
require('dotenv').config();

async function checkQuotes() {
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION;

  if (!connectionString) {
    console.error('❌ No database connection string found');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔍 Checking quote_requests table...\n');

    // Check total count
    const countResult = await pool.query('SELECT COUNT(*) as total FROM quote_requests');
    console.log(`📊 Total quotes in database: ${countResult.rows[0].total}`);

    // Get recent quotes
    const recentQuotes = await pool.query(`
      SELECT id, email, status, created_at, reference_number
      FROM quote_requests
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (recentQuotes.rows.length > 0) {
      console.log('\n📋 Recent quotes:');
      recentQuotes.rows.forEach(quote => {
        console.log(
          `  - ID: ${quote.id.substring(0, 8)}... | Email: ${quote.email} | Status: ${quote.status} | Date: ${quote.created_at}`
        );
      });
    }

    // Check status distribution
    const statusResult = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM quote_requests
      GROUP BY status
    `);

    console.log('\n📈 Quote status distribution:');
    statusResult.rows.forEach(row => {
      console.log(`  - ${row.status || 'null'}: ${row.count} quotes`);
    });
  } catch (error) {
    console.error('❌ Error checking quotes:', error);
  } finally {
    await pool.end();
  }
}

checkQuotes();
