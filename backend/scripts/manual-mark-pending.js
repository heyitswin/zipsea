#!/usr/bin/env node

/**
 * Manually mark cruises as needing updates to test batch sync
 * This bypasses the webhook and directly updates the database
 */

require('dotenv').config();
const { Pool } = require('pg');

async function manualMarkPending() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔄 Manually marking cruises as needing price updates...\n');
    
    // First, check what cruises we have
    const checkResult = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(DISTINCT cruise_line_id) as lines,
             MIN(cruise_line_id) as min_line,
             MAX(cruise_line_id) as max_line
      FROM cruises
      WHERE sailing_date >= CURRENT_DATE
    `);
    
    console.log('Current database state:');
    console.log(`  Total active cruises: ${checkResult.rows[0].total}`);
    console.log(`  Cruise lines: ${checkResult.rows[0].lines}`);
    console.log(`  Line ID range: ${checkResult.rows[0].min_line} to ${checkResult.rows[0].max_line}`);
    console.log('');
    
    // Mark some cruises as needing updates (limit to 50 for testing)
    const updateResult = await pool.query(`
      UPDATE cruises
      SET needs_price_update = true,
          price_update_requested_at = CURRENT_TIMESTAMP
      WHERE id IN (
        SELECT id FROM cruises
        WHERE sailing_date >= CURRENT_DATE
          AND sailing_date <= CURRENT_DATE + INTERVAL '90 days'
        ORDER BY sailing_date
        LIMIT 50
      )
      RETURNING id, cruise_id, name, sailing_date
    `);
    
    console.log(`✅ Marked ${updateResult.rowCount} cruises as needing updates\n`);
    
    if (updateResult.rowCount > 0) {
      console.log('Sample cruises marked:');
      updateResult.rows.slice(0, 5).forEach(cruise => {
        console.log(`  - ${cruise.name} (${new Date(cruise.sailing_date).toLocaleDateString()})`);
      });
      
      if (updateResult.rowCount > 5) {
        console.log(`  ... and ${updateResult.rowCount - 5} more`);
      }
    }
    
    // Check final pending count
    const pendingResult = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(DISTINCT cruise_line_id) as lines
      FROM cruises
      WHERE needs_price_update = true
    `);
    
    console.log('\n📊 Final status:');
    console.log(`  Total pending: ${pendingResult.rows[0].total} cruises`);
    console.log(`  Cruise lines: ${pendingResult.rows[0].lines}`);
    
    console.log('\n✅ Done! Now you can:');
    console.log('1. Check pending: curl https://zipsea-production.onrender.com/api/admin/pending-syncs | jq');
    console.log('2. Trigger sync: curl -X POST https://zipsea-production.onrender.com/api/admin/trigger-batch-sync | jq');
    console.log('3. Or wait for the cron job to run (every 5 minutes)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

manualMarkPending();