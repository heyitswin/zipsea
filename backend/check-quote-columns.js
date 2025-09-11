const { Client } = require('pg');

async function checkColumns() {
  const client = new Client({
    connectionString: 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000
  });

  try {
    console.log('Checking quote_requests columns...\n');
    await client.connect();

    const schemaQuery = `
      SELECT
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'quote_requests'
      ORDER BY ordinal_position;
    `;

    const result = await client.query(schemaQuery);

    console.log('Columns in quote_requests table:');
    console.log('================================');
    result.rows.forEach(row => {
      console.log(`${row.column_name.padEnd(30)} ${row.data_type}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkColumns();
