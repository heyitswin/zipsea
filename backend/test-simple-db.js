const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
  query_timeout: 5000,
  statement_timeout: 5000,
  idle_in_transaction_session_timeout: 5000,
});

async function test() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    console.log('Running simple query...');
    const result = await client.query('SELECT 1 as test');
    console.log('Query result:', result.rows);

    console.log('Checking cruises table...');
    const count = await client.query('SELECT COUNT(*) FROM cruises LIMIT 1');
    console.log('Cruises count:', count.rows[0]);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
    console.log('Connection closed');
  }
}

test();
