require('dotenv').config({ path: ['.env.local', '.env'] });

const { ftpConnectionPool } = require('../dist/services/ftp-connection-pool.service.js');

async function analyzePricingStructure() {
  const ftpService = ftpConnectionPool;
  const conn = await ftpService.getConnection();

  try {
    console.log('Downloading sample cruise file...');
    const fs = require('fs');
    const tempFile = '/tmp/analyze-cruise.json';
    // Try a different cruise that might have pricing
    await conn.client.downloadTo(tempFile, '/2025/10/10/54/2092636.json');
    const data = JSON.parse(fs.readFileSync(tempFile, 'utf-8'));

    console.log('\n=== CHEAPEST PRICING DATA ===');
    console.log(JSON.stringify(data.cheapest, null, 2));

    console.log('\n=== FULL PRICING STRUCTURE ===');
    const prices = data.prices || {};
    const rateKeys = Object.keys(prices);
    console.log('Available rate codes:', rateKeys.length, 'total');
    console.log('First 3 rate codes:', rateKeys.slice(0, 3));

    // Analyze the structure of the first rate code
    if (rateKeys.length > 0) {
      const firstRateCode = rateKeys[0];
      const cabinKeys = Object.keys(prices[firstRateCode]);
      console.log('\nFor rate code "' + firstRateCode + '":');
      console.log('  Available cabins:', cabinKeys.length, 'total');
      console.log('  First 5 cabins:', cabinKeys.slice(0, 5));

      // Analyze the structure of the first cabin
      if (cabinKeys.length > 0) {
        const firstCabin = cabinKeys[0];
        const occupancyKeys = Object.keys(prices[firstRateCode][firstCabin]);
        console.log('\n  For cabin "' + firstCabin + '":');
        console.log('    Available occupancies:', occupancyKeys);

        // Show a complete pricing entry
        if (occupancyKeys.length > 0) {
          const firstOccupancy = occupancyKeys[0];
          console.log('\n=== SAMPLE COMPLETE PRICING ENTRY ===');
          console.log('Rate Code:', firstRateCode);
          console.log('Cabin Code:', firstCabin);
          console.log('Occupancy Code:', firstOccupancy);
          console.log(
            'Data:',
            JSON.stringify(prices[firstRateCode][firstCabin][firstOccupancy], null, 2)
          );
        }
      }
    }

    // Count total pricing entries
    let totalEntries = 0;
    for (const rateCode in prices) {
      for (const cabinCode in prices[rateCode]) {
        for (const occupancy in prices[rateCode][cabinCode]) {
          totalEntries++;
        }
      }
    }
    console.log('\n=== STATISTICS ===');
    console.log('Total pricing entries:', totalEntries);
    console.log('Average entries per rate code:', Math.round(totalEntries / rateKeys.length));
  } finally {
    ftpService.releaseConnection(conn);
  }
}

analyzePricingStructure().catch(console.error);
