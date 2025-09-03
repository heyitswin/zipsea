/**
 * Cleanup script for removing old batch sync flags
 * Run this after deploying real-time webhook processing
 */

// Try both paths for compatibility
let db, sql;

try {
  // Production path (compiled)
  const dbModule = require('../dist/db/connection');
  db = dbModule.db;
  sql = require('drizzle-orm').sql;
} catch (e) {
  // Development path
  const dbModule = require('../src/db/connection');
  db = dbModule.db;
  sql = require('drizzle-orm').sql;
}

async function cleanup() {
  console.log('🧹 Starting cleanup of batch sync flags...');

  try {
    // Clear all needs_price_update flags
    const result = await db.execute(sql`
      UPDATE cruises 
      SET needs_price_update = false,
          price_update_requested_at = NULL
      WHERE needs_price_update = true
    `);

    const rowCount = result.rowCount || result.affectedRows || (result[0]?.affectedRows) || 0;
    console.log(`✅ Cleared ${rowCount} needs_price_update flags`);

    // Clean up old webhook events (older than 30 days)
    const cleanupResult = await db.execute(sql`
      DELETE FROM webhook_events 
      WHERE created_at < NOW() - INTERVAL '30 days'
        AND status IN ('pending', 'processing')
    `);

    const cleanupCount = cleanupResult.rowCount || cleanupResult.affectedRows || (cleanupResult[0]?.affectedRows) || 0;
    console.log(`✅ Cleaned up ${cleanupCount} old webhook events`);

    // Verify cleanup
    const checkResult = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM cruises 
      WHERE needs_price_update = true
    `);

    const checkData = checkResult.rows ? checkResult.rows[0] : (checkResult[0] || {});
    const remainingCount = checkData.count || 0;
    
    if (remainingCount === 0) {
      console.log('✅ All batch sync flags successfully cleared!');
      console.log('🚀 System ready for real-time webhook processing');
    } else {
      console.warn(`⚠️ Warning: ${remainingCount} flags still remain`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

async function status() {
  console.log('📊 Checking batch sync status...');

  try {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE needs_price_update = true) as needs_update,
        COUNT(*) FILTER (WHERE price_update_requested_at IS NOT NULL) as has_request_time,
        COUNT(*) as total
      FROM cruises
      WHERE sailing_date >= CURRENT_DATE
    `);

    // Handle different result formats
    const stats = result.rows ? result.rows[0] : (result[0] || {});
    
    console.log(`
📈 Batch Sync Status:
- Total future cruises: ${stats.total || 0}
- Needs price update: ${stats.needs_update || 0} 
- Has update request time: ${stats.has_request_time || 0}
    `);

    if (stats.needs_update > 0) {
      console.log('ℹ️ Run with "cleanup" argument to clear these flags');
    } else {
      console.log('✅ No batch sync flags to clear');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking status:', error);
    process.exit(1);
  }
}

// Check command line argument
const command = process.argv[2];

if (command === 'cleanup') {
  cleanup();
} else if (command === 'status') {
  status();
} else {
  console.log('Usage: node cleanup-batch-flags.js [status|cleanup]');
  console.log('  status - Check current batch sync flags');
  console.log('  cleanup - Clear all batch sync flags');
  process.exit(1);
}