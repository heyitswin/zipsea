#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMissingMigrations() {
  console.log('Running missing migrations for staging/production database...');
  
  try {
    // 1. Add needs_price_update column
    console.log('\n1. Adding needs_price_update column to cruises table...');
    await pool.query(`
      ALTER TABLE cruises 
      ADD COLUMN IF NOT EXISTS needs_price_update BOOLEAN DEFAULT false
    `);
    console.log('✅ Added needs_price_update column');
    
    // 2. Add price_update_requested_at column
    console.log('\n2. Adding price_update_requested_at column...');
    await pool.query(`
      ALTER TABLE cruises 
      ADD COLUMN IF NOT EXISTS price_update_requested_at TIMESTAMP
    `);
    console.log('✅ Added price_update_requested_at column');
    
    // 3. Create index for needs_price_update
    console.log('\n3. Creating index on needs_price_update...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cruises_needs_price_update 
      ON cruises(needs_price_update) 
      WHERE needs_price_update = true
    `);
    console.log('✅ Created index on needs_price_update');
    
    // 4. Create webhook_events table if it doesn't exist
    console.log('\n4. Creating webhook_events table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(255) UNIQUE,
        line_id INTEGER,
        event_type VARCHAR(100),
        payload JSONB,
        processed BOOLEAN DEFAULT false,
        processing_time_ms INTEGER,
        successful_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created webhook_events table');
    
    // 5. Create price_history table if it doesn't exist
    console.log('\n5. Creating price_history table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS price_history (
        id SERIAL PRIMARY KEY,
        cruise_id INTEGER NOT NULL,
        interior_price DECIMAL(10,2),
        oceanview_price DECIMAL(10,2),
        balcony_price DECIMAL(10,2),
        suite_price DECIMAL(10,2),
        snapshot_type VARCHAR(20),
        webhook_event_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cruise_id) REFERENCES cruises(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Created price_history table');
    
    // 6. Add price columns to cruises if missing
    console.log('\n6. Adding price columns to cruises table...');
    const priceColumns = [
      'interior_cheapest_price',
      'oceanview_cheapest_price', 
      'balcony_cheapest_price',
      'suite_cheapest_price'
    ];
    
    for (const column of priceColumns) {
      await pool.query(`
        ALTER TABLE cruises 
        ADD COLUMN IF NOT EXISTS ${column} DECIMAL(10,2)
      `);
    }
    console.log('✅ Added price columns');
    
    // 7. Now run the sync_locks migration
    console.log('\n7. Creating sync_locks table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sync_locks (
        id SERIAL PRIMARY KEY,
        cruise_line_id INTEGER NOT NULL,
        lock_type VARCHAR(50) NOT NULL,
        locked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        locked_by VARCHAR(255),
        status VARCHAR(50) DEFAULT 'processing',
        total_cruises INTEGER,
        processed_cruises INTEGER DEFAULT 0,
        successful_updates INTEGER DEFAULT 0,
        failed_updates INTEGER DEFAULT 0,
        error_message TEXT,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created sync_locks table');
    
    // Add constraints and indexes for sync_locks
    await pool.query(`
      ALTER TABLE sync_locks 
      DROP CONSTRAINT IF EXISTS unique_active_lock
    `);
    
    await pool.query(`
      ALTER TABLE sync_locks 
      ADD CONSTRAINT unique_active_lock 
      UNIQUE (cruise_line_id, lock_type, status)
    `);
    
    await pool.query(`
      DROP INDEX IF EXISTS idx_sync_locks_active
    `);
    
    await pool.query(`
      CREATE INDEX idx_sync_locks_active 
      ON sync_locks(cruise_line_id, status) 
      WHERE status = 'processing'
    `);
    console.log('✅ Added sync_locks constraints and indexes');
    
    // 8. Add processing columns to cruises
    console.log('\n8. Adding processing columns to cruises...');
    await pool.query(`
      ALTER TABLE cruises 
      ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP
    `);
    
    await pool.query(`
      ALTER TABLE cruises 
      ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP
    `);
    console.log('✅ Added processing columns');
    
    // 9. Create the needs_update index for cruise lines
    console.log('\n9. Creating cruise line update index...');
    await pool.query(`
      DROP INDEX IF EXISTS idx_cruises_needs_update_line
    `);
    
    await pool.query(`
      CREATE INDEX idx_cruises_needs_update_line 
      ON cruises(cruise_line_id, needs_price_update) 
      WHERE needs_price_update = true
    `);
    console.log('✅ Created cruise line update index');
    
    console.log('\n✅ All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

runMissingMigrations();