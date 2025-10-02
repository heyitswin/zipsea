/**
 * Test MSC with 12+ nights to verify 2026/2027 data exists
 */

const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'https://zipsea-production.onrender.com';

async function testMSCNightFilter() {
  console.log('=== TESTING MSC WITH 12+ NIGHTS FILTER ===\n');

  // Test 1: MSC + 12+ nights
  console.log('TEST 1: MSC (line 16) + 12+ nights');
  const nightUrl = `${API_URL}/api/v1/search/comprehensive?cruiseLineId=16&minNights=12&limit=100&sortBy=date&sortOrder=asc`;
  console.log('URL:', nightUrl);

  try {
    const response = await fetch(nightUrl);
    const data = await response.json();
    console.log('Results:', data.results?.length || 0);
    console.log('Total:', data.pagination?.total || 0);

    if (data.results?.length > 0) {
      // Check date range
      const dates = data.results.map(c => c.sailingDate).sort();
      console.log('Date range:', dates[0], 'to', dates[dates.length - 1]);

      // Check for Nov 2026 specifically
      const nov2026 = data.results.filter(c => c.sailingDate?.startsWith('2026-11'));
      console.log('November 2026 cruises found:', nov2026.length);

      if (nov2026.length > 0) {
        console.log('\nSample Nov 2026 cruises:');
        nov2026.slice(0, 5).forEach(c => {
          console.log(`  - ${c.name} (${c.sailingDate}, ${c.nights} nights)`);
        });
      }

      // Check for 2027 cruises
      const cruises2027 = data.results.filter(c => c.sailingDate?.startsWith('2027'));
      console.log('\n2027 cruises found:', cruises2027.length);

      if (cruises2027.length > 0) {
        console.log('Latest 2027 cruise:', cruises2027[cruises2027.length - 1].sailingDate);
      }
    }
  } catch (error) {
    console.log('ERROR:', error.message);
  }
  console.log('\n---\n');

  // Test 2: Get last page to see furthest dates
  console.log('TEST 2: Get last page of MSC 12+ nights results');

  try {
    // First get total count
    const response1 = await fetch(nightUrl);
    const data1 = await response1.json();
    const total = data1.pagination?.total || 0;
    const limit = 100;
    const lastPage = Math.ceil(total / limit);

    console.log('Total results:', total);
    console.log('Last page:', lastPage);

    // Get last page
    const lastPageUrl = `${API_URL}/api/v1/search/comprehensive?cruiseLineId=16&minNights=12&limit=${limit}&page=${lastPage}&sortBy=date&sortOrder=asc`;
    const response2 = await fetch(lastPageUrl);
    const data2 = await response2.json();

    if (data2.results?.length > 0) {
      const dates = data2.results.map(c => c.sailingDate).sort();
      console.log('Last page date range:', dates[0], 'to', dates[dates.length - 1]);

      // Show last few cruises
      console.log('\nLast 5 cruises:');
      data2.results.slice(-5).forEach(c => {
        console.log(`  - ${c.sailingDate}: ${c.name} (${c.nights} nights)`);
      });
    }
  } catch (error) {
    console.log('ERROR:', error.message);
  }
  console.log('\n---\n');

  // Test 3: Now test MSC + Nov 2026 WITH night filter
  console.log('TEST 3: MSC + November 2026 + 12+ nights (combined filters)');
  const combinedUrl = `${API_URL}/api/v1/search/comprehensive?cruiseLineId=16&departureMonth=2026-11&minNights=12&limit=10`;
  console.log('URL:', combinedUrl);

  try {
    const response = await fetch(combinedUrl);
    const data = await response.json();
    console.log('Results:', data.results?.length || 0);
    console.log('Total:', data.pagination?.total || 0);

    if (data.results?.length > 0) {
      console.log('\nSample cruises:');
      data.results.slice(0, 5).forEach(c => {
        console.log(`  - ${c.name} (${c.sailingDate}, ${c.nights} nights)`);
      });
    }
  } catch (error) {
    console.log('ERROR:', error.message);
  }
  console.log('\n---\n');

  // Test 4: MSC + Nov 2026 WITHOUT night filter (for comparison)
  console.log('TEST 4: MSC + November 2026 WITHOUT night filter (comparison)');
  const monthOnlyUrl = `${API_URL}/api/v1/search/comprehensive?cruiseLineId=16&departureMonth=2026-11&limit=10`;
  console.log('URL:', monthOnlyUrl);

  try {
    const response = await fetch(monthOnlyUrl);
    const data = await response.json();
    console.log('Results:', data.results?.length || 0);
    console.log('Total:', data.pagination?.total || 0);
  } catch (error) {
    console.log('ERROR:', error.message);
  }
  console.log('\n---\n');

  // Test 5: Check MSC cruises in Nov 2026 using date range instead of month
  console.log('TEST 5: MSC + Nov 2026 using startDate/endDate instead of departureMonth');
  const dateRangeUrl = `${API_URL}/api/v1/search/comprehensive?cruiseLineId=16&startDate=2026-11-01&endDate=2026-11-30&limit=10`;
  console.log('URL:', dateRangeUrl);

  try {
    const response = await fetch(dateRangeUrl);
    const data = await response.json();
    console.log('Results:', data.results?.length || 0);
    console.log('Total:', data.pagination?.total || 0);

    if (data.results?.length > 0) {
      console.log('\nSample cruises:');
      data.results.slice(0, 5).forEach(c => {
        console.log(`  - ${c.name} (${c.sailingDate}, ${c.nights} nights)`);
      });
    }
  } catch (error) {
    console.log('ERROR:', error.message);
  }
}

testMSCNightFilter().catch(console.error);
