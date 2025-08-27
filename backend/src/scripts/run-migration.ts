#!/usr/bin/env ts-node

import { db } from '../db/connection';
import { sql } from 'drizzle-orm';
import logger from '../config/logger';

async function runMigration() {
  logger.info('🚀 Running migration to create sync_locks table...');
  
  try {
    // Create sync_locks table
    await db.execute(sql`
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
    
    logger.info('✅ Created sync_locks table');
    
    // Add unique constraint
    await db.execute(sql`
      ALTER TABLE sync_locks 
      DROP CONSTRAINT IF EXISTS unique_active_lock
    `);
    
    await db.execute(sql`
      ALTER TABLE sync_locks 
      ADD CONSTRAINT unique_active_lock 
      UNIQUE (cruise_line_id, lock_type, status)
    `);
    
    logger.info('✅ Added unique constraint');
    
    // Create index
    await db.execute(sql`
      DROP INDEX IF EXISTS idx_sync_locks_active
    `);
    
    await db.execute(sql`
      CREATE INDEX idx_sync_locks_active 
      ON sync_locks(cruise_line_id, status) 
      WHERE status = 'processing'
    `);
    
    logger.info('✅ Created index');
    
    // Add columns to cruises table
    await db.execute(sql`
      ALTER TABLE cruises 
      ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP
    `);
    
    await db.execute(sql`
      ALTER TABLE cruises 
      ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP
    `);
    
    logger.info('✅ Added columns to cruises table');
    
    // Create index on cruises
    await db.execute(sql`
      DROP INDEX IF EXISTS idx_cruises_needs_update_line
    `);
    
    await db.execute(sql`
      CREATE INDEX idx_cruises_needs_update_line 
      ON cruises(cruise_line_id, needs_price_update) 
      WHERE needs_price_update = true
    `);
    
    logger.info('✅ Created cruises index');
    
    // Add table comment
    await db.execute(sql`
      COMMENT ON TABLE sync_locks IS 'Manages concurrent sync operations to prevent overlapping updates'
    `);
    
    logger.info('✅ Migration completed successfully');
    
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

runMigration().catch(console.error);