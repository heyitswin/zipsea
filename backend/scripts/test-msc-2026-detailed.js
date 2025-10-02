/**
 * Detailed test to find MSC cruises in 2026
 */

const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'https://zipsea-production.onrender.com';

async function testMSC2026() {
  console.log('=== TESTING MSC CRUISES IN 2026 ===\n');

  // Test 1: Get MSC cruises and check date range
  console.log('TEST 1: Get MSC cruises and check what years are available');
  const mscUrl = `${API_URL}/api/v1/search/comprehensive?cruiseLineId=16&limit=100&sortBy=date&sortOrder=asc`;
  console.log('URL:', mscUrl);

  try {
    const response = await fetch(mscUrl);
    const data = await response.json();

    console.log('Total MSC cruises:', data.pagination?.total);
    console.log('Results returned:', data.results?.length);

    if (data.results?.length > 0) {
      // Get unique years
      const years = {};
      data.results.forEach(cruise => {
        const year = cruise.sailingDate?.split('-')[0] || cruise.sailingDate?.split('T')[0]?.split('-')[0];
        if (year) {
          years[year] = (years[year] || 0) + 1;
        }
      });

      console.log('\nMSC cruises by year (from first 100):');
      Object.keys(years).sort().forEach(year => {
        console.log(`  ${year}: ${years[year]} cruises`);
      });

      // Check if any 2026 cruises
      const has2026 = data.results.some(c => c.sailingDate?.startsWith('2026'));
      console.log('\nHas 2026 cruises in results:', has2026);

      if (has2026) {
        console.log('\nSample 2026 MSC cruises:');
        const cruises2026 = data.results.filter(c => c.sailingDate?.startsWith('2026')).slice(0, 5);
        cruises2026.forEach(c => {
          console.log(`  - ${c.name} (${c.sailingDate})`);
        });
      }
    }
  } catch (error) {
    console.log('ERROR:', error.message);
  }
  console.log('\n---\n');

  // Test 2: Try to get page 2, 3, etc to find 2026 cruises
  console.log('TEST 2: Search through pages to find 2026 MSC cruises');

  for (let page = 1; page <= 5; page++) {
    const pageUrl = `${API_URL}/api/v1/search/comprehensive?cruiseLineId=16&page=${page}&limit=100&sortBy=date&sortOrder=asc`;

    try {
      const response = await fetch(pageUrl);
      const data = await response.json();

      if (data.results?.length > 0) {
        const firstDate = data.results[0].sailingDate;
        const lastDate = data.results[data.results.length - 1].sailingDate;
        const has2026 = data.results.some(c => c.sailingDate?.startsWith('2026'));

        console.log(`Page ${page}: ${firstDate} to ${lastDate} (has 2026: ${has2026})`);

        if (has2026) {
          const nov2026 = data.results.filter(c => c.sailingDate?.startsWith('2026-11'));
          console.log(`  -> Found ${nov2026.length} November 2026 cruises on this page!`);
          if (nov2026.length > 0) {
            nov2026.slice(0, 3).forEach(c => {
              console.log(`     - ${c.name} (${c.sailingDate})`);
            });
          }
        }
      } else {
        console.log(`Page ${page}: No results`);
        break;
      }
    } catch (error) {
      console.log(`Page ${page}: ERROR - ${error.message}`);
      break;
    }
  }

  console.log('\n---\n');

  // Test 3: Try different year ranges
  console.log('TEST 3: Use date range filters to find MSC in 2026');

  const dateTests = [
    { startDate: '2026-01-01', endDate: '2026-12-31', label: 'All 2026' },
    { startDate: '2026-11-01', endDate: '2026-11-30', label: 'Nov 2026' },
    { startDate: '2026-10-01', endDate: '2026-11-30', label: 'Oct-Nov 2026' },
  ];

  for (const test of dateTests) {
    const url = `${API_URL}/api/v1/search/comprehensive?cruiseLineId=16&startDate=${test.startDate}&endDate=${test.endDate}&limit=5`;
    console.log(`\nTesting ${test.label}:`);
    console.log('URL:', url);

    try {
      const response = await fetch(url);
      const data = await response.json();
      console.log(`Results: ${data.results?.length || 0}, Total: ${data.pagination?.total || 0}`);

      if (data.results?.length > 0) {
        console.log('Sample cruise:', {
          name: data.results[0].name,
          sailingDate: data.results[0].sailingDate,
        });
      }
    } catch (error) {
      console.log('ERROR:', error.message);
    }
  }
}

testMSC2026().catch(console.error);
