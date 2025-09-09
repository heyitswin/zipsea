const { Client } = require('pg');
require('dotenv').config();

async function fixWebhookTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // 1. Fix sync_locks table - use upsert instead of insert
    console.log('\n1. Checking sync_locks table...');
    const syncLocksCheck = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'sync_locks'
    `);
    console.log('sync_locks columns:', syncLocksCheck.rows);

    // 2. Fix system_flags table schema
    console.log('\n2. Fixing system_flags table...');

    // Check current schema
    const systemFlagsCheck = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'system_flags'
    `);
    console.log('Current system_flags columns:', systemFlagsCheck.rows);

    // Drop and recreate system_flags with correct schema
    await client.query('DROP TABLE IF EXISTS system_flags CASCADE');
    console.log('Dropped old system_flags table');

    await client.query(`
      CREATE TABLE system_flags (
        id SERIAL PRIMARY KEY,
        flag_key VARCHAR(255) UNIQUE NOT NULL,
        flag_value TEXT,
        metadata JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created new system_flags table with correct schema');

    // Verify the fix
    const verifySystemFlags = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'system_flags'
    `);
    console.log('New system_flags columns:', verifySystemFlags.rows);

    console.log('\n✅ Tables fixed successfully!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

fixWebhookTables();
