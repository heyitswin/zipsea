/**
 * Check for data gaps across all cruise lines in 2026
 */

const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'https://zipsea-production.onrender.com';

async function checkDataGaps() {
  console.log('=== CHECKING DATA COVERAGE FOR 2026 ===\n');

  // Get all cruise lines
  console.log('Fetching all cruise lines...');
  const facetsUrl = `${API_URL}/api/v1/search/comprehensive/facets`;

  let cruiseLines = [];
  try {
    const response = await fetch(facetsUrl);
    const data = await response.json();
    cruiseLines = data.cruiseLines || [];
    console.log(`Found ${cruiseLines.length} cruise lines\n`);
  } catch (error) {
    console.log('ERROR fetching cruise lines:', error.message);
    return;
  }

  // Check each cruise line for 2026 coverage
  console.log('Checking 2026 coverage for each cruise line:\n');

  const results = [];

  for (const line of cruiseLines.slice(0, 20)) { // Check top 20 to avoid rate limits
    const url = `${API_URL}/api/v1/search/comprehensive?cruiseLineId=${line.id}&startDate=2026-01-01&endDate=2026-12-31&limit=1`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      const count = data.pagination?.total || 0;

      results.push({
        id: line.id,
        name: line.name,
        count2026: count,
        hasCruises: count > 0
      });

      const status = count > 0 ? '✅' : '❌';
      console.log(`${status} ${line.name.padEnd(30)} (ID ${line.id.toString().padStart(2)}): ${count.toString().padStart(5)} cruises in 2026`);
    } catch (error) {
      console.log(`❌ ${line.name.padEnd(30)} (ID ${line.id.toString().padStart(2)}): ERROR - ${error.message}`);
      results.push({
        id: line.id,
        name: line.name,
        count2026: 0,
        hasCruises: false,
        error: error.message
      });
    }
  }

  console.log('\n=== SUMMARY ===');
  const linesWithData = results.filter(r => r.hasCruises);
  const linesWithoutData = results.filter(r => !r.hasCruises);

  console.log(`Cruise lines WITH 2026 data: ${linesWithData.length}`);
  console.log(`Cruise lines WITHOUT 2026 data: ${linesWithoutData.length}`);

  if (linesWithoutData.length > 0) {
    console.log('\nCruise lines missing 2026 data:');
    linesWithoutData.forEach(line => {
      console.log(`  - ${line.name} (ID ${line.id})`);
    });
  }

  // Check total cruises in 2026
  console.log('\n=== OVERALL 2026 STATISTICS ===\n');

  const totalUrl = `${API_URL}/api/v1/search/comprehensive?startDate=2026-01-01&endDate=2026-12-31&limit=1`;
  try {
    const response = await fetch(totalUrl);
    const data = await response.json();
    const total = data.pagination?.total || 0;
    console.log(`Total cruises in 2026 (all lines): ${total}`);
  } catch (error) {
    console.log('ERROR:', error.message);
  }

  // Check by month
  console.log('\n=== CRUISES BY MONTH IN 2026 ===\n');

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  for (let month = 1; month <= 12; month++) {
    const monthStr = month.toString().padStart(2, '0');
    const monthKey = `2026-${monthStr}`;

    const url = `${API_URL}/api/v1/search/comprehensive?departureMonth=${monthKey}&limit=1`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      const count = data.pagination?.total || 0;

      console.log(`${months[month - 1].padEnd(10)}: ${count.toString().padStart(5)} cruises`);
    } catch (error) {
      console.log(`${months[month - 1].padEnd(10)}: ERROR`);
    }
  }
}

checkDataGaps().catch(console.error);
