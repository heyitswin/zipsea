#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function checkDatabaseConnection() {
  console.log('\n🔍 Checking database connection details...\n');

  // Show DATABASE_URL (masked)
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    const masked = dbUrl.replace(/:([^@]+)@/, ':****@');
    console.log('DATABASE_URL:', masked);

    // Parse database name
    const dbNameMatch = dbUrl.match(/\/([^?]+)(\?|$)/);
    const dbName = dbNameMatch ? dbNameMatch[1] : 'unknown';
    console.log('Database name:', dbName);

    // Parse host
    const hostMatch = dbUrl.match(/@([^:/]+)/);
    const host = hostMatch ? hostMatch[1] : 'unknown';
    console.log('Host:', host);
  } else {
    console.log('DATABASE_URL: Not set!');
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('\n📊 Connecting to database...');
    await client.connect();

    // Get current database
    const dbResult = await client.query('SELECT current_database()');
    console.log('Current database:', dbResult.rows[0].current_database);

    // Get current user
    const userResult = await client.query('SELECT current_user');
    console.log('Current user:', userResult.rows[0].current_user);

    // Get current schema
    const schemaResult = await client.query('SELECT current_schema()');
    console.log('Current schema:', schemaResult.rows[0].current_schema);

    // Check if webhook_events table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'webhook_events'
      )
    `;
    const tableExists = await client.query(tableExistsQuery);
    console.log('\n✅ webhook_events table exists:', tableExists.rows[0].exists);

    if (tableExists.rows[0].exists) {
      // Get column information
      const columnsQuery = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'webhook_events'
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `;
      const columns = await client.query(columnsQuery);
      console.log('\n📋 Columns in webhook_events:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });

      // Check specifically for line_id column
      const hasLineId = columns.rows.some(col => col.column_name === 'line_id');
      console.log('\n🔍 Has line_id column:', hasLineId ? '✅ YES' : '❌ NO');
    }

    // Test insert
    console.log('\n🧪 Testing insert...');
    try {
      const result = await client.query(
        'INSERT INTO webhook_events (line_id, webhook_type, status, metadata) VALUES ($1, $2, $3, $4) RETURNING id',
        [999, 'connection_test', 'test', '{}']
      );
      console.log('✅ Insert successful! ID:', result.rows[0].id);

      // Clean up
      await client.query('DELETE FROM webhook_events WHERE id = $1', [result.rows[0].id]);
      console.log('🧹 Test record cleaned up');
    } catch (error) {
      console.log('❌ Insert failed:', error.message);
    }

  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
  } finally {
    await client.end();
  }
}

checkDatabaseConnection();
