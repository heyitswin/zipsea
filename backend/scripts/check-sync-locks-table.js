#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function checkSyncLocksTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();

    console.log('\n🔍 Checking sync_locks table structure...');

    // Check if table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'sync_locks'
      )
    `;
    const tableExists = await client.query(tableExistsQuery);

    if (!tableExists.rows[0].exists) {
      console.log('❌ sync_locks table does not exist!');
      return;
    }

    // Get column information
    const columnsQuery = `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'sync_locks'
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;

    const result = await client.query(columnsQuery);

    console.log('\n📋 Columns in sync_locks table:');
    console.log('--------------------------------');
    result.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(20)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`);
    });

    // Check for specific columns we're looking for
    const columnNames = result.rows.map(r => r.column_name);
    console.log('\n🔍 Column checks:');
    console.log(`  Has 'lock_key' column: ${columnNames.includes('lock_key') ? '✅' : '❌'}`);
    console.log(`  Has 'lockKey' column: ${columnNames.includes('lockKey') ? '✅' : '❌'}`);
    console.log(`  Has 'cruise_line_id' column: ${columnNames.includes('cruise_line_id') ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkSyncLocksTable();
