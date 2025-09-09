const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false
});

async function checkTables() {
  try {
    await client.connect();
    console.log('Connected to database\n');

    // Get all tables
    const tablesQuery = `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;

    const result = await client.query(tablesQuery);

    console.log('Available tables:');
    result.rows.forEach(row => {
      console.log(`  - ${row.tablename}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkTables();
