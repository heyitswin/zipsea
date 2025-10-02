/**
 * Test the exact URL the frontend would call
 */

const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'https://zipsea-production.onrender.com';

async function testFrontendURL() {
  console.log('=== TESTING EXACT FRONTEND URLS ===\n');

  // The frontend sends 'cruiseLines' and 'months' parameters
  console.log('TEST 1: Exact URL from frontend - cruiseLines=16&months=2026-11');
  const frontendUrl1 = `${API_URL}/api/v1/search/comprehensive?cruiseLines=16&months=2026-11&limit=20&offset=0&sortBy=date&sortOrder=asc`;
  console.log('URL:', frontendUrl1);

  try {
    const response = await fetch(frontendUrl1);
    const data = await response.json();
    console.log('Results:', data.results?.length || 0);
    console.log('Total:', data.pagination?.total || 0);
    console.log('');
  } catch (error) {
    console.log('ERROR:', error.message);
  }

  // Test with nightRange parameter (as frontend sends it)
  console.log('TEST 2: Frontend URL - cruiseLines=16&nights=12+');
  const frontendUrl2 = `${API_URL}/api/v1/search/comprehensive?cruiseLines=16&nightRange=12%2B&limit=20&offset=0&sortBy=date&sortOrder=asc`;
  console.log('URL:', frontendUrl2);

  try {
    const response = await fetch(frontendUrl2);
    const data = await response.json();
    console.log('Results:', data.results?.length || 0);
    console.log('Total:', data.pagination?.total || 0);

    if (data.results?.length > 0) {
      console.log('\nFirst 5 cruises:');
      data.results.slice(0, 5).forEach(c => {
        console.log(`  ${c.sailingDate}: ${c.name} (${c.nights} nights)`);
      });

      // Check for Nov 2026
      const nov2026 = data.results.filter(c => c.sailingDate?.startsWith('2026-11'));
      console.log(`\nNovember 2026 cruises in results: ${nov2026.length}`);
    }
    console.log('');
  } catch (error) {
    console.log('ERROR:', error.message);
  }

  // Get last page of 12+ nights
  console.log('TEST 3: Last page of cruiseLines=16&nights=12+');

  try {
    // Get total first
    const response1 = await fetch(frontendUrl2);
    const data1 = await response1.json();
    const total = data1.pagination?.total || 0;
    const limit = 20;
    const lastPage = Math.ceil(total / limit);
    const lastOffset = (lastPage - 1) * limit;

    console.log('Total:', total);
    console.log('Last page:', lastPage);
    console.log('Last offset:', lastOffset);

    const lastPageUrl = `${API_URL}/api/v1/search/comprehensive?cruiseLines=16&nightRange=12%2B&limit=${limit}&offset=${lastOffset}&sortBy=date&sortOrder=asc`;
    console.log('URL:', lastPageUrl);

    const response2 = await fetch(lastPageUrl);
    const data2 = await response2.json();

    console.log('Results on last page:', data2.results?.length || 0);

    if (data2.results?.length > 0) {
      console.log('\nLast page cruises:');
      data2.results.forEach(c => {
        console.log(`  ${c.sailingDate}: ${c.name} (${c.nights} nights)`);
      });

      const nov2026 = data2.results.filter(c => c.sailingDate?.startsWith('2026-11'));
      console.log(`\nNovember 2026 cruises on last page: ${nov2026.length}`);
    }
  } catch (error) {
    console.log('ERROR:', error.message);
  }
}

testFrontendURL().catch(console.error);
