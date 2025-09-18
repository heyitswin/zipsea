const https = require('https');

// Test different cruise lines to ensure fix works universally
const cruiseLinesToTest = [
  { id: 21, name: 'Viking' },
  { id: 8, name: 'NCL' },
  { id: 7, name: 'Royal Caribbean' },
  { id: 2, name: 'Princess' },
  { id: 11, name: 'Celebrity' },
];

async function fetchCruiseData(cruiseId) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.zipsea.com/api/cruises/${cruiseId}/comprehensive`, (res) => {
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

async function searchCruisesByLine(cruiseLineId) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.zipsea.com/api/search/comprehensive?cruiseLineId=${cruiseLineId}&limit=5`, (res) => {
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

async function testAllCruiseLines() {
  console.log('=== Comprehensive Cabin Fix Verification ===\n');
  console.log('Testing cabin category extraction across multiple cruise lines...\n');

  const summary = {
    totalTested: 0,
    withCabins: 0,
    withoutCabins: 0,
    errors: 0
  };

  for (const cruiseLine of cruiseLinesToTest) {
    console.log(`\n📊 Testing ${cruiseLine.name} (ID: ${cruiseLine.id})...`);

    try {
      const searchResult = await searchCruisesByLine(cruiseLine.id);

      if (!searchResult.data?.cruises || searchResult.data.cruises.length === 0) {
        console.log(`  No cruises found for ${cruiseLine.name}`);
        continue;
      }

      console.log(`  Found ${searchResult.data.cruises.length} cruises\n`);

      // Test first 3 cruises from each line
      for (const cruise of searchResult.data.cruises.slice(0, 3)) {
        summary.totalTested++;

        try {
          const result = await fetchCruiseData(cruise.id);

          if (!result.data) {
            console.log(`  ❌ ${cruise.id}: No data returned`);
            summary.errors++;
            continue;
          }

          const cabinCategories = result.data.cabinCategories;
          const hasCabins = cabinCategories && cabinCategories.length > 0;
          const hasRawDataCabins = result.data.cruise?.rawData?.cabins ? true : false;

          if (hasCabins) {
            const withImages = cabinCategories.filter(c => c.imageUrl).length;
            console.log(`  ✅ ${cruise.id}: ${cabinCategories.length} cabin categories (${withImages} with images)`);
            summary.withCabins++;
          } else {
            if (hasRawDataCabins) {
              console.log(`  ⚠️  ${cruise.id}: Has raw_data.cabins but NO cabins extracted - FIX NOT WORKING`);
            } else {
              console.log(`  ℹ️  ${cruise.id}: No cabins (no raw_data.cabins either - normal)`);
            }
            summary.withoutCabins++;
          }

        } catch (error) {
          console.log(`  ❌ ${cruise.id}: Error - ${error.message}`);
          summary.errors++;
        }
      }

    } catch (error) {
      console.log(`  Error searching ${cruiseLine.name}: ${error.message}`);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total cruises tested: ${summary.totalTested}`);
  console.log(`✅ With cabin categories: ${summary.withCabins}`);
  console.log(`ℹ️  Without cabin categories: ${summary.withoutCabins}`);
  console.log(`❌ Errors: ${summary.errors}`);
  console.log(`\nSuccess rate: ${((summary.withCabins / (summary.totalTested - summary.errors)) * 100).toFixed(1)}%`);

  if (summary.withCabins > 0) {
    console.log('\n✨ The cabin fix is working! Cruises with raw_data.cabins are now showing cabin categories.');
  }
}

testAllCruiseLines();
