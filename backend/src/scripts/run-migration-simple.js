#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  console.log('Running migration to create sync_locks table...');
  
  try {
    // Create sync_locks table
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
    
    // Add constraints and indexes
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
    
    console.log('✅ Added constraints and indexes');
    
    // Add columns to cruises table
    await pool.query(`
      ALTER TABLE cruises 
      ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP
    `);
    
    await pool.query(`
      ALTER TABLE cruises 
      ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP
    `);
    
    await pool.query(`
      DROP INDEX IF EXISTS idx_cruises_needs_update_line
    `);
    
    await pool.query(`
      CREATE INDEX idx_cruises_needs_update_line 
      ON cruises(cruise_line_id, needs_price_update) 
      WHERE needs_price_update = true
    `);
    
    console.log('✅ Updated cruises table');
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

runMigration();