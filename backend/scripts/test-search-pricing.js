#!/usr/bin/env node

/**
 * TEST SEARCH API & PRICING DATA
 * 
 * This script tests the cruise search API and verifies pricing data:
 * 1. API is responding correctly
 * 2. September 2025 data is searchable
 * 3. Pricing data is available
 * 4. Cruises can be found with price filters
 */

require('dotenv').config();
const postgres = require('postgres');

// Configuration
const API_BASE_URL = process.env.API_URL || 'https://zipsea-production.onrender.com';
const DATABASE_URL = process.env.DATABASE_URL;

const sql = postgres(DATABASE_URL, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function testSearchAndPricing() {
  console.log('🔍 TESTING SEARCH API & PRICING DATA');
  console.log('=====================================\n');
  
  console.log('API Base URL:', API_BASE_URL);
  console.log('');
  
  // Check Sept 2025 data
  console.log('📊 Checking September 2025 data in database...');
  const sept2025Stats = await sql`
    SELECT 
      COUNT(DISTINCT c.id) as total_cruises,
      COUNT(DISTINCT c.cruise_line_id) as cruise_lines,
      COUNT(DISTINCT c.ship_id) as ships,
      COUNT(DISTINCT cl.name) as cruise_line_names,
      COUNT(DISTINCT s.name) as ship_names,
      MIN(c.sailing_date) as earliest,
      MAX(c.sailing_date) as latest
    FROM cruises c
    LEFT JOIN cruise_lines cl ON cl.id = c.cruise_line_id
    LEFT JOIN ships s ON s.id = c.ship_id
    WHERE c.sailing_date >= '2025-09-01' AND c.sailing_date < '2025-10-01'
  `;
  
  console.log(`   Total Sept 2025 Cruises: ${sept2025Stats[0].total_cruises}`);
  console.log(`   Cruise Lines: ${sept2025Stats[0].cruise_lines} (${sept2025Stats[0].cruise_line_names} with names)`);
  console.log(`   Ships: ${sept2025Stats[0].ships} (${sept2025Stats[0].ship_names} with names)`);
  console.log(`   Date Range: ${sept2025Stats[0].earliest} to ${sept2025Stats[0].latest}`);
  console.log('');
  
  // Check pricing data
  console.log('💰 Checking pricing data...');
  const pricingStats = await sql`
    SELECT 
      COUNT(DISTINCT p.cruise_id) as cruises_with_pricing,
      COUNT(*) as total_price_records,
      MIN(p.base_price) as min_price,
      MAX(p.base_price) as max_price,
      AVG(p.base_price)::numeric(10,2) as avg_price
    FROM pricing p
    JOIN cruises c ON c.id = p.cruise_id
    WHERE c.sailing_date >= '2025-09-01' AND c.sailing_date < '2025-10-01'
      AND p.base_price IS NOT NULL
  `;
  
  console.log(`   Cruises with pricing: ${pricingStats[0].cruises_with_pricing}`);
  console.log(`   Total price records: ${pricingStats[0].total_price_records}`);
  console.log(`   Price range: $${pricingStats[0].min_price} - $${pricingStats[0].max_price}`);
  console.log(`   Average price: $${pricingStats[0].avg_price}`);
  console.log('');
  
  // Check cheapest pricing
  console.log('🏷️ Checking cheapest pricing data...');
  const cheapestStats = await sql`
    SELECT 
      COUNT(*) as cruises_with_cheapest,
      MIN(cheapest_price) as min_cheapest,
      MAX(cheapest_price) as max_cheapest,
      AVG(cheapest_price)::numeric(10,2) as avg_cheapest
    FROM cheapest_pricing cp
    JOIN cruises c ON c.id = cp.cruise_id
    WHERE c.sailing_date >= '2025-09-01' AND c.sailing_date < '2025-10-01'
      AND cp.cheapest_price IS NOT NULL
  `;
  
  console.log(`   Cruises with cheapest pricing: ${cheapestStats[0].cruises_with_cheapest}`);
  if (cheapestStats[0].cruises_with_cheapest > 0) {
    console.log(`   Cheapest range: $${cheapestStats[0].min_cheapest} - $${cheapestStats[0].max_cheapest}`);
    console.log(`   Average cheapest: $${cheapestStats[0].avg_cheapest}`);
  }
  console.log('');
  
  // Sample cruise with full data
  console.log('📋 Sample cruise with complete data:');
  const sampleCruise = await sql`
    SELECT 
      c.id,
      c.name as cruise_name,
      c.sailing_date,
      c.nights,
      cl.name as cruise_line,
      s.name as ship_name,
      COUNT(DISTINCT p.id) as price_count,
      MIN(p.base_price) as min_price,
      cp.cheapest_price
    FROM cruises c
    LEFT JOIN cruise_lines cl ON cl.id = c.cruise_line_id
    LEFT JOIN ships s ON s.id = c.ship_id
    LEFT JOIN pricing p ON p.cruise_id = c.id
    LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
    WHERE c.sailing_date >= '2025-09-01' AND c.sailing_date < '2025-10-01'
      AND cl.name IS NOT NULL
      AND s.name IS NOT NULL
    GROUP BY c.id, c.name, c.sailing_date, c.nights, cl.name, s.name, cp.cheapest_price
    HAVING COUNT(DISTINCT p.id) > 0
    LIMIT 1
  `;
  
  if (sampleCruise.length > 0) {
    const sample = sampleCruise[0];
    console.log(`   ID: ${sample.id}`);
    console.log(`   Name: ${sample.cruise_name}`);
    console.log(`   Sailing: ${sample.sailing_date}`);
    console.log(`   Nights: ${sample.nights}`);
    console.log(`   Line: ${sample.cruise_line}`);
    console.log(`   Ship: ${sample.ship_name}`);
    console.log(`   Price Records: ${sample.price_count}`);
    console.log(`   Min Price: $${sample.min_price || 'N/A'}`);
    console.log(`   Cheapest: $${sample.cheapest_price || 'N/A'}`);
  } else {
    console.log('   No cruises with complete data found yet');
  }
  console.log('');
  
  // Test API endpoints
  console.log('🧪 Testing API Endpoints:');
  console.log('');
  
  // Test 1: Health check
  console.log('1️⃣ Health Check:');
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET'
    });
    console.log(`   Status: ${response.status} ${response.statusText}`);
    if (response.ok) {
      console.log('   ✅ API is healthy');
    }
  } catch (error) {
    console.log(`   ❌ API not responding: ${error.message}`);
  }
  console.log('');
  
  // Test 2: Search endpoint
  console.log('2️⃣ Search for September 2025:');
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/search?startDate=2025-09-01&endDate=2025-09-30`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Found ${data.results?.length || 0} cruises`);
      
      if (data.results && data.results.length > 0) {
        const first = data.results[0];
        console.log(`   First result: ${first.name} on ${first.sailing_date}`);
        console.log(`   Has pricing: ${first.cheapest_price ? 'Yes ($' + first.cheapest_price + ')' : 'No'}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Search failed: ${error.message}`);
  }
  console.log('');
  
  // Test 3: Search with price filter
  console.log('3️⃣ Search with max price $2000:');
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/search?startDate=2025-09-01&endDate=2025-09-30&maxPrice=2000`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Found ${data.results?.length || 0} cruises under $2000`);
    }
  } catch (error) {
    console.log(`   ❌ Search failed: ${error.message}`);
  }
  console.log('');
  
  // Summary
  console.log('='.repeat(40));
  console.log('📊 SUMMARY:');
  console.log('='.repeat(40));
  
  const percentWithPricing = sept2025Stats[0].total_cruises > 0 
    ? ((pricingStats[0].cruises_with_pricing / sept2025Stats[0].total_cruises) * 100).toFixed(1)
    : 0;
    
  console.log(`✅ Cruises loaded: ${sept2025Stats[0].total_cruises}`);
  console.log(`✅ With pricing: ${pricingStats[0].cruises_with_pricing} (${percentWithPricing}%)`);
  console.log(`✅ Price records: ${pricingStats[0].total_price_records}`);
  
  if (pricingStats[0].cruises_with_pricing === 0) {
    console.log('\n⚠️  NO PRICING DATA FOUND!');
    console.log('   The sync may still be processing pricing data.');
    console.log('   Check if pricing table exists and has data.');
  }
  
  console.log('\n💡 Quick Checks:');
  console.log(`   - API Health: ${API_BASE_URL}/health`);
  console.log(`   - Search Sept: ${API_BASE_URL}/api/v1/search?startDate=2025-09-01&endDate=2025-09-30`);
  console.log(`   - With Price: ${API_BASE_URL}/api/v1/search?startDate=2025-09-01&endDate=2025-09-30&maxPrice=2000`);
  
  await sql.end();
}

// Run the test
testSearchAndPricing().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});