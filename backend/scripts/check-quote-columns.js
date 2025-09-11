const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function checkQuoteColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Get all columns from quote_requests table
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'quote_requests'
      ORDER BY ordinal_position;
    `);

    console.log('Columns in quote_requests table:');
    console.log('='.repeat(50));

    for (const row of result.rows) {
      console.log(`${row.column_name.padEnd(30)} ${row.data_type}`);
    }

    console.log('\n' + '='.repeat(50));
    console.log(`Total columns: ${result.rows.length}`);

    // Check if any column contains 'reference' in its name
    const refColumns = result.rows.filter(row =>
      row.column_name.toLowerCase().includes('reference')
    );

    if (refColumns.length > 0) {
      console.log('\nColumns containing "reference":');
      refColumns.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('\nNo columns containing "reference" found!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkQuoteColumns();
