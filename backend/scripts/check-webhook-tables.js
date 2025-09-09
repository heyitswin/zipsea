#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function checkWebhookTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();

    console.log('\n🔍 Checking webhook_events table structure...');

    // Get column information
    const columnsQuery = `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'webhook_events'
      ORDER BY ordinal_position;
    `;

    const result = await client.query(columnsQuery);

    if (result.rows.length === 0) {
      console.log('❌ webhook_events table does not exist!');
      return;
    }

    console.log('\n📋 Columns in webhook_events table:');
    console.log('--------------------------------');
    result.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(20)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`);
    });

    // Check for specific columns we expect
    const expectedColumns = ['line_id', 'webhook_type', 'status', 'metadata', 'received_at', 'processed_at', 'error_message'];
    const actualColumns = result.rows.map(r => r.column_name);

    console.log('\n✅ Expected columns present:');
    expectedColumns.forEach(col => {
      const exists = actualColumns.includes(col);
      console.log(`  ${col.padEnd(20)} ${exists ? '✅' : '❌ MISSING'}`);
    });

    console.log('\n⚠️  Unexpected columns (if any):');
    actualColumns.forEach(col => {
      if (!expectedColumns.includes(col) && col !== 'id' && col !== 'retry_count') {
        console.log(`  ${col} (unexpected)`);
      }
    });

    // Check sample data
    const countQuery = 'SELECT COUNT(*) as count FROM webhook_events';
    const countResult = await client.query(countQuery);
    console.log(`\n📊 Total records in webhook_events: ${countResult.rows[0].count}`);

    if (countResult.rows[0].count > 0) {
      const sampleQuery = 'SELECT * FROM webhook_events ORDER BY id DESC LIMIT 3';
      const sampleResult = await client.query(sampleQuery);
      console.log('\n📄 Sample records:');
      sampleResult.rows.forEach(row => {
        console.log(`  ID: ${row.id}, Line: ${row.line_id}, Type: ${row.webhook_type}, Status: ${row.status}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
  } finally {
    await client.end();
  }
}

checkWebhookTables();
