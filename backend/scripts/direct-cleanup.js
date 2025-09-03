/**
 * Direct cleanup script - simplified version
 */

const { Pool } = require('pg');

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
});

async function cleanup() {
  console.log('🧹 Starting direct cleanup of batch sync flags...');
  
  try {
    // First check how many need clearing
    const checkResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM cruises 
      WHERE needs_price_update = true
    `);
    
    const beforeCount = parseInt(checkResult.rows[0].count);
    console.log(`📊 Found ${beforeCount} cruises with needs_price_update = true`);
    
    if (beforeCount === 0) {
      console.log('✅ No flags to clear!');
      await pool.end();
      process.exit(0);
    }
    
    // Clear the flags
    console.log('🔄 Clearing flags...');
    const updateResult = await pool.query(`
      UPDATE cruises 
      SET needs_price_update = false,
          price_update_requested_at = NULL
      WHERE needs_price_update = true
      RETURNING id
    `);
    
    const clearedCount = updateResult.rowCount;
    console.log(`✅ Successfully cleared ${clearedCount} needs_price_update flags`);
    
    // Verify they're cleared
    const verifyResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM cruises 
      WHERE needs_price_update = true
    `);
    
    const afterCount = parseInt(verifyResult.rows[0].count);
    
    if (afterCount === 0) {
      console.log('✅ All batch sync flags successfully cleared!');
      console.log('🚀 System ready for real-time webhook processing');
    } else {
      console.log(`⚠️ Warning: ${afterCount} flags still remain`);
    }
    
    // Clean up old webhook events
    const cleanupResult = await pool.query(`
      DELETE FROM webhook_events 
      WHERE created_at < NOW() - INTERVAL '30 days'
        AND status IN ('pending', 'processing')
      RETURNING id
    `);
    
    if (cleanupResult.rowCount > 0) {
      console.log(`🧹 Cleaned up ${cleanupResult.rowCount} old webhook events`);
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    await pool.end();
    process.exit(1);
  }
}

async function status() {
  console.log('📊 Checking batch sync status...');
  
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE needs_price_update = true) as needs_update,
        COUNT(*) FILTER (WHERE price_update_requested_at IS NOT NULL) as has_request_time,
        COUNT(*) as total
      FROM cruises
      WHERE sailing_date >= CURRENT_DATE
    `);
    
    const stats = result.rows[0];
    console.log(`
📈 Batch Sync Status:
- Total future cruises: ${stats.total}
- Needs price update: ${stats.needs_update}
- Has update request time: ${stats.has_request_time}
    `);
    
    if (parseInt(stats.needs_update) > 0) {
      console.log('ℹ️ Run with "cleanup" argument to clear these flags');
    } else {
      console.log('✅ No batch sync flags to clear');
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking status:', error.message);
    await pool.end();
    process.exit(1);
  }
}

// Check command
const command = process.argv[2];

if (command === 'cleanup') {
  cleanup();
} else if (command === 'status') {
  status();
} else {
  console.log('Usage: node direct-cleanup.js [status|cleanup]');
  process.exit(1);
}