#!/usr/bin/env node

/**
 * Verify if webhook actually updated cruise data
 * This script checks specific cruises and their actual pricing_updated_at timestamps
 */

const { Pool } = require('pg');

// This script must be run on Render with production DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION;

if (!DATABASE_URL) {
  console.error('❌ No DATABASE_URL found. Run this on Render.');
  process.exit(1);
}

async function verifyUpdates() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('\n=== WEBHOOK UPDATE VERIFICATION ===');
    console.log(`Current Time: ${new Date().toISOString()}\n`);

    // Check Royal Caribbean (Line ID 22) updates with actual timestamps
    const query = `
      SELECT 
        c.id,
        c.name as cruise_name,
        c.cruise_id as code_to_cruise_id,
        s.name as ship_name,
        c.sailing_date as departure_date,
        c.updated_at as pricing_updated_at,
        c.interior_price as price_inside,
        c.oceanview_price as price_oceanview,
        c.balcony_price as price_balcony,
        c.suite_price as price_suite,
        CASE 
          WHEN c.updated_at > NOW() - INTERVAL '1 hour' THEN 'UPDATED TODAY'
          WHEN c.updated_at > NOW() - INTERVAL '24 hours' THEN 'Updated yesterday'
          ELSE 'OLD DATA'
        END as update_status,
        EXTRACT(EPOCH FROM (NOW() - c.updated_at))/60 as minutes_since_update
      FROM cruises c
      LEFT JOIN ships s ON c.ship_id = s.id
      WHERE c.cruise_line_id = 22  -- Royal Caribbean
      ORDER BY c.updated_at DESC
      LIMIT 20
    `;

    const result = await pool.query(query);
    
    console.log('📊 ROYAL CARIBBEAN CRUISE UPDATE STATUS:');
    console.log('=' .repeat(100));
    
    let updatedToday = 0;
    let hasOldData = 0;
    
    result.rows.forEach((cruise, idx) => {
      const updateTime = cruise.pricing_updated_at ? new Date(cruise.pricing_updated_at).toISOString() : 'Never';
      const minsSince = Math.round(cruise.minutes_since_update || 999999);
      
      console.log(`\n${idx + 1}. Cruise ID: ${cruise.id} | Code: ${cruise.code_to_cruise_id}`);
      console.log(`   Ship: ${cruise.ship_name}`);
      console.log(`   Name: ${cruise.cruise_name?.substring(0, 60)}...`);
      console.log(`   Departure: ${new Date(cruise.departure_date).toLocaleDateString()}`);
      console.log(`   Last Updated: ${updateTime}`);
      console.log(`   Minutes Since Update: ${minsSince}`);
      console.log(`   Status: ${cruise.update_status}`);
      console.log(`   Prices: Inside=$${cruise.price_inside || 'N/A'}, Ocean=$${cruise.price_oceanview || 'N/A'}, Balcony=$${cruise.price_balcony || 'N/A'}, Suite=$${cruise.price_suite || 'N/A'}`);
      
      if (cruise.update_status === 'UPDATED TODAY') updatedToday++;
      if (cruise.update_status === 'OLD DATA') hasOldData++;
    });
    
    // Get aggregate stats
    const statsQuery = `
      SELECT 
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '1 hour' THEN 1 END) as updated_last_hour,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '30 minutes' THEN 1 END) as updated_last_30min,
        COUNT(CASE WHEN updated_at IS NULL OR updated_at < NOW() - INTERVAL '24 hours' THEN 1 END) as old_data,
        MAX(updated_at) as most_recent,
        MIN(updated_at) as oldest
      FROM cruises
      WHERE cruise_line_id = 22
    `;
    
    const stats = await pool.query(statsQuery);
    const s = stats.rows[0];
    
    console.log('\n' + '=' .repeat(100));
    console.log('📈 AGGREGATE STATISTICS FOR ROYAL CARIBBEAN:');
    console.log(`Total Cruises: ${s.total_cruises}`);
    console.log(`Updated in Last 30 min: ${s.updated_last_30min} (${Math.round(s.updated_last_30min/s.total_cruises*100)}%)`);
    console.log(`Updated in Last Hour: ${s.updated_last_hour} (${Math.round(s.updated_last_hour/s.total_cruises*100)}%)`);
    console.log(`Old/Never Updated: ${s.old_data} cruises`);
    console.log(`Most Recent Update: ${s.most_recent ? new Date(s.most_recent).toISOString() : 'Never'}`);
    console.log(`Oldest Update: ${s.oldest ? new Date(s.oldest).toISOString() : 'Never'}`);
    
    // Get sample cruise for FTP verification
    console.log('\n' + '=' .repeat(100));
    console.log('🔍 SAMPLE CRUISE FOR FTP VERIFICATION:');
    
    const sampleQuery = `
      SELECT 
        c.id,
        c.code_to_cruise_id,
        c.cruise_name,
        cl.name as line_name,
        cl.id as line_id,
        c.ship_name,
        s.code as ship_code
      FROM cruises c
      JOIN cruise_lines cl ON c.line_id = cl.id
      LEFT JOIN ships s ON c.ship_id = s.id
      WHERE c.line_id = 22
      AND c.code_to_cruise_id IS NOT NULL
      LIMIT 1
    `;
    
    const sample = await pool.query(sampleQuery);
    if (sample.rows[0]) {
      const cruise = sample.rows[0];
      console.log(`\nCruise ID: ${cruise.id}`);
      console.log(`Code to Cruise ID: ${cruise.code_to_cruise_id}`);
      console.log(`Line: ${cruise.line_name} (ID: ${cruise.line_id})`);
      console.log(`Ship: ${cruise.ship_name} (Code: ${cruise.ship_code || 'unknown'})`);
      console.log(`\nFTP Path would be something like:`);
      console.log(`/22/[SHIP_NAME]/${cruise.code_to_cruise_id}.json`);
      console.log(`\nYou can check this file on the FTP server to verify the data matches.`);
    }
    
    // Final verdict
    console.log('\n' + '=' .repeat(100));
    if (s.updated_last_hour > s.total_cruises * 0.8) {
      console.log('✅ VERIFICATION RESULT: Updates appear SUCCESSFUL!');
      console.log(`   ${s.updated_last_hour} out of ${s.total_cruises} cruises were updated in the last hour.`);
    } else if (s.updated_last_hour > 100) {
      console.log('⚠️  VERIFICATION RESULT: PARTIAL updates detected');
      console.log(`   Only ${s.updated_last_hour} out of ${s.total_cruises} cruises were updated.`);
    } else {
      console.log('❌ VERIFICATION RESULT: Updates likely FAILED!');
      console.log(`   Only ${s.updated_last_hour} cruises show recent updates.`);
      console.log('   The Slack message might be incorrect or there was a database save issue.');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

verifyUpdates().catch(console.error);