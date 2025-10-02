/**
 * Test script to diagnose month filter issue
 * Testing: cruiseLines=16&months=2026-11 returns no results
 * But: cruiseLines=16&nightRange=6-8 shows 2026+ cruises
 */

const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'https://zipsea-production.onrender.com';

async function testFilters() {
  console.log('=== TESTING MONTH FILTER ISSUE ===\n');

  // Test 1: MSC + Nov 2026 (FAILING)
  console.log('TEST 1: MSC (line 16) + November 2026');
  console.log('Expected: Should show MSC cruises in Nov 2026');
  const test1Url = `${API_URL}/api/v1/search/comprehensive?cruiseLineId=16&departureMonth=2026-11&limit=5`;
  console.log('URL:', test1Url);

  try {
    const response1 = await fetch(test1Url);
    const data1 = await response1.json();
    console.log('Results:', data1.results?.length || 0);
    console.log('Total:', data1.pagination?.total || 0);
    if (data1.results?.length > 0) {
      console.log('Sample cruise:', {
        name: data1.results[0].name,
        sailingDate: data1.results[0].sailingDate,
        cruiseLine: data1.results[0].cruiseLine?.name
      });
    }
  } catch (error) {
    console.log('ERROR:', error.message);
  }
  console.log('');

  // Test 2: MSC + 6-8 nights (WORKING)
  console.log('TEST 2: MSC (line 16) + 6-8 nights');
  console.log('Expected: Should show MSC cruises');
  const test2Url = `${API_URL}/api/v1/search/comprehensive?cruiseLineId=16&nightRange=6-8&limit=5`;
  console.log('URL:', test2Url);

  try {
    const response2 = await fetch(test2Url);
    const data2 = await response2.json();
    console.log('Results:', data2.results?.length || 0);
    console.log('Total:', data2.pagination?.total || 0);
    if (data2.results?.length > 0) {
      const sample = data2.results[0];
      console.log('Sample cruise:', {
        name: sample.name,
        sailingDate: sample.sailingDate,
        cruiseLine: sample.cruiseLine?.name,
        nights: sample.nights
      });
      // Check for 2026+ cruises
      const has2026 = data2.results.some(c => c.sailingDate?.startsWith('2026'));
      console.log('Has 2026+ cruises:', has2026);
    }
  } catch (error) {
    console.log('ERROR:', error.message);
  }
  console.log('');

  // Test 3: Just Nov 2026 (no cruise line filter)
  console.log('TEST 3: November 2026 only (no cruise line filter)');
  const test3Url = `${API_URL}/api/v1/search/comprehensive?departureMonth=2026-11&limit=5`;
  console.log('URL:', test3Url);

  try {
    const response3 = await fetch(test3Url);
    const data3 = await response3.json();
    console.log('Results:', data3.results?.length || 0);
    console.log('Total:', data3.pagination?.total || 0);
    if (data3.results?.length > 0) {
      console.log('Sample cruise:', {
        name: data3.results[0].name,
        sailingDate: data3.results[0].sailingDate,
        cruiseLine: data3.results[0].cruiseLine?.name
      });
    }
  } catch (error) {
    console.log('ERROR:', error.message);
  }
  console.log('');

  // Test 4: Just MSC (no month filter)
  console.log('TEST 4: MSC only (no month filter)');
  const test4Url = `${API_URL}/api/v1/search/comprehensive?cruiseLineId=16&limit=5`;
  console.log('URL:', test4Url);

  try {
    const response4 = await fetch(test4Url);
    const data4 = await response4.json();
    console.log('Results:', data4.results?.length || 0);
    console.log('Total:', data4.pagination?.total || 0);
    if (data4.results?.length > 0) {
      const sample = data4.results[0];
      console.log('Sample cruise:', {
        name: sample.name,
        sailingDate: sample.sailingDate,
        cruiseLine: sample.cruiseLine?.name
      });
      // Check date range
      const dates = data4.results.map(c => c.sailingDate).sort();
      console.log('Date range:', dates[0], 'to', dates[dates.length - 1]);
    }
  } catch (error) {
    console.log('ERROR:', error.message);
  }
  console.log('');

  // Test 5: Database direct query for MSC Nov 2026
  console.log('TEST 5: Direct database query - MSC cruises in Nov 2026');
  console.log('This will check if data exists in the database');
  console.log('');

  // Test 6: Different month formats
  console.log('TEST 6: Testing different month format variations');
  const monthFormats = [
    '2026-11',
    '2026-11-01',
  ];

  for (const format of monthFormats) {
    console.log(`Testing format: ${format}`);
    const testUrl = `${API_URL}/api/v1/search/comprehensive?cruiseLineId=16&departureMonth=${format}&limit=1`;
    try {
      const response = await fetch(testUrl);
      const data = await response.json();
      console.log(`  Results: ${data.results?.length || 0}, Total: ${data.pagination?.total || 0}`);
    } catch (error) {
      console.log(`  ERROR: ${error.message}`);
    }
  }
  console.log('');

  console.log('=== DIAGNOSIS COMPLETE ===');
  console.log('\nNext steps:');
  console.log('1. Check backend logs for date filtering SQL');
  console.log('2. Verify month filter logic in search-comprehensive.service.ts');
  console.log('3. Check if frontend is sending the correct parameter format');
}

testFilters().catch(console.error);
