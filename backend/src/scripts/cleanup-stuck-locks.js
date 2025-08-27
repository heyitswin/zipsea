#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function cleanupStuckLocks() {
  console.log('Cleaning up stuck processing locks...');
  
  try {
    // 1. Find stuck processing locks (older than 10 minutes)
    console.log('\n1. Finding stuck processing locks...');
    const stuckLocks = await pool.query(`
      SELECT id, cruise_line_id, locked_at, locked_by
      FROM sync_locks
      WHERE status = 'processing'
        AND locked_at < NOW() - INTERVAL '10 minutes'
    `);
    
    console.log(`Found ${stuckLocks.rowCount} stuck processing locks`);
    
    if (stuckLocks.rowCount > 0) {
      console.table(stuckLocks.rows);
      
      // 2. Mark them as failed
      console.log('\n2. Marking stuck locks as failed...');
      const result = await pool.query(`
        UPDATE sync_locks
        SET status = 'failed',
            completed_at = CURRENT_TIMESTAMP,
            error_message = 'Lock was stuck in processing state - cleaned up',
            updated_at = CURRENT_TIMESTAMP
        WHERE status = 'processing'
          AND locked_at < NOW() - INTERVAL '10 minutes'
        RETURNING id, cruise_line_id
      `);
      
      console.log(`✅ Cleaned up ${result.rowCount} stuck locks`);
      
      if (result.rowCount > 0) {
        console.table(result.rows);
      }
    }
    
    // 3. Alternative: Delete ALL processing locks (more aggressive)
    console.log('\n3. Do you want to delete ALL processing locks? (Use only if needed)');
    console.log('   Run: DELETE FROM sync_locks WHERE status = \'processing\'');
    
    // 4. Show final status
    console.log('\n4. Final sync locks status:');
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
    
    console.log('\n✅ Cleanup completed!');
    
  } catch (error) {
    console.error('❌ Failed to cleanup locks:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

cleanupStuckLocks();