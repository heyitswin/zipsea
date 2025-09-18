require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

async function debugVikingCruise() {
  console.log('=== VIKING CRUISE DEBUG (ID: 2069648) ===\n');

  try {
    // Get the full cruise data
    const cruiseQuery = `
      SELECT
        c.id,
        c.cruise_id,
        c.name,
        cl.name as cruise_line,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        c.raw_data IS NOT NULL as has_raw_data,
        jsonb_typeof(c.raw_data) as raw_data_type,
        c.raw_data::text as raw_data_string
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.id = '2069648'
    `;

    const result = await pool.query(cruiseQuery);

    if (result.rows.length === 0) {
      console.log('❌ Cruise not found!');
      return;
    }

    const cruise = result.rows[0];
    console.log('Basic Info:');
    console.log('===========');
    console.log(`Name: ${cruise.name}`);
    console.log(`Cruise Line: ${cruise.cruise_line}`);
    console.log(`Has Raw Data: ${cruise.has_raw_data}`);
    console.log(`Raw Data Type: ${cruise.raw_data_type}`);

    console.log('\nPrices:');
    console.log('=======');
    console.log(`Interior: $${cruise.interior_price || 'N/A'}`);
    console.log(`Oceanview: $${cruise.oceanview_price || 'N/A'}`);
    console.log(`Balcony: $${cruise.balcony_price || 'N/A'}`);
    console.log(`Suite: $${cruise.suite_price || 'N/A'}`);

    if (cruise.has_raw_data && cruise.raw_data_type === 'object') {
      // Parse the raw data to check its structure
      const rawData = JSON.parse(cruise.raw_data_string);

      console.log('\nRaw Data Structure:');
      console.log('==================');
      console.log('Top-level keys:', Object.keys(rawData).slice(0, 20).join(', '));

      // Check for cabin-related fields
      console.log('\nCabin-related fields in raw_data:');
      console.log('==================================');
      console.log(`Has 'cabins': ${rawData.cabins ? 'YES' : 'NO'}`);
      console.log(`Has 'cabincategories': ${rawData.cabincategories ? 'YES' : 'NO'}`);
      console.log(`Has 'cabinCategories': ${rawData.cabinCategories ? 'YES' : 'NO'}`);
      console.log(`Has 'cabin': ${rawData.cabin ? 'YES' : 'NO'}`);

      // Check for price codes
      console.log('\nPrice codes in raw_data:');
      console.log('========================');
      console.log(`cheapestinsidepricecode: ${rawData.cheapestinsidepricecode || 'NULL'}`);
      console.log(`cheapestoutsidepricecode: ${rawData.cheapestoutsidepricecode || 'NULL'}`);
      console.log(`cheapestbalconypricecode: ${rawData.cheapestbalconypricecode || 'NULL'}`);
      console.log(`cheapestsuitepricecode: ${rawData.cheapestsuitepricecode || 'NULL'}`);

      // Check if there are any cabin structures
      if (rawData.cabins) {
        const cabinCount = Array.isArray(rawData.cabins)
          ? rawData.cabins.length
          : Object.keys(rawData.cabins).length;
        console.log(`\nFound 'cabins' with ${cabinCount} entries`);

        // Show sample cabin
        const sampleCabin = Array.isArray(rawData.cabins)
          ? rawData.cabins[0]
          : Object.values(rawData.cabins)[0];
        if (sampleCabin) {
          console.log('Sample cabin structure:', Object.keys(sampleCabin).join(', '));
          console.log('Sample cabin image:', sampleCabin.imageurl || 'NO IMAGE');
        }
      }

      if (rawData.cabincategories) {
        const cabinCount = Array.isArray(rawData.cabincategories)
          ? rawData.cabincategories.length
          : Object.keys(rawData.cabincategories).length;
        console.log(`\nFound 'cabincategories' with ${cabinCount} entries`);

        // Show sample cabin category
        const sampleCabin = Array.isArray(rawData.cabincategories)
          ? rawData.cabincategories[0]
          : Object.values(rawData.cabincategories)[0];
        if (sampleCabin) {
          console.log('Sample cabin category structure:', Object.keys(sampleCabin).join(', '));
          console.log('Sample cabin category image:', sampleCabin.imageurl || 'NO IMAGE');
        }
      }

      // Check for pricing array
      if (rawData.pricing) {
        console.log(`\nFound 'pricing' array with ${rawData.pricing.length} entries`);

        // Try to find cabins by matching price codes
        const insideCode = rawData.cheapestinsidepricecode;
        if (insideCode && rawData.pricing) {
          const matchingPricing = rawData.pricing.find(p => p.ratecode === insideCode || p.pricecode === insideCode);
          if (matchingPricing) {
            console.log(`\nFound pricing for inside cabin code ${insideCode}:`);
            console.log(`  Cabin code: ${matchingPricing.cabincode || 'N/A'}`);
          }
        }
      }

    } else {
      console.log('\n❌ No valid raw_data found!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugVikingCruise().catch(console.error);
