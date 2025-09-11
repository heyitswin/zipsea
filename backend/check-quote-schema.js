const { Client } = require('pg');

async function checkQuoteSchema() {
  const client = new Client({
    connectionString: 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check if quote_requests table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'quote_requests'
      );
    `);
    console.log('Table exists:', tableExists.rows[0].exists);

    if (tableExists.rows[0].exists) {
      // Get column information
      const columns = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'quote_requests'
        ORDER BY ordinal_position;
      `);

      console.log('\nColumns in quote_requests table:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
      });

      // Get sample data
      const sampleData = await client.query(`
        SELECT * FROM quote_requests
        ORDER BY created_at DESC
        LIMIT 3;
      `);
      console.log('\nSample data (', sampleData.rows.length, 'rows):');
      console.log(JSON.stringify(sampleData.rows, null, 2));
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkQuoteSchema();
