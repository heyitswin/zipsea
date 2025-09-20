require('dotenv').config();
const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Function to fetch from API
function fetchFromAPI(cruiseId) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.zipsea.com/api/cruises/${cruiseId}`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.data);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

async function investigatePricing() {
  try {
    console.log('🔍 COMPREHENSIVE PRICING INVESTIGATION');
    console.log('=' .repeat(60));

    // Get a sample of cruises with various price points
    const cruisesResult = await pool.query(`
      SELECT
        id,
        name,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price,
        updated_at,
        CASE
          WHEN interior_price IS NULL AND oceanview_price IS NULL
               AND balcony_price IS NULL AND suite_price IS NULL
          THEN 'NO_PRICES'
          WHEN cheapest_price IS NULL
          THEN 'NO_CHEAPEST'
          WHEN cheapest_price != LEAST(
            COALESCE(interior_price, 999999),
            COALESCE(oceanview_price, 999999),
            COALESCE(balcony_price, 999999),
            COALESCE(suite_price, 999999)
          )
          THEN 'CHEAPEST_MISMATCH'
          ELSE 'OK'
        END as price_status
      FROM cruises
      WHERE sailing_date > CURRENT_DATE
      ORDER BY RANDOM()
      LIMIT 20
    `);

    console.log(`\nAnalyzing ${cruisesResult.rows.length} random future cruises...\n`);

    const issues = {
      apiReturnsNull: [],
      apiMismatchesDB: [],
      cheapestPriceWrong: [],
      noPricesInDB: [],
      workingCorrectly: []
    };

    for (const cruise of cruisesResult.rows) {
      process.stdout.write(`Checking cruise ${cruise.id}... `);

      // Fetch from API
      const apiData = await fetchFromAPI(cruise.id);

      if (!apiData) {
        console.log('❌ API error');
        continue;
      }

      // Check API vs DB
      const apiPrices = {
        interior: apiData.interiorPrice,
        oceanview: apiData.oceanviewPrice,
        balcony: apiData.balconyPrice,
        suite: apiData.suitePrice,
        cheapest: apiData.cheapestPrice
      };

      const dbPrices = {
        interior: parseFloat(cruise.interior_price),
        oceanview: parseFloat(cruise.oceanview_price),
        balcony: parseFloat(cruise.balcony_price),
        suite: parseFloat(cruise.suite_price),
        cheapest: parseFloat(cruise.cheapest_price)
      };

      // Categorize issues
      if (apiPrices.interior === null && dbPrices.interior > 0) {
        issues.apiReturnsNull.push({
          id: cruise.id,
          name: cruise.name,
          dbInterior: dbPrices.interior,
          apiInterior: apiPrices.interior
        });
        console.log('❌ API returns null');
      } else if (apiPrices.interior && Math.abs(apiPrices.interior - dbPrices.interior) > 0.01) {
        issues.apiMismatchesDB.push({
          id: cruise.id,
          name: cruise.name,
          dbInterior: dbPrices.interior,
          apiInterior: apiPrices.interior,
          difference: apiPrices.interior - dbPrices.interior
        });
        console.log('⚠️  API mismatch');
      } else if (cruise.price_status === 'CHEAPEST_MISMATCH') {
        issues.cheapestPriceWrong.push({
          id: cruise.id,
          name: cruise.name,
          cheapest: dbPrices.cheapest,
          shouldBe: Math.min(
            dbPrices.interior || 999999,
            dbPrices.oceanview || 999999,
            dbPrices.balcony || 999999,
            dbPrices.suite || 999999
          )
        });
        console.log('⚠️  Cheapest wrong');
      } else if (cruise.price_status === 'NO_PRICES') {
        issues.noPricesInDB.push({
          id: cruise.id,
          name: cruise.name
        });
        console.log('⚠️  No prices');
      } else {
        issues.workingCorrectly.push(cruise.id);
        console.log('✅ OK');
      }
    }

    // Report findings
    console.log('\n' + '=' .repeat(60));
    console.log('📊 FINDINGS SUMMARY\n');

    console.log(`✅ Working correctly: ${issues.workingCorrectly.length} cruises`);

    if (issues.apiReturnsNull.length > 0) {
      console.log(`\n❌ API RETURNS NULL (but DB has prices): ${issues.apiReturnsNull.length} cruises`);
      issues.apiReturnsNull.slice(0, 3).forEach(c => {
        console.log(`   - ${c.id}: DB has $${c.dbInterior}, API returns null`);
      });
    }

    if (issues.apiMismatchesDB.length > 0) {
      console.log(`\n⚠️  API MISMATCHES DB: ${issues.apiMismatchesDB.length} cruises`);
      issues.apiMismatchesDB.slice(0, 3).forEach(c => {
        console.log(`   - ${c.id}: DB $${c.dbInterior}, API $${c.apiInterior} (diff: $${c.difference.toFixed(2)})`);
      });
    }

    if (issues.cheapestPriceWrong.length > 0) {
      console.log(`\n⚠️  CHEAPEST PRICE CALCULATION WRONG: ${issues.cheapestPriceWrong.length} cruises`);
      issues.cheapestPriceWrong.slice(0, 3).forEach(c => {
        console.log(`   - ${c.id}: cheapest is $${c.cheapest}, should be $${c.shouldBe}`);
      });
    }

    if (issues.noPricesInDB.length > 0) {
      console.log(`\n⚠️  NO PRICES IN DATABASE: ${issues.noPricesInDB.length} cruises`);
    }

    // Check for pattern in API null returns
    if (issues.apiReturnsNull.length > 0) {
      console.log('\n🔍 INVESTIGATING API NULL PATTERN...');

      // Check if these cruises have anything in common
      const sampleIds = issues.apiReturnsNull.slice(0, 5).map(c => `'${c.id}'`).join(',');
      const patternResult = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(DISTINCT cruise_line_id) as unique_lines,
          COUNT(DISTINCT ship_id) as unique_ships,
          MIN(updated_at) as oldest_update,
          MAX(updated_at) as newest_update,
          COUNT(CASE WHEN raw_data IS NULL THEN 1 END) as null_raw_data,
          COUNT(CASE WHEN raw_data::text LIKE '{"0":%' THEN 1 END) as corrupted_raw_data
        FROM cruises
        WHERE id IN (${sampleIds})
      `);

      const pattern = patternResult.rows[0];
      console.log('Pattern analysis:');
      console.log(`  - Unique cruise lines: ${pattern.unique_lines}`);
      console.log(`  - Unique ships: ${pattern.unique_ships}`);
      console.log(`  - Null raw_data: ${pattern.null_raw_data}`);
      console.log(`  - Corrupted raw_data: ${pattern.corrupted_raw_data}`);
      console.log(`  - Update range: ${pattern.oldest_update} to ${pattern.newest_update}`);
    }

    // Check cheapest_pricing table
    console.log('\n🔍 CHECKING CHEAPEST_PRICING TABLE...');
    const pricingTableResult = await pool.query(`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(cp.cruise_id) as in_cheapest_pricing,
        COUNT(*) - COUNT(cp.cruise_id) as missing_from_cheapest
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.sailing_date > CURRENT_DATE
    `);

    const pricingTable = pricingTableResult.rows[0];
    console.log(`Total future cruises: ${pricingTable.total_cruises}`);
    console.log(`In cheapest_pricing: ${pricingTable.in_cheapest_pricing}`);
    console.log(`Missing from cheapest_pricing: ${pricingTable.missing_from_cheapest}`);

    console.log('\n' + '=' .repeat(60));
    console.log('\n🎯 ROOT CAUSE ANALYSIS:\n');

    if (issues.apiReturnsNull.length > issues.apiMismatchesDB.length) {
      console.log('PRIMARY ISSUE: API is returning null for cruises that have prices in DB');
      console.log('This suggests the API query logic may be excluding certain cruises');
      console.log('or not properly joining with the cheapest_pricing table.');
    } else if (issues.apiMismatchesDB.length > 0) {
      console.log('PRIMARY ISSUE: API returns different prices than what\'s in the database');
      console.log('This suggests the API may be caching old data or querying wrong fields.');
    } else if (issues.cheapestPriceWrong.length > 0) {
      console.log('PRIMARY ISSUE: Database trigger for cheapest_price calculation is not working');
      console.log('The cheapest_price field is not being updated when cabin prices change.');
    } else {
      console.log('Most cruises appear to be working correctly.');
      console.log('Issues may be isolated to specific edge cases.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

investigatePricing();
