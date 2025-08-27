#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixSyncLocksConstraint() {
  console.log('Fixing sync_locks constraint issue...');
  
  try {
    // 1. Drop the problematic unique constraint
    console.log('\n1. Dropping old unique constraint...');
    await pool.query(`
      ALTER TABLE sync_locks 
      DROP CONSTRAINT IF EXISTS unique_active_lock
    `);
    console.log('✅ Dropped old constraint');
    
    // 2. Create a partial unique index instead of constraint (better compatibility)
    console.log('\n2. Creating partial unique index for processing status...');
    
    // First drop any existing index
    await pool.query(`
      DROP INDEX IF EXISTS idx_unique_processing_lock
    `);
    
    // Create partial unique index
    await pool.query(`
      CREATE UNIQUE INDEX idx_unique_processing_lock 
      ON sync_locks (cruise_line_id, lock_type) 
      WHERE status = 'processing'
    `);
    console.log('✅ Created unique index - only one PROCESSING lock allowed per cruise line');
    
    // 3. Clean up any duplicate completed locks
    console.log('\n3. Cleaning up duplicate completed locks...');
    const result = await pool.query(`
      DELETE FROM sync_locks 
      WHERE id IN (
        SELECT id FROM (
          SELECT id, 
                 ROW_NUMBER() OVER (
                   PARTITION BY cruise_line_id, lock_type, status 
                   ORDER BY completed_at DESC NULLS LAST, id DESC
                 ) as rn
          FROM sync_locks
          WHERE status = 'completed'
        ) t
        WHERE rn > 1
      )
      RETURNING id
    `);
    console.log(`✅ Cleaned up ${result.rowCount} duplicate completed locks`);
    
    // 4. Show current locks status
    console.log('\n4. Current sync locks status:');
    const status = await pool.query(`
      SELECT 
        cruise_line_id,
        lock_type,
        status,
        COUNT(*) as count
      FROM sync_locks
      GROUP BY cruise_line_id, lock_type, status
      ORDER BY cruise_line_id, status
    `);
    
    console.table(status.rows);
    
    console.log('\n✅ Constraint fix completed successfully!');
    console.log('The system can now have multiple completed locks per cruise line.');
    console.log('Only one PROCESSING lock is allowed per cruise line at a time.');
    
  } catch (error) {
    console.error('❌ Failed to fix constraint:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

fixSyncLocksConstraint();