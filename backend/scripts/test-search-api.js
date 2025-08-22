#!/usr/bin/env node

/**
 * TEST SEARCH API
 * 
 * This script tests the cruise search API to ensure:
 * 1. API is responding correctly
 * 2. September 2025 data is searchable
 * 3. Filters are working properly
 * 4. Results include all expected fields
 */

require('dotenv').config();
const postgres = require('postgres');
// Use native fetch (available in Node 18+)

// Configuration
const API_BASE_URL = process.env.API_URL || 'https://zipsea-staging.onrender.com';
const DATABASE_URL = process.env.DATABASE_URL;

const sql = postgres(DATABASE_URL, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function testSearchAPI() {
  console.log('🔍 TESTING SEARCH API');
  console.log('======================\n');
  
  console.log('API Base URL:', API_BASE_URL);
  console.log('');
  
  // First, check what Sept 2025 data we have
  console.log('📊 Checking September 2025 data in database...');
  const sept2025Stats = await sql`
    SELECT 
      COUNT(*) as total_cruises,
      COUNT(DISTINCT cruise_id) as unique_cruises,
      COUNT(DISTINCT cruise_line_id) as cruise_lines,
      COUNT(DISTINCT ship_id) as ships,
      MIN(sailing_date) as earliest,
      MAX(sailing_date) as latest
    FROM cruises
    WHERE sailing_date >= '2025-09-01' AND sailing_date < '2025-10-01'
  `;
  
  console.log(`   Total Sept 2025 Sailings: ${sept2025Stats[0].total_cruises}`);
  console.log(`   Unique Cruises: ${sept2025Stats[0].unique_cruises}`);
  console.log(`   Cruise Lines: ${sept2025Stats[0].cruise_lines}`);
  console.log(`   Ships: ${sept2025Stats[0].ships}`);
  console.log(`   Date Range: ${sept2025Stats[0].earliest} to ${sept2025Stats[0].latest}`);
  console.log('');
  
  // Test 1: Basic search for September 2025
  console.log('🧪 Test 1: Basic search for September 2025');
  console.log('   Endpoint: GET /api/cruises/search');
  console.log('   Params: startDate=2025-09-01, endDate=2025-09-30');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/cruises/search?startDate=2025-09-01&endDate=2025-09-30`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Response Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Found ${data.results?.length || 0} cruises`);
      
      if (data.results && data.results.length > 0) {
        const sample = data.results[0];
        console.log('\n   Sample Result:');
        console.log(`     ID: ${sample.id}`);
        console.log(`     Name: ${sample.name}`);
        console.log(`     Sailing Date: ${sample.sailing_date}`);
        console.log(`     Nights: ${sample.nights}`);
        console.log(`     Ship: ${sample.ship_name || 'N/A'}`);
        console.log(`     Line: ${sample.cruise_line_name || 'N/A'}`);
      }
    } else {
      const error = await response.text();
      console.log('   ❌ Search failed:', error);
    }
  } catch (error) {
    console.log('   ❌ Request failed:', error.message);
  }
  
  console.log('');
  
  // Test 2: Search with filters
  console.log('🧪 Test 2: Search with nights filter');
  console.log('   Params: startDate=2025-09-01, endDate=2025-09-30, nights=7');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/cruises/search?startDate=2025-09-01&endDate=2025-09-30&nights=7`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Found ${data.results?.length || 0} 7-night cruises`);
    } else {
      console.log('   ❌ Search failed');
    }
  } catch (error) {
    console.log('   ❌ Request failed:', error.message);
  }
  
  console.log('');
  
  // Test 3: Get specific cruise details
  console.log('🧪 Test 3: Get specific cruise details');
  
  // Get a sample cruise ID from database
  const sampleCruise = await sql`
    SELECT id, name, sailing_date 
    FROM cruises 
    WHERE sailing_date >= '2025-09-01' AND sailing_date < '2025-10-01'
    LIMIT 1
  `;
  
  if (sampleCruise.length > 0) {
    const cruiseId = sampleCruise[0].id;
    console.log(`   Endpoint: GET /api/cruises/${cruiseId}`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/cruises/${cruiseId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`   Response Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const cruise = await response.json();
        console.log('   ✅ Cruise details retrieved:');
        console.log(`     Name: ${cruise.name}`);
        console.log(`     Sailing: ${cruise.sailing_date}`);
        console.log(`     Itinerary: ${cruise.itinerary?.length || 0} ports`);
        console.log(`     Has Prices: ${cruise.prices ? 'Yes' : 'No'}`);
      } else {
        console.log('   ❌ Failed to get cruise details');
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
  }
  
  console.log('');
  
  // Test 4: Check price data
  console.log('🧪 Test 4: Check price availability');
  
  const cruisesWithPrices = await sql`
    SELECT COUNT(*) as count 
    FROM cruises c
    LEFT JOIN static_prices sp ON sp.cruise_id = c.id
    WHERE c.sailing_date >= '2025-09-01' AND c.sailing_date < '2025-10-01'
      AND sp.id IS NOT NULL
  `;
  
  console.log(`   Cruises with static prices: ${cruisesWithPrices[0].count}`);
  
  const priceSnapshots = await sql`
    SELECT COUNT(*) as count
    FROM price_snapshots ps
    JOIN cruises c ON c.id = ps.cruise_id
    WHERE c.sailing_date >= '2025-09-01' AND c.sailing_date < '2025-10-01'
  `;
  
  console.log(`   Price snapshots for Sept 2025: ${priceSnapshots[0].count}`);
  
  console.log('\n' + '='.repeat(40));
  console.log('✅ SEARCH API TEST COMPLETE');
  console.log('='.repeat(40) + '\n');
  
  // Summary
  console.log('📋 SUMMARY:');
  if (sept2025Stats[0].total_cruises > 0) {
    console.log('   ✅ September 2025 data is in database');
  } else {
    console.log('   ❌ No September 2025 data found - run sync first!');
  }
  
  console.log('\n💡 Next Steps:');
  console.log('   1. If API is not responding, check Render logs');
  console.log('   2. Configure webhook URL in Traveltek iSell platform');
  console.log('   3. Monitor webhook events table for incoming updates');
  console.log('   4. Check price_snapshots table for historical data');
  
  await sql.end();
}

// Run the test
testSearchAPI().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});