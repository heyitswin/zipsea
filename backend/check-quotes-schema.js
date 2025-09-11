const { Client } = require('pg');
require('dotenv').config();

async function checkQuotesSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
  });

  try {
    console.log('Connecting to database...');
    await client.connect();

    // Check what columns exist in quote_requests table
    const schemaQuery = `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'quote_requests'
      ORDER BY ordinal_position;
    `;

    console.log('\nColumns in quote_requests table:');
    console.log('================================');
    const result = await client.query(schemaQuery);

    result.rows.forEach(row => {
      console.log(`${row.column_name.padEnd(25)} ${row.data_type.padEnd(20)} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Check a sample row
    const sampleQuery = `
      SELECT * FROM quote_requests
      LIMIT 1;
    `;

    const sampleResult = await client.query(sampleQuery);
    if (sampleResult.rows.length > 0) {
      console.log('\n\nSample row from quote_requests:');
      console.log('================================');
      console.log(JSON.stringify(sampleResult.rows[0], null, 2));
    } else {
      console.log('\n\nNo rows found in quote_requests table');
    }

    // Check cruise_id data type in cruises table
    const cruiseSchemaQuery = `
      SELECT
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'cruises' AND column_name = 'id'
      LIMIT 1;
    `;

    const cruiseResult = await client.query(cruiseSchemaQuery);
    if (cruiseResult.rows.length > 0) {
      console.log('\n\nCruises table ID column:');
      console.log('========================');
      console.log(`cruises.id: ${cruiseResult.rows[0].data_type}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.position) {
      console.error('Position:', error.position);
    }
  } finally {
    await client.end();
  }
}

checkQuotesSchema();
