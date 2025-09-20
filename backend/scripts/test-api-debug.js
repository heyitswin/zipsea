#!/usr/bin/env node

/**
 * Debug version of API test to see raw responses
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function testWithDebug() {
  console.log('🔍 API DEBUG TEST');
  console.log('='.repeat(70));

  const apiUrl = 'https://zipsea-production.onrender.com';
  console.log(`\n📡 Testing API: ${apiUrl}`);
  console.log('-'.repeat(40));

  try {
    // Test 1: Search API with raw output
    console.log('\n1. Testing Search API...');
    const searchCmd = `curl -s "${apiUrl}/api/v1/search/cruises?limit=2"`;
    console.log(`   Running: ${searchCmd}`);

    const { stdout: searchData, stderr: searchErr } = await execPromise(searchCmd);

    if (searchErr) {
      console.log(`   ❌ curl stderr: ${searchErr}`);
    }

    console.log('\n   Raw response (first 500 chars):');
    console.log('   ' + searchData.substring(0, 500));

    // Try to parse it
    try {
      const searchResult = JSON.parse(searchData);
      console.log('\n   Parsed successfully!');
      console.log(`   Success: ${searchResult.success}`);
      console.log(`   Has data field: ${searchResult.data !== undefined}`);

      if (searchResult.data) {
        console.log(`   Data type: ${typeof searchResult.data}`);
        console.log(`   Is array: ${Array.isArray(searchResult.data)}`);
        console.log(`   Data length: ${searchResult.data.length}`);

        if (searchResult.data.length > 0) {
          console.log('\n   First cruise:');
          console.log(`     ID: ${searchResult.data[0].id}`);
          console.log(`     Name: ${searchResult.data[0].name}`);
        }
      }

    } catch (parseErr) {
      console.log(`\n   ❌ Failed to parse JSON: ${parseErr.message}`);
    }

    // Test 2: Try a simpler endpoint
    console.log('\n2. Testing Health endpoint...');
    const healthCmd = `curl -s "${apiUrl}/health"`;
    const { stdout: healthData } = await execPromise(healthCmd);
    console.log(`   Health response: ${healthData}`);

  } catch (error) {
    console.log(`\n❌ Error: ${error.message}`);
  }

  console.log('\n' + '='.repeat(70));
}

testWithDebug().catch(console.error);
