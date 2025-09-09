#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function runSafeMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();

    console.log('\n🔍 Checking existing tables...');

    // Check which tables already exist
    const existingTables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('webhook_events', 'system_flags', 'price_snapshots', 'sync_locks', 'webhook_processing_log')
    `);

    const existing = existingTables.rows.map(r => r.table_name);
    console.log('Existing tables:', existing.length > 0 ? existing.join(', ') : 'none');

    // Drop existing tables if they exist (to avoid partial state issues)
    if (existing.length > 0) {
      console.log('\n⚠️  Dropping existing webhook tables to ensure clean state...');
      await client.query('BEGIN');
      try {
        // Drop in reverse dependency order
        await client.query('DROP TABLE IF EXISTS webhook_processing_log CASCADE');
        await client.query('DROP TABLE IF EXISTS sync_locks CASCADE');
        await client.query('DROP TABLE IF EXISTS price_snapshots CASCADE');
        await client.query('DROP TABLE IF EXISTS system_flags CASCADE');
        await client.query('DROP TABLE IF EXISTS webhook_events CASCADE');
        await client.query('COMMIT');
        console.log('✅ Existing tables dropped');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log('\n📝 Creating webhook tables...');

    // Create tables
    await client.query(`
      -- 1. Create webhook_events table
      CREATE TABLE webhook_events (
          id SERIAL PRIMARY KEY,
          line_id INTEGER NOT NULL,
          webhook_type VARCHAR(50),
          status VARCHAR(50) DEFAULT 'pending',
          received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processed_at TIMESTAMP,
          metadata JSONB,
          error_message TEXT,
          retry_count INTEGER DEFAULT 0
      )
    `);
    console.log('✅ Created webhook_events');

    await client.query(`
      -- 2. Create system_flags table
      CREATE TABLE system_flags (
          id SERIAL PRIMARY KEY,
          key VARCHAR(100) UNIQUE NOT NULL,
          value TEXT,
          flag_type VARCHAR(50),
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created system_flags');

    await client.query(`
      -- 3. Create price_snapshots table
      CREATE TABLE price_snapshots (
          id SERIAL PRIMARY KEY,
          cruise_id INTEGER NOT NULL,
          snapshot_type VARCHAR(50) DEFAULT 'before',
          static_price DECIMAL(10,2),
          cached_price DECIMAL(10,2),
          cheapest_cabin_price DECIMAL(10,2),
          snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          webhook_event_id INTEGER REFERENCES webhook_events(id),
          price_change_detected BOOLEAN DEFAULT false,
          metadata JSONB
      )
    `);
    console.log('✅ Created price_snapshots');

    await client.query(`
      -- 4. Create sync_locks table
      CREATE TABLE sync_locks (
          id SERIAL PRIMARY KEY,
          cruise_line_id INTEGER NOT NULL,
          locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP,
          locked_by VARCHAR(255),
          status VARCHAR(50) DEFAULT 'processing',
          completed_at TIMESTAMP,
          metadata JSONB
      )
    `);
    console.log('✅ Created sync_locks');

    await client.query(`
      -- 5. Create webhook_processing_log table
      CREATE TABLE webhook_processing_log (
          id SERIAL PRIMARY KEY,
          webhook_event_id INTEGER REFERENCES webhook_events(id),
          cruise_id INTEGER,
          action VARCHAR(50),
          status VARCHAR(50),
          message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created webhook_processing_log');

    console.log('\n🔧 Creating indexes...');

    // Create indexes
    const indexes = [
      'CREATE INDEX idx_webhook_events_status ON webhook_events(status)',
      'CREATE INDEX idx_webhook_events_line_id ON webhook_events(line_id)',
      'CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at DESC)',
      'CREATE INDEX idx_system_flags_type ON system_flags(flag_type)',
      'CREATE INDEX idx_system_flags_key ON system_flags(key)',
      'CREATE INDEX idx_price_snapshots_cruise_id ON price_snapshots(cruise_id)',
      'CREATE INDEX idx_price_snapshots_date ON price_snapshots(snapshot_date DESC)',
      'CREATE INDEX idx_price_snapshots_webhook ON price_snapshots(webhook_event_id)',
      'CREATE INDEX idx_sync_locks_line_id ON sync_locks(cruise_line_id)',
      'CREATE INDEX idx_sync_locks_status ON sync_locks(status)',
      'CREATE INDEX idx_webhook_log_event ON webhook_processing_log(webhook_event_id)',
      'CREATE INDEX idx_webhook_log_cruise ON webhook_processing_log(cruise_id)'
    ];

    for (const indexSql of indexes) {
      try {
        await client.query(indexSql);
        const indexName = indexSql.match(/CREATE INDEX (\w+)/)[1];
        console.log(`  ✅ ${indexName}`);
      } catch (error) {
        console.log(`  ⚠️  Index might already exist: ${error.message}`);
      }
    }

    console.log('\n💬 Adding table comments...');

    // Add comments
    await client.query(`
      COMMENT ON TABLE webhook_events IS 'Stores all incoming webhook events from Traveltek';
      COMMENT ON TABLE system_flags IS 'System-wide flags for feature toggles and processing states';
      COMMENT ON TABLE price_snapshots IS 'Historical price snapshots for cruises, captured before and after updates';
      COMMENT ON TABLE sync_locks IS 'Distributed locks to prevent concurrent processing of the same cruise line';
      COMMENT ON TABLE webhook_processing_log IS 'Detailed log of webhook processing actions for debugging and audit';
    `);

    console.log('\n✅ Migration completed successfully!');

    // Verify final state
    console.log('\n📊 Final verification:');
    const tables = [
      'webhook_events',
      'system_flags',
      'price_snapshots',
      'sync_locks',
      'webhook_processing_log',
    ];

    for (const table of tables) {
      const result = await client.query(
        `SELECT
          (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = $1) as exists,
          (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = $1) as column_count`,
        [table]
      );
      const row = result.rows[0];
      console.log(`  ${table}: ${row.exists > 0 ? `✅ Created (${row.column_count} columns)` : '❌ Not found'}`);
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSafeMigration();
