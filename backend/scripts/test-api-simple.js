#!/usr/bin/env node

/**
 * Simple API test - works with the actual response format
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function simpleTest() {
  const apiUrl = 'https://zipsea-production.onrender.com';

  console.log('Testing Search API...\n');

  try {
    const { stdout } = await execPromise(`curl -s "${apiUrl}/api/v1/search/cruises?limit=3"`);
    const response = JSON.parse(stdout);

    if (response.cruises && response.cruises.length > 0) {
      console.log(`✅ Found ${response.cruises.length} cruises:\n`);

      response.cruises.forEach((cruise, i) => {
        console.log(`${i + 1}. ${cruise.name}`);
        console.log(`   ID: ${cruise.id}`);
        console.log(`   Sailing: ${cruise.sailingDate}`);
        console.log(`   Nights: ${cruise.nights}`);
        console.log(`   Price: ${cruise.price !== null ? '$' + cruise.price : 'Not available'}`);
        console.log('');
      });

      // Test detail endpoint for first cruise
      const cruiseId = response.cruises[0].id;
      console.log(`Testing Detail API for cruise ${cruiseId}...`);

      const { stdout: detailStdout } = await execPromise(`curl -s "${apiUrl}/api/v1/cruises/${cruiseId}"`);
      const detailResponse = JSON.parse(detailStdout);

      if (detailResponse.success && detailResponse.data) {
        const cruise = detailResponse.data;
        console.log(`\n✅ Got details for: ${cruise.name}`);
        console.log(`   Interior Price: ${cruise.interiorPrice || 'N/A'}`);
        console.log(`   Oceanview Price: ${cruise.oceanviewPrice || 'N/A'}`);
        console.log(`   Balcony Price: ${cruise.balconyPrice || 'N/A'}`);
        console.log(`   Suite Price: ${cruise.suitePrice || 'N/A'}`);
      } else if (detailResponse) {
        // Maybe data is not wrapped
        console.log(`\nGot response:`, Object.keys(detailResponse).slice(0, 10));
      }

    } else {
      console.log('❌ No cruises found');
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

simpleTest();
