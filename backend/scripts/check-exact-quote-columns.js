const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function checkExactQuoteColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Get all columns from quote_requests table
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'quote_requests'
      ORDER BY ordinal_position;
    `);

    console.log('ACTUAL columns in quote_requests table:');
    console.log('='.repeat(60));

    const columns = [];
    for (const row of result.rows) {
      console.log(`${row.column_name.padEnd(30)} ${row.data_type.padEnd(20)} ${row.is_nullable}`);
      columns.push(row.column_name);
    }

    console.log('\n' + '='.repeat(60));
    console.log('CHECKING for expected columns from schema:');
    console.log('='.repeat(60));

    const expectedColumns = [
      'id',
      'reference_number',
      'user_id',
      'cruise_id',
      'cabin_code',
      'cabin_type',
      'passenger_count',
      'passenger_details',
      'special_requirements',
      'contact_info',
      'first_name',
      'last_name',
      'email',
      'phone',
      'preferred_cabin_type',
      'special_requests',
      'preferences',
      'status',
      'total_price',
      'obc_amount',
      'commission',
      'notes',
      'quote_response',
      'quote_expires_at',
      'quoted_at',
      'booked_at',
      'is_urgent',
      'source',
      'created_at',
      'updated_at'
    ];

    const missingColumns = [];
    const existingColumns = [];

    for (const col of expectedColumns) {
      if (columns.includes(col)) {
        existingColumns.push(col);
        console.log(`✓ ${col} - EXISTS`);
      } else {
        missingColumns.push(col);
        console.log(`✗ ${col} - MISSING`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY:');
    console.log(`Total columns in table: ${columns.length}`);
    console.log(`Expected columns: ${expectedColumns.length}`);
    console.log(`Existing columns: ${existingColumns.length}`);
    console.log(`Missing columns: ${missingColumns.length}`);

    if (missingColumns.length > 0) {
      console.log('\nMISSING COLUMNS:');
      missingColumns.forEach(col => console.log(`  - ${col}`));
    }

    // Check for unexpected columns (in DB but not in our expected list)
    const unexpectedColumns = columns.filter(col => !expectedColumns.includes(col));
    if (unexpectedColumns.length > 0) {
      console.log('\nUNEXPECTED COLUMNS (in DB but not in schema):');
      unexpectedColumns.forEach(col => console.log(`  - ${col}`));
    }

    // Test a simple query
    console.log('\n' + '='.repeat(60));
    console.log('TESTING simple query:');
    try {
      const testResult = await client.query(`
        SELECT COUNT(*) as count FROM quote_requests;
      `);
      console.log(`Total quotes in table: ${testResult.rows[0].count}`);
    } catch (error) {
      console.log('Failed to count quotes:', error.message);
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

checkExactQuoteColumns();
