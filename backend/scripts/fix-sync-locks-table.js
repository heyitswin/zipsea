#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function fixSyncLocksTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();

    console.log('\n🔍 Checking current sync_locks structure...');

    // Get current columns
    const columnsQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'sync_locks'
      AND table_schema = 'public'
    `;

    const result = await client.query(columnsQuery);
    const columnNames = result.rows.map(r => r.column_name);

    console.log('Current columns:', columnNames.join(', '));

    // Begin transaction
    await client.query('BEGIN');

    try {
      // Drop the old table
      console.log('\n🗑️ Dropping old sync_locks table...');
      await client.query('DROP TABLE IF EXISTS sync_locks CASCADE');

      // Create new table with correct structure
      console.log('✨ Creating new sync_locks table with correct structure...');
      await client.query(`
        CREATE TABLE sync_locks (
          id SERIAL PRIMARY KEY,
          lock_key VARCHAR(255) UNIQUE NOT NULL,
          is_active BOOLEAN DEFAULT true NOT NULL,
          acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          released_at TIMESTAMP,
          metadata JSONB
        )
      `);

      // Create indexes
      console.log('📇 Creating indexes...');
      await client.query('CREATE INDEX idx_sync_locks_key ON sync_locks(lock_key)');
      await client.query('CREATE INDEX idx_sync_locks_active ON sync_locks(is_active)');

      await client.query('COMMIT');
      console.log('\n✅ sync_locks table fixed successfully!');

      // Verify new structure
      const newColumnsQuery = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'sync_locks'
        ORDER BY ordinal_position
      `;

      const newResult = await client.query(newColumnsQuery);
      console.log('\n📋 New columns:');
      newResult.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixSyncLocksTable();
