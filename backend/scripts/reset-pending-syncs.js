#!/usr/bin/env node

/**
 * Reset cruises to pending sync status for lines that got webhooks
 */

require('dotenv').config();

async function resetPendingCruises() {
  const { db } = require('../dist/db/connection');
  const { sql } = require('drizzle-orm');
  
  console.log('Resetting cruises to pending sync status...\n');
  
  try {
    // Get cruise lines that received webhooks today
    const linesResult = await db.execute(sql`
      SELECT DISTINCT cruise_line_id
      FROM cruises
      WHERE price_update_requested_at > NOW() - INTERVAL '4 hours'
    `);
    
    if (linesResult.rows.length === 0) {
      console.log('No recent webhook activity found');
      return;
    }
    
    const lineIds = linesResult.rows.map(r => r.cruise_line_id);
    console.log(`Found ${lineIds.length} cruise lines with recent webhooks:`, lineIds);
    
    // Reset these cruises to pending
    const updateResult = await db.execute(sql`
      UPDATE cruises
      SET needs_price_update = true
      WHERE cruise_line_id = ANY(${lineIds})
      RETURNING cruise_id
    `);
    
    console.log(`\n✅ Reset ${updateResult.rows.length} cruises to pending sync status`);
    
    // Show summary
    const summaryResult = await db.execute(sql`
      SELECT 
        cruise_line_id,
        COUNT(*) as count
      FROM cruises
      WHERE needs_price_update = true
      GROUP BY cruise_line_id
      ORDER BY count DESC
    `);
    
    console.log('\nPending syncs by cruise line:');
    summaryResult.rows.forEach(row => {
      console.log(`  Line ${row.cruise_line_id}: ${row.count} cruises`);
    });
    
    const totalResult = await db.execute(sql`
      SELECT COUNT(*) as total FROM cruises WHERE needs_price_update = true
    `);
    
    console.log(`\nTotal pending: ${totalResult.rows[0].total} cruises`);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

resetPendingCruises();