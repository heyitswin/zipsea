const { Client } = require('pg');
require('dotenv').config();

async function testConnection() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000
  });

  try {
    console.log('Connecting to database...');
    await client.connect();

    // Simple test query
    const result = await client.query('SELECT NOW()');
    console.log('Connected successfully!');
    console.log('Current time from database:', result.rows[0].now);

    // Get list of tables
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
      LIMIT 20;
    `;

    const tables = await client.query(tablesQuery);
    console.log('\nTables in database:');
    tables.rows.forEach(row => {
      console.log('  -', row.table_name);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

testConnection();
