#!/usr/bin/env node

const https = require('https');

function fetchCruiseData(cruiseId) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.zipsea.com/api/v1/cruises/${cruiseId}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function checkApiResponse() {
  try {
    const data = await fetchCruiseData('2143102');

    console.log('=== API Response Analysis for Cruise 2143102 ===\n');

    // Check cruise object
    if (data.cruise) {
      console.log('Cruise object price fields:');
      Object.keys(data.cruise).forEach(key => {
        if (key.toLowerCase().includes('price') || key.toLowerCase().includes('cheapest')) {
          console.log(`  ${key}: ${JSON.stringify(data.cruise[key])}`);
        }
      });
    }

    // Check cheapestPricing
    if (data.cheapestPricing) {
      console.log('\nCheapestPricing object:');
      console.log(JSON.stringify(data.cheapestPricing, null, 2));
    }

    // Check for any other price-related fields
    console.log('\nAll top-level fields in response:');
    Object.keys(data).forEach(key => {
      if (key !== 'cruise' && key !== 'cheapestPricing') {
        console.log(`  ${key}: ${typeof data[key]}`);
      }
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

checkApiResponse();
