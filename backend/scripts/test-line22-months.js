#!/usr/bin/env node

/**
 * Quick test to verify line 22 discovers all months through 2027
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function testLine22Months() {
  console.log('='.repeat(60));
  console.log('Testing Line 22 Month Discovery');
  console.log('='.repeat(60));

  const { ftpConnectionPool } = require('../dist/services/ftp-connection-pool.service');

  const conn = await ftpConnectionPool.getConnection();

  try {
    const monthsFound = [];
    const currentYear = 2025;
    const currentMonth = 9;

    // Check each month from 2025/09 through 2027/12
    for (let year = 2025; year <= 2027; year++) {
      const startMonth = (year === 2025) ? 9 : 1;
      const endMonth = (year === 2027) ? 12 : 12;

      for (let month = startMonth; month <= endMonth; month++) {
        const monthStr = month.toString().padStart(2, '0');
        const linePath = `/${year}/${monthStr}/22`;

        try {
          const items = await conn.client.list(linePath);
          const shipCount = items.filter(item => item.type === 2 && item.name !== '.' && item.name !== '..').length;

          if (shipCount > 0) {
            monthsFound.push({
              month: `${year}/${monthStr}`,
              ships: shipCount
            });
            console.log(`✅ ${year}/${monthStr}: Found ${shipCount} ships`);
          } else {
            console.log(`⚠️  ${year}/${monthStr}: No ships found`);
          }
        } catch (error) {
          console.log(`❌ ${year}/${monthStr}: Directory not found`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY:');
    console.log(`Total months with data: ${monthsFound.length}`);
    console.log(`First month: ${monthsFound[0]?.month || 'None'}`);
    console.log(`Last month: ${monthsFound[monthsFound.length - 1]?.month || 'None'}`);

    if (monthsFound[monthsFound.length - 1]?.month === '2027/12') {
      console.log('\n✅ SUCCESS: Line 22 has data through December 2027!');
    } else {
      console.log('\n⚠️  WARNING: Line 22 data ends at', monthsFound[monthsFound.length - 1]?.month);
    }

  } finally {
    ftpConnectionPool.releaseConnection(conn.id);
  }

  process.exit(0);
}

// Run the test
testLine22Months().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
