const { Client } = require('pg');
require('dotenv').config();

async function fixSystemFlagsTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check current schema
    const currentSchema = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'system_flags'
      ORDER BY ordinal_position
    `);

    console.log('Current system_flags columns:');
    currentSchema.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // Drop and recreate with correct schema
    console.log('\nDropping old system_flags table...');
    await client.query('DROP TABLE IF EXISTS system_flags CASCADE');

    console.log('Creating new system_flags table with correct schema...');
    await client.query(`
      CREATE TABLE system_flags (
        id SERIAL PRIMARY KEY,
        flag_key VARCHAR(255) UNIQUE NOT NULL,
        flag_value TEXT,
        flag_type VARCHAR(50),
        description TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await client.query('CREATE INDEX idx_system_flags_type ON system_flags(flag_type)');
    await client.query('CREATE INDEX idx_system_flags_key ON system_flags(flag_key)');

    // Verify the fix
    const newSchema = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'system_flags'
      ORDER BY ordinal_position
    `);

    console.log('\nNew system_flags columns:');
    newSchema.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    console.log('\n✅ system_flags table fixed successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixSystemFlagsTable();
