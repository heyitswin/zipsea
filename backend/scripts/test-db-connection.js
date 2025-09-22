/**
 * Quick database connection test
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function test() {
  console.log('Testing database connection...\n');

  // Try with environment variable first
  const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION;

  if (!dbUrl) {
    console.log('❌ No DATABASE_URL found in environment');
    console.log(
      'Available env vars:',
      Object.keys(process.env).filter(k => k.includes('DATABASE'))
    );
    return;
  }

  console.log('Using DATABASE_URL:', dbUrl.substring(0, 30) + '...');

  try {
    const sql = postgres(dbUrl, {
      ssl: { rejectUnauthorized: false },
      max: 1,
      idle_timeout: 5,
      connect_timeout: 10,
    });

    console.log('Connection created, testing query...');

    // Simple count query
    const result = await sql`SELECT COUNT(*) as count FROM cruises LIMIT 1`;
    console.log('✅ Database connected! Total cruises:', result[0].count);

    // Test if we can read raw_data
    const sample = await sql`
      SELECT id, name, raw_data IS NOT NULL as has_raw_data
      FROM cruises
      LIMIT 1
    `;
    console.log('✅ Sample cruise:', sample[0]);

    await sql.end();
    console.log('✅ Connection closed successfully');
  } catch (error) {
    console.error('❌ Database error:', error.message);
    console.error('Full error:', error);
  }
}

test();
