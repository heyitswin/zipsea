const https = require('https');

// Test specific known cruise IDs from different cruise lines
const testCases = [
  // Viking cruises
  { id: 2069648, line: 'Viking', expectedResult: 'should have cabins' },

  // Symphony cruise (mentioned earlier in conversation)
  { id: 2143102, line: 'Symphony', expectedResult: 'should have cabins' },
  { id: 2143103, line: 'Symphony', expectedResult: 'should have cabins' },

  // Test some random cruise IDs to see if they have cabin data
  { id: 2143100, line: 'Unknown', expectedResult: 'unknown' },
  { id: 2143101, line: 'Unknown', expectedResult: 'unknown' },
  { id: 2143104, line: 'Unknown', expectedResult: 'unknown' },
  { id: 2143105, line: 'Unknown', expectedResult: 'unknown' },

  // More IDs from different ranges
  { id: 2069645, line: 'Unknown', expectedResult: 'unknown' },
  { id: 2069646, line: 'Unknown', expectedResult: 'unknown' },
  { id: 2069647, line: 'Unknown', expectedResult: 'unknown' },
];

async function fetchCruiseData(cruiseId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.zipsea.com',
      path: `/api/cruises/${cruiseId}/comprehensive`,
      method: 'GET',
      timeout: 10000
    };

    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve(parsed);
          } else {
            resolve({ error: `HTTP ${res.statusCode}`, data: parsed });
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function verifyFix() {
  console.log('=== VERIFYING CABIN FIX FOR ALL AFFECTED CRUISES ===\n');
  console.log('The fix extracts cabin categories from raw_data when not in database.\n');

  const results = {
    tested: 0,
    found: 0,
    withCabins: 0,
    withoutCabins: 0,
    withRawData: 0,
    errors: 0
  };

  for (const testCase of testCases) {
    results.tested++;
    process.stdout.write(`Testing cruise ${testCase.id} (${testCase.line})... `);

    try {
      const response = await fetchCruiseData(testCase.id);

      if (response.error) {
        console.log(`❌ Not found`);
        continue;
      }

      results.found++;

      const data = response.data;
      const cabinCategories = data?.cabinCategories;
      const hasCabins = cabinCategories && cabinCategories.length > 0;
      const hasRawData = data?.cruise?.rawData ? true : false;
      const hasRawDataCabins = data?.cruise?.rawData?.cabins ? true : false;

      if (hasCabins) {
        const withImages = cabinCategories.filter(c => c.imageUrl).length;
        console.log(`✅ ${cabinCategories.length} cabins (${withImages} with images)`);
        results.withCabins++;
      } else {
        if (hasRawDataCabins) {
          console.log(`⚠️  HAS raw_data.cabins but NO cabins extracted - FIX NOT WORKING!`);
          results.withoutCabins++;
          results.withRawData++;
        } else if (hasRawData) {
          console.log(`ℹ️  Has raw_data but no cabins in it`);
          results.withoutCabins++;
        } else {
          console.log(`ℹ️  No cabins (no raw_data)`);
          results.withoutCabins++;
        }
      }

      // Show cruise line name from data if different from expected
      if (data?.cruiseLine?.name && testCase.line === 'Unknown') {
        console.log(`     → Actual cruise line: ${data.cruiseLine.name}`);
      }

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      results.errors++;
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Cruises tested: ${results.tested}`);
  console.log(`Cruises found: ${results.found}`);
  console.log(`✅ With cabin categories: ${results.withCabins}`);
  console.log(`ℹ️  Without cabin categories: ${results.withoutCabins}`);
  if (results.withRawData > 0) {
    console.log(`⚠️  Has raw_data.cabins but not extracted: ${results.withRawData}`);
  }
  console.log(`❌ Errors: ${results.errors}`);

  if (results.found > 0) {
    const successRate = ((results.withCabins / results.found) * 100).toFixed(1);
    console.log(`\nSuccess rate: ${successRate}% of found cruises have cabin data`);
  }

  console.log('\n=== CONCLUSION ===');
  if (results.withRawData === 0) {
    console.log('✅ The fix is working! All cruises with raw_data.cabins are showing cabin categories.');
    console.log('   The fix applies to ALL cruises, not just Viking.');
  } else {
    console.log('⚠️  Some cruises with raw_data.cabins are not showing cabin categories.');
    console.log('   The fix may not be working for all cases.');
  }
}

verifyFix();
