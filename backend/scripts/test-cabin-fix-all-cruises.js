const https = require('https');

// Test a variety of cruise IDs to verify the fix works for all affected cruises
const testCruiseIds = [
  2069648, // Viking - we know this one works now
  2143102, // Symphony cruise mentioned earlier
  2069649, // Another Viking cruise
  2069650, // Another Viking cruise
  2143103, // Another Symphony cruise
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

async function testAllCruises() {
  console.log('Testing cabin categories extraction fix for multiple cruises...\n');

  for (const cruiseId of testCruiseIds) {
    try {
      const result = await fetchCruiseData(cruiseId);

      if (!result.data) {
        console.log(`❌ Cruise ${cruiseId}: No data returned`);
        continue;
      }

      const cabinCategories = result.data.cabinCategories;
      const hasCabins = cabinCategories && cabinCategories.length > 0;
      const hasRawData = result.data.cruise?.rawData?.cabins ? true : false;

      if (hasCabins) {
        const withImages = cabinCategories.filter(c => c.imageUrl).length;
        console.log(`✅ Cruise ${cruiseId}: ${cabinCategories.length} cabin categories (${withImages} with images)`);
      } else if (hasRawData) {
        console.log(`⚠️  Cruise ${cruiseId}: Has raw_data.cabins but NO cabin categories returned (fix may not be working)`);
      } else {
        console.log(`ℹ️  Cruise ${cruiseId}: No cabin categories (no raw_data.cabins either)`);
      }

    } catch (error) {
      console.log(`❌ Cruise ${cruiseId}: Error - ${error.message}`);
    }
  }

  console.log('\nFetching more Viking cruises from search...');

  // Get more Viking cruises from search
  https.get('https://api.zipsea.com/api/search/comprehensive?cruiseLineId=21&limit=10', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', async () => {
      try {
        const searchResult = JSON.parse(data);
        if (searchResult.data?.cruises) {
          console.log(`Found ${searchResult.data.cruises.length} Viking cruises in search\n`);

          // Test first 5 Viking cruises
          for (const cruise of searchResult.data.cruises.slice(0, 5)) {
            try {
              const result = await fetchCruiseData(cruise.id);
              const cabinCategories = result.data?.cabinCategories;
              const hasCabins = cabinCategories && cabinCategories.length > 0;

              if (hasCabins) {
                const withImages = cabinCategories.filter(c => c.imageUrl).length;
                console.log(`✅ Viking ${cruise.id} (${cruise.name}): ${cabinCategories.length} cabins (${withImages} with images)`);
              } else {
                console.log(`⚠️  Viking ${cruise.id} (${cruise.name}): No cabin categories`);
              }
            } catch (error) {
              console.log(`❌ Viking ${cruise.id}: Error - ${error.message}`);
            }
          }
        }
      } catch (e) {
        console.error('Error parsing search results:', e);
      }
    });
  }).on('error', console.error);
}

testAllCruises();
