/**
 * Check which months MSC has cruises in 2026
 */

const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'https://zipsea-production.onrender.com';

async function checkMSCMonths() {
  console.log('=== CHECKING MSC CRUISE AVAILABILITY BY MONTH IN 2026 ===\n');

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  console.log('Testing each month in 2026 for MSC (cruise line 16):\n');

  const results = [];

  for (let month = 1; month <= 12; month++) {
    const monthStr = month.toString().padStart(2, '0');
    const monthKey = `2026-${monthStr}`;

    // Calculate last day of month
    const lastDay = new Date(2026, month, 0).getDate();
    const startDate = `${monthKey}-01`;
    const endDate = `${monthKey}-${lastDay}`;

    const url = `${API_URL}/api/v1/search/comprehensive?cruiseLineId=16&startDate=${startDate}&endDate=${endDate}&limit=1`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      const count = data.pagination?.total || 0;

      results.push({
        month: months[month - 1],
        monthNum: month,
        count,
        hasData: count > 0
      });

      const status = count > 0 ? '✅' : '❌';
      console.log(`${status} ${months[month - 1].padEnd(10)} (${monthKey}): ${count.toString().padStart(4)} cruises`);
    } catch (error) {
      console.log(`❌ ${months[month - 1].padEnd(10)} (${monthKey}): ERROR - ${error.message}`);
      results.push({
        month: months[month - 1],
        monthNum: month,
        count: 0,
        hasData: false,
        error: error.message
      });
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total months with MSC cruises: ${results.filter(r => r.hasData).length}/12`);
  console.log(`Months WITHOUT MSC cruises: ${results.filter(r => !r.hasData).map(r => r.month).join(', ') || 'None'}`);

  const totalCruises = results.reduce((sum, r) => sum + r.count, 0);
  console.log(`Total MSC cruises in 2026: ${totalCruises}`);

  // Also test a few other major cruise lines for comparison
  console.log('\n=== COMPARISON: Other cruise lines in November 2026 ===\n');

  const cruiseLines = [
    { id: 1, name: 'Carnival' },
    { id: 2, name: 'Royal Caribbean' },
    { id: 3, name: 'Norwegian' },
    { id: 16, name: 'MSC' },
    { id: 21, name: 'Celebrity' },
  ];

  for (const line of cruiseLines) {
    const url = `${API_URL}/api/v1/search/comprehensive?cruiseLineId=${line.id}&departureMonth=2026-11&limit=1`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      const count = data.pagination?.total || 0;
      const status = count > 0 ? '✅' : '❌';

      console.log(`${status} ${line.name.padEnd(20)} (ID ${line.id.toString().padStart(2)}): ${count.toString().padStart(4)} cruises in Nov 2026`);
    } catch (error) {
      console.log(`❌ ${line.name.padEnd(20)} (ID ${line.id.toString().padStart(2)}): ERROR`);
    }
  }
}

checkMSCMonths().catch(console.error);
