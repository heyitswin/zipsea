#!/usr/bin/env node

/**
 * Simulate a webhook update by marking cruises as needing price updates
 * This simulates what happens when Traveltek sends a webhook
 */

require('dotenv').config();
const { Pool } = require('pg');

async function simulateWebhookUpdate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔄 Simulating webhook update for cruise line 3 (Royal Caribbean)...\n');
    
    // Mark some cruises from line 3 as needing updates (simulate webhook behavior)
    const updateResult = await pool.query(`
      UPDATE cruises 
      SET 
        needs_price_update = true,
        price_update_requested_at = CURRENT_TIMESTAMP
      WHERE cruise_line_id = 3
        AND sailing_date >= CURRENT_DATE
        AND sailing_date <= CURRENT_DATE + INTERVAL '60 days'
      RETURNING id, cruise_id, name, sailing_date
    `);
    
    console.log(`✅ Marked ${updateResult.rowCount} cruises as needing price updates\n`);
    
    if (updateResult.rowCount > 0) {
      console.log('Sample cruises marked for update:');
      updateResult.rows.slice(0, 5).forEach(cruise => {
        console.log(`  - ${cruise.name} (${new Date(cruise.sailing_date).toLocaleDateString()})`);
      });
      
      if (updateResult.rowCount > 5) {
        console.log(`  ... and ${updateResult.rowCount - 5} more`);
      }
    }
    
    // Check the current state
    const pendingResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT cruise_line_id) as unique_lines
      FROM cruises
      WHERE needs_price_update = true
    `);
    
    console.log('\n📊 Current pending updates:');
    console.log(`  Total cruises: ${pendingResult.rows[0].total}`);
    console.log(`  Unique lines: ${pendingResult.rows[0].unique_lines}`);
    
    console.log('\n✅ Webhook simulation complete!');
    console.log('\nNext steps:');
    console.log('1. Wait for the Render cron job to run (every 5 minutes)');
    console.log('2. Or manually trigger: curl -X POST https://zipsea-production.onrender.com/api/admin/trigger-batch-sync');
    console.log('3. Check logs: https://dashboard.render.com');
    console.log('4. Monitor pending status: curl https://zipsea-production.onrender.com/api/admin/pending-syncs | jq');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

simulateWebhookUpdate();