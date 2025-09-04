#!/usr/bin/env node

/**
 * Get sample cruise data for manual FTP verification
 */

const { Pool } = require('pg');

// Use the staging/production database URL
const DATABASE_URL = 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';

async function getSampleCruise() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n=== SAMPLE ROYAL CARIBBEAN CRUISE FOR VERIFICATION ===\n');

    // Get a specific Royal Caribbean cruise with all details
    const query = `
      SELECT 
        c.id,
        c.cruise_id as code_to_cruise_id,
        c.name as cruise_name,
        cl.name as line_name,
        cl.id as database_line_id,
        s.name as ship_name,
        s.id as ship_id,
        c.sailing_date,
        c.nights,
        c.interior_price,
        c.oceanview_price, 
        c.balcony_price,
        c.suite_price,
        c.updated_at,
        EXTRACT(EPOCH FROM (NOW() - c.updated_at))/60 as minutes_since_update
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      LEFT JOIN ships s ON c.ship_id = s.id
      WHERE cl.id = 22  -- Royal Caribbean
        AND c.cruise_id IS NOT NULL
        AND c.cruise_id != ''
        AND c.sailing_date > CURRENT_DATE
      ORDER BY c.sailing_date
      LIMIT 5
    `;

    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      console.log('No Royal Caribbean cruises found!');
      return;
    }

    console.log('Here are 5 sample Royal Caribbean cruises you can check:\n');
    
    result.rows.forEach((cruise, idx) => {
      console.log(`${'='.repeat(80)}`);
      console.log(`CRUISE ${idx + 1}:`);
      console.log(`${'='.repeat(80)}`);
      console.log(`Database ID: ${cruise.id}`);
      console.log(`Code to Cruise ID: ${cruise.code_to_cruise_id}`);
      console.log(`Cruise Name: ${cruise.cruise_name}`);
      console.log(`Ship: ${cruise.ship_name} (ID: ${cruise.ship_id})`);
      console.log(`Sailing Date: ${new Date(cruise.sailing_date).toLocaleDateString()}`);
      console.log(`Duration: ${cruise.nights} nights`);
      console.log(`\nCurrent Prices in Database:`);
      console.log(`  Inside: $${cruise.interior_price || 'N/A'}`);
      console.log(`  Oceanview: $${cruise.oceanview_price || 'N/A'}`);
      console.log(`  Balcony: $${cruise.balcony_price || 'N/A'}`);
      console.log(`  Suite: $${cruise.suite_price || 'N/A'}`);
      console.log(`\nLast Updated: ${cruise.updated_at ? new Date(cruise.updated_at).toISOString() : 'Never'}`);
      console.log(`Minutes Since Update: ${Math.round(cruise.minutes_since_update || 999999)}`);
      console.log(`\n📁 FTP JSON FILE PATH TO CHECK:`);
      console.log(`/2025/09/22/${cruise.ship_name.replace(/ /g, '_')}/${cruise.code_to_cruise_id}.json`);
      console.log(`\nOR try:`);
      console.log(`/22/${cruise.ship_name.replace(/ /g, '_')}/${cruise.code_to_cruise_id}.json`);
      console.log();
    });

    console.log(`${'='.repeat(80)}`);
    console.log('\n📋 WHAT TO CHECK:');
    console.log('1. Connect to Traveltek FTP server');
    console.log('2. Navigate to one of the paths above');
    console.log('3. Download the JSON file');
    console.log('4. Check if the prices in the JSON match the database prices above');
    console.log('5. Check the "lastupdated" field in the JSON');
    console.log('\nIf the database prices match the FTP JSON, the webhook worked!');
    console.log('If they don\'t match, the webhook processing failed.\n');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

getSampleCruise().catch(console.error);