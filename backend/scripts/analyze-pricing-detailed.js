require('dotenv').config({ path: ['.env.local', '.env'] });

const { ftpConnectionPool } = require('../dist/services/ftp-connection-pool.service.js');

async function analyzePricingDetailed() {
  const ftpService = ftpConnectionPool;
  const conn = await ftpService.getConnection();

  try {
    console.log('Downloading sample cruise file...');
    const fs = require('fs');
    const tempFile = '/tmp/analyze-cruise-detailed.json';
    await conn.client.downloadTo(tempFile, '/2025/10/10/54/2092636.json');
    const data = JSON.parse(fs.readFileSync(tempFile, 'utf-8'));

    console.log('\n=== FULL CABIN PRICING STRUCTURE ===');
    const prices = data.prices || {};

    // Show structure for first rate code
    for (const rateCode in prices) {
      console.log(`\nRate Code: ${rateCode}`);
      const cabins = prices[rateCode];

      // Show first 2 cabins in detail
      let count = 0;
      for (const cabinCode in cabins) {
        if (count >= 2) break;
        count++;

        console.log(`\n  Cabin ${cabinCode}:`);
        const cabinData = cabins[cabinCode];

        // Show all fields for this cabin
        for (const field in cabinData) {
          const value = cabinData[field];
          if (value !== null && value !== undefined && value !== '') {
            console.log(`    ${field}: ${value}`);
          }
        }
      }

      // Count cabin types
      const cabinTypes = {};
      for (const cabinCode in cabins) {
        const cabinType = cabins[cabinCode].cabintype || 'unknown';
        cabinTypes[cabinType] = (cabinTypes[cabinType] || 0) + 1;
      }

      console.log('\n  Cabin Type Summary:');
      for (const type in cabinTypes) {
        console.log(`    ${type}: ${cabinTypes[type]} cabins`);
      }
    }

    // Also check if there's a simpler "cheapest" structure we should use
    console.log('\n=== CHEAPEST PRICES (from combined) ===');
    if (data.cheapest && data.cheapest.combined) {
      const combined = data.cheapest.combined;
      console.log('Inside:', combined.inside, `(${combined.insidepricecode})`);
      console.log('Outside:', combined.outside, `(${combined.outsidepricecode})`);
      console.log('Balcony:', combined.balcony, `(${combined.balconypricecode})`);
      console.log('Suite:', combined.suite, `(${combined.suitepricecode})`);
    }

  } finally {
    ftpService.releaseConnection(conn);
  }
}

analyzePricingDetailed().catch(console.error);
