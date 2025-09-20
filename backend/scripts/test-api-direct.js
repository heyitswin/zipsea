#!/usr/bin/env node
const https = require('https');

function fetchCruise(cruiseId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'zipsea-production.onrender.com',
      path: `/api/cruises/${cruiseId}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Debug': 'true'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    console.log('Fetching cruise 2145865 from production API...\n');

    const response = await fetchCruise('2145865');

    if (response.success && response.data) {
      const cruise = response.data;
      console.log('API Response:');
      console.log('  ID:', cruise.id);
      console.log('  Interior Price:', cruise.interiorPrice);
      console.log('  Oceanview Price:', cruise.oceanviewPrice);
      console.log('  Balcony Price:', cruise.balconyPrice);
      console.log('  Suite Price:', cruise.suitePrice);
      console.log('  Cheapest Price:', cruise.cheapestPrice);

      // Check if prices match expected values
      console.log('\nExpected vs Actual:');
      console.log('  Interior: Expected $456.14, Got $' + cruise.interiorPrice);
      console.log('  Status:', cruise.interiorPrice === '456.14' ? '✅ CORRECT' : '❌ WRONG');
    } else {
      console.error('Failed to fetch cruise:', response);
    }

    // Also fetch cruise 2190299
    console.log('\n---\nFetching cruise 2190299 from production API...\n');
    const response2 = await fetchCruise('2190299');

    if (response2.success && response2.data) {
      const cruise = response2.data;
      console.log('API Response:');
      console.log('  ID:', cruise.id);
      console.log('  Interior Price:', cruise.interiorPrice);
      console.log('  Expected: $1091.18');
      console.log('  Status:', cruise.interiorPrice === '1091.18' ? '✅ CORRECT' : '❌ WRONG');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
