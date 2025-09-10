require('dotenv').config({ path: ['.env.local', '.env'] });

const { FTPConnectionPoolService } = require('../dist/services/ftp-connection-pool.service.js');

async function checkPricingStructure() {
  const ftpService = new FTPService();
  const conn = await ftpService.getConnection();

  try {
    const buffer = await conn.downloadTo(null, '/2025/09/10/54/2092631.json');
    const data = JSON.parse(buffer.toString());

    console.log('Cheapest pricing data:');
    console.log(JSON.stringify(data.cheapest, null, 2));

    console.log('\nSample from prices object:');
    const prices = data.prices || {};
    const rateKeys = Object.keys(prices);
    console.log('Rate codes available:', rateKeys.slice(0, 5));

    const firstRateCode = rateKeys[0];
    if (firstRateCode) {
      const cabinKeys = Object.keys(prices[firstRateCode]);
      console.log('\nCabins for', firstRateCode + ':', cabinKeys.slice(0, 5));

      const firstCabin = cabinKeys[0];
      if (firstCabin) {
        const occupancyKeys = Object.keys(prices[firstRateCode][firstCabin]);
        console.log('Occupancies for', firstCabin + ':', occupancyKeys);

        const firstOccupancy = occupancyKeys[0];
        if (firstOccupancy) {
          console.log('\nSample pricing entry:');
          console.log('Rate Code:', firstRateCode);
          console.log('Cabin Code:', firstCabin);
          console.log('Occupancy:', firstOccupancy);
          console.log(
            'Data:',
            JSON.stringify(prices[firstRateCode][firstCabin][firstOccupancy], null, 2)
          );
        }
      }
    }
  } finally {
    ftpService.releaseConnection(conn);
  }
}

checkPricingStructure().catch(console.error);
