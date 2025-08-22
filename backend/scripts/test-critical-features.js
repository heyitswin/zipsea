#!/usr/bin/env node

/**
 * CRITICAL FEATURES TEST
 * 
 * Tests the most important functionality:
 * 1. Pricing data availability
 * 2. Direct cruise search (by ship/date, ID, voyage code)
 * 3. Data integrity
 */

require('dotenv').config();
const postgres = require('postgres');

const API_BASE_URL = process.env.API_URL || 'https://zipsea-production.onrender.com';
const DATABASE_URL = process.env.DATABASE_URL;

const sql = postgres(DATABASE_URL, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function testCriticalFeatures() {
  console.log('🔍 TESTING CRITICAL FEATURES');
  console.log('=====================================\n');
  
  // 1. PRICING DATA CHECK
  console.log('💰 1. PRICING DATA STATUS');
  console.log('-------------------------\n');
  
  // Check detailed pricing
  const pricingCheck = await sql`
    SELECT 
      COUNT(DISTINCT cruise_id) as cruises_with_pricing,
      COUNT(*) as total_price_records,
      MIN(base_price) as min_price,
      MAX(base_price) as max_price,
      AVG(base_price)::numeric(10,2) as avg_price
    FROM pricing
    WHERE base_price IS NOT NULL
  `;
  
  console.log('Detailed Pricing (pricing table):');
  console.log(`  - Cruises with pricing: ${pricingCheck[0].cruises_with_pricing}`);
  console.log(`  - Total price records: ${pricingCheck[0].total_price_records}`);
  if (pricingCheck[0].total_price_records > 0) {
    console.log(`  - Price range: $${pricingCheck[0].min_price} - $${pricingCheck[0].max_price}`);
  }
  
  // Check cheapest pricing
  const cheapestCheck = await sql`
    SELECT 
      COUNT(*) as cruises_with_cheapest,
      COUNT(DISTINCT cruise_id) as unique_cruises,
      MIN(cheapest_price) as min_price,
      MAX(cheapest_price) as max_price,
      AVG(cheapest_price)::numeric(10,2) as avg_price,
      SUM(CASE WHEN interior_price IS NOT NULL THEN 1 ELSE 0 END) as with_interior,
      SUM(CASE WHEN oceanview_price IS NOT NULL THEN 1 ELSE 0 END) as with_oceanview,
      SUM(CASE WHEN balcony_price IS NOT NULL THEN 1 ELSE 0 END) as with_balcony,
      SUM(CASE WHEN suite_price IS NOT NULL THEN 1 ELSE 0 END) as with_suite
    FROM cheapest_pricing
    WHERE cheapest_price IS NOT NULL
  `;
  
  console.log('\nCheapest Pricing (cheapest_pricing table):');
  console.log(`  - Cruises with pricing: ${cheapestCheck[0].cruises_with_cheapest}`);
  if (cheapestCheck[0].cruises_with_cheapest > 0) {
    console.log(`  - Price range: $${cheapestCheck[0].min_price} - $${cheapestCheck[0].max_price}`);
    console.log(`  - Average: $${cheapestCheck[0].avg_price}`);
    console.log(`  - With interior pricing: ${cheapestCheck[0].with_interior}`);
    console.log(`  - With oceanview pricing: ${cheapestCheck[0].with_oceanview}`);
    console.log(`  - With balcony pricing: ${cheapestCheck[0].with_balcony}`);
    console.log(`  - With suite pricing: ${cheapestCheck[0].with_suite}`);
  }
  
  const pricingStatus = cheapestCheck[0].cruises_with_cheapest > 0 ? '✅ WORKING' : '❌ NO PRICING DATA';
  console.log(`\n  Status: ${pricingStatus}`);
  
  // 2. DIRECT CRUISE SEARCH
  console.log('\n🎯 2. DIRECT CRUISE SEARCH');
  console.log('-------------------------\n');
  
  // Get a sample cruise to test with
  const sampleCruise = await sql`
    SELECT 
      c.id,
      c.cruise_id,
      c.name,
      c.voyage_code,
      c.sailing_date,
      s.name as ship_name,
      cl.name as cruise_line
    FROM cruises c
    JOIN ships s ON s.id = c.ship_id
    JOIN cruise_lines cl ON cl.id = c.cruise_line_id
    WHERE c.sailing_date >= '2025-09-01' 
      AND c.sailing_date < '2025-10-01'
    LIMIT 1
  `;
  
  if (sampleCruise.length > 0) {
    const cruise = sampleCruise[0];
    console.log('Test cruise:');
    console.log(`  - ID: ${cruise.id}`);
    console.log(`  - Name: ${cruise.name}`);
    console.log(`  - Ship: ${cruise.ship_name}`);
    console.log(`  - Date: ${cruise.sailing_date}`);
    console.log(`  - Voyage: ${cruise.voyage_code || 'N/A'}`);
    
    // Test search by ship and date
    console.log('\n  a) Search by ship and date:');
    try {
      const shipName = encodeURIComponent(cruise.ship_name);
      const date = cruise.sailing_date.toISOString().split('T')[0];
      const response = await fetch(`${API_BASE_URL}/api/v1/search/by-ship?shipName=${shipName}&departureDate=${date}`);
      console.log(`     Status: ${response.status} ${response.statusText}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`     Found: ${data.cruises?.length || 0} cruises`);
        const found = data.cruises?.find(c => c.id === cruise.id);
        console.log(`     Test cruise found: ${found ? '✅ YES' : '❌ NO'}`);
      }
    } catch (error) {
      console.log(`     ❌ Error: ${error.message}`);
    }
    
    // Test get by ID
    console.log('\n  b) Get cruise by ID:');
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/cruises/${cruise.id}`);
      console.log(`     Status: ${response.status} ${response.statusText}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`     Found: ${data.id === cruise.id ? '✅ YES' : '❌ NO'}`);
        console.log(`     Has pricing: ${data.cheapest_price ? '✅ YES ($' + data.cheapest_price + ')' : '❌ NO'}`);
      }
    } catch (error) {
      console.log(`     ❌ Error: ${error.message}`);
    }
  }
  
  // 3. DATA INTEGRITY
  console.log('\n🔍 3. DATA INTEGRITY CHECK');
  console.log('-------------------------\n');
  
  // Check for orphaned records
  const integrityCheck = await sql`
    WITH integrity AS (
      SELECT 
        'Cruises without valid line' as issue,
        COUNT(*) as count
      FROM cruises c
      LEFT JOIN cruise_lines cl ON cl.id = c.cruise_line_id
      WHERE cl.id IS NULL
      
      UNION ALL
      
      SELECT 
        'Cruises without valid ship' as issue,
        COUNT(*) as count
      FROM cruises c
      LEFT JOIN ships s ON s.id = c.ship_id
      WHERE s.id IS NULL
      
      UNION ALL
      
      SELECT 
        'Itineraries without valid cruise' as issue,
        COUNT(*) as count
      FROM itineraries i
      LEFT JOIN cruises c ON c.id = i.cruise_id
      WHERE c.id IS NULL
      
      UNION ALL
      
      SELECT 
        'Pricing without valid cruise' as issue,
        COUNT(*) as count
      FROM pricing p
      LEFT JOIN cruises c ON c.id = p.cruise_id
      WHERE c.id IS NULL
      
      UNION ALL
      
      SELECT 
        'Cheapest pricing without valid cruise' as issue,
        COUNT(*) as count
      FROM cheapest_pricing cp
      LEFT JOIN cruises c ON c.id = cp.cruise_id
      WHERE c.id IS NULL
    )
    SELECT * FROM integrity WHERE count > 0
  `;
  
  if (integrityCheck.length === 0) {
    console.log('  ✅ No data integrity issues found!');
  } else {
    console.log('  ⚠️ Data integrity issues:');
    for (const issue of integrityCheck) {
      console.log(`    - ${issue.issue}: ${issue.count} records`);
    }
  }
  
  // Check for missing critical data
  const missingData = await sql`
    SELECT 
      COUNT(*) FILTER (WHERE name IS NULL OR name = '') as missing_name,
      COUNT(*) FILTER (WHERE cruise_line_id IS NULL) as missing_line,
      COUNT(*) FILTER (WHERE ship_id IS NULL) as missing_ship,
      COUNT(*) FILTER (WHERE sailing_date IS NULL) as missing_date,
      COUNT(*) FILTER (WHERE nights IS NULL OR nights = 0) as missing_nights,
      COUNT(*) as total_cruises
    FROM cruises
    WHERE sailing_date >= '2025-09-01' AND sailing_date < '2025-10-01'
  `;
  
  console.log('\n  Missing critical data (Sept 2025):');
  console.log(`    - Missing names: ${missingData[0].missing_name}`);
  console.log(`    - Missing cruise line: ${missingData[0].missing_line}`);
  console.log(`    - Missing ship: ${missingData[0].missing_ship}`);
  console.log(`    - Missing sailing date: ${missingData[0].missing_date}`);
  console.log(`    - Missing nights: ${missingData[0].missing_nights}`);
  console.log(`    - Total cruises: ${missingData[0].total_cruises}`);
  
  // 4. SUMMARY
  console.log('\n========================================');
  console.log('📊 SUMMARY');
  console.log('========================================\n');
  
  const hasPricing = cheapestCheck[0].cruises_with_cheapest > 0;
  const hasDetailedPricing = pricingCheck[0].total_price_records > 0;
  const hasIntegrityIssues = integrityCheck.length > 0;
  
  console.log('Critical Features Status:');
  console.log(`  1. Pricing Data: ${hasPricing ? '✅ Available' : '❌ Missing'}`);
  console.log(`     - Cheapest pricing: ${cheapestCheck[0].cruises_with_cheapest} cruises`);
  console.log(`     - Detailed pricing: ${pricingCheck[0].total_price_records} records`);
  console.log(`  2. Direct Search: Test via API endpoints above`);
  console.log(`  3. Data Integrity: ${!hasIntegrityIssues ? '✅ Good' : '⚠️ Issues found'}`);
  
  console.log('\n📝 Recommendations:');
  if (!hasDetailedPricing) {
    console.log('  - Detailed pricing is missing - need to debug why prices object is empty');
  }
  if (hasPricing && cheapestCheck[0].cruises_with_cheapest < 100) {
    console.log('  - Very few cruises have pricing - may need to sync more data');
  }
  if (hasIntegrityIssues) {
    console.log('  - Fix data integrity issues to ensure reliable search results');
  }
  
  await sql.end();
}

// Run the test
testCriticalFeatures().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});