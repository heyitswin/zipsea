#!/usr/bin/env node

/**
 * Monitor Line 3 webhook processing progress
 * Run this on Render to check actual database updates
 */

const { Pool } = require('pg');

// Use production database URL from environment
const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION;

if (!DATABASE_URL) {
  console.error('❌ No DATABASE_URL found. This script must be run on Render or with production DATABASE_URL set.');
  process.exit(1);
}

async function monitorLine3() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('\n=== LINE 3 WEBHOOK PROCESSING MONITOR ===');
    console.log(`Time: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET\n`);

    // Get total cruises for Line 3 (database ID 22)
    const totalQuery = `
      SELECT 
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN departure_date >= CURRENT_DATE THEN 1 END) as active_cruises
      FROM cruises 
      WHERE line_id = 22
    `;
    
    const totalResult = await pool.query(totalQuery);
    const { total_cruises, active_cruises } = totalResult.rows[0];
    
    console.log(`📊 LINE 3 CRUISE INVENTORY:`);
    console.log(`  Total Cruises: ${total_cruises}`);
    console.log(`  Active Cruises: ${active_cruises}\n`);

    // Check recent updates
    const updateQuery = `
      SELECT 
        COUNT(CASE WHEN pricing_updated_at > NOW() - INTERVAL '1 minute' THEN 1 END) as last_1_min,
        COUNT(CASE WHEN pricing_updated_at > NOW() - INTERVAL '5 minutes' THEN 1 END) as last_5_min,
        COUNT(CASE WHEN pricing_updated_at > NOW() - INTERVAL '10 minutes' THEN 1 END) as last_10_min,
        COUNT(CASE WHEN pricing_updated_at > NOW() - INTERVAL '30 minutes' THEN 1 END) as last_30_min,
        MIN(CASE WHEN pricing_updated_at > NOW() - INTERVAL '30 minutes' THEN pricing_updated_at END) as first_update,
        MAX(pricing_updated_at) as last_update
      FROM cruises 
      WHERE line_id = 22
    `;
    
    const updateResult = await pool.query(updateQuery);
    const updates = updateResult.rows[0];
    
    console.log(`🔄 RECENT UPDATE ACTIVITY:`);
    console.log(`  Last 1 minute:  ${updates.last_1_min} cruises`);
    console.log(`  Last 5 minutes: ${updates.last_5_min} cruises`);
    console.log(`  Last 10 minutes: ${updates.last_10_min} cruises`);
    console.log(`  Last 30 minutes: ${updates.last_30_min} cruises\n`);
    
    if (updates.first_update) {
      const startTime = new Date(updates.first_update);
      const lastTime = new Date(updates.last_update);
      const elapsedMinutes = Math.round((lastTime - startTime) / 60000);
      
      console.log(`⏱️  PROCESSING TIMELINE:`);
      console.log(`  Started: ${startTime.toLocaleTimeString('en-US', { timeZone: 'America/New_York' })} ET`);
      console.log(`  Latest:  ${lastTime.toLocaleTimeString('en-US', { timeZone: 'America/New_York' })} ET`);
      console.log(`  Elapsed: ${elapsedMinutes} minutes\n`);
    }

    // Calculate success rate
    if (updates.last_30_min > 0) {
      const successRate = Math.round((updates.last_30_min / active_cruises) * 100);
      console.log(`📈 PROCESSING STATUS:`);
      console.log(`  Cruises Processed: ${updates.last_30_min} / ${active_cruises}`);
      console.log(`  Success Rate: ${successRate}%`);
      console.log(`  Remaining: ${active_cruises - updates.last_30_min} cruises\n`);
      
      if (updates.last_1_min > 0) {
        console.log(`✅ ACTIVE - Processing ${updates.last_1_min} cruises/minute`);
        const remainingMinutes = Math.ceil((active_cruises - updates.last_30_min) / updates.last_1_min);
        console.log(`  Estimated completion: ${remainingMinutes} minutes`);
      } else if (updates.last_5_min > 0) {
        console.log(`⚠️  SLOWING - Only ${updates.last_5_min} updates in last 5 minutes`);
      } else {
        console.log(`❌ STALLED - No updates in last 5 minutes`);
      }
    } else {
      console.log(`⚠️  NO RECENT ACTIVITY - No updates in last 30 minutes`);
    }

    // Check for FTP errors in logs (if we have a logs table)
    const errorQuery = `
      SELECT 
        COUNT(*) as error_count,
        error_type,
        MAX(created_at) as last_error
      FROM webhook_error_logs
      WHERE line_id = 22 
        AND created_at > NOW() - INTERVAL '30 minutes'
      GROUP BY error_type
      LIMIT 5
    `;
    
    try {
      const errorResult = await pool.query(errorQuery);
      if (errorResult.rows.length > 0) {
        console.log(`\n⚠️  RECENT ERRORS:`);
        errorResult.rows.forEach(row => {
          console.log(`  ${row.error_type}: ${row.error_count} occurrences`);
        });
      }
    } catch (e) {
      // Error logs table might not exist
    }

  } catch (error) {
    console.error('❌ Error monitoring Line 3:', error.message);
  } finally {
    await pool.end();
  }
}

// Run monitoring
monitorLine3().catch(console.error);