/**
 * Check MSC cruises around November 2026 (Oct, Nov, Dec 2026)
 */

const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'https://zipsea-production.onrender.com';

async function checkAroundNov2026() {
  console.log('=== CHECKING MSC CRUISES AROUND NOVEMBER 2026 ===\n');

  // Check each month from Sep 2026 to Jan 2027
  const months = [
    { month: '2026-09', name: 'September 2026' },
    { month: '2026-10', name: 'October 2026' },
    { month: '2026-11', name: 'November 2026' },
    { month: '2026-12', name: 'December 2026' },
    { month: '2027-01', name: 'January 2027' },
  ];

  console.log('Checking MSC availability month by month:\n');

  for (const { month, name } of months) {
    const url = `${API_URL}/api/v1/search/comprehensive?cruiseLineId=16&departureMonth=${month}&limit=5&sortBy=date&sortOrder=asc`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      const count = data.pagination?.total || 0;
      const status = count > 0 ? '✅' : '❌';

      console.log(`${status} ${name.padEnd(20)}: ${count.toString().padStart(4)} cruises`);

      if (data.results?.length > 0) {
        const dates = data.results.map(c => c.sailingDate);
        console.log(`   First cruise: ${dates[0]}`);
        console.log(`   Sample: ${data.results[0].name}`);
      }
    } catch (error) {
      console.log(`❌ ${name.padEnd(20)}: ERROR - ${error.message}`);
    }
    console.log('');
  }

  console.log('---\n');

  // Now check using continuous date range to see if there's a gap
  console.log('Checking continuous date range Oct 1 - Dec 31, 2026:\n');

  const rangeUrl = `${API_URL}/api/v1/search/comprehensive?cruiseLineId=16&startDate=2026-10-01&endDate=2026-12-31&limit=100&sortBy=date&sortOrder=asc`;

  try {
    const response = await fetch(rangeUrl);
    const data = await response.json();
    console.log('Total cruises Oct-Dec 2026:', data.pagination?.total);
    console.log('Results returned:', data.results?.length);

    if (data.results?.length > 0) {
      console.log('\nAll cruises in Oct-Dec 2026:');
      data.results.forEach(c => {
        console.log(`  ${c.sailingDate}: ${c.name} (${c.nights} nights)`);
      });
    }
  } catch (error) {
    console.log('ERROR:', error.message);
  }

  console.log('\n---\n');

  // Check specific dates around November
  console.log('Checking specific week-by-week in November 2026:\n');

  const weeks = [
    { start: '2026-10-25', end: '2026-10-31', name: 'Last week of October' },
    { start: '2026-11-01', end: '2026-11-07', name: 'Week 1 of November' },
    { start: '2026-11-08', end: '2026-11-14', name: 'Week 2 of November' },
    { start: '2026-11-15', end: '2026-11-21', name: 'Week 3 of November' },
    { start: '2026-11-22', end: '2026-11-30', name: 'Week 4 of November' },
    { start: '2026-12-01', end: '2026-12-07', name: 'First week of December' },
  ];

  for (const { start, end, name } of weeks) {
    const url = `${API_URL}/api/v1/search/comprehensive?cruiseLineId=16&startDate=${start}&endDate=${end}&limit=10`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      const count = data.pagination?.total || 0;
      const status = count > 0 ? '✅' : '❌';

      console.log(`${status} ${name.padEnd(25)}: ${count} cruises`);
    } catch (error) {
      console.log(`❌ ${name.padEnd(25)}: ERROR`);
    }
  }
}

checkAroundNov2026().catch(console.error);
