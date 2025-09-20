const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function examineDisneyRawData() {
  console.log('🔍 Examining Disney Cruise Line raw_data structure...\n');

  try {
    // Get Disney Cruise Line ID
    const lineResult = await pool.query(
      `SELECT id, name FROM cruise_lines WHERE LOWER(name) LIKE '%disney%'`
    );

    if (lineResult.rows.length === 0) {
      console.log('❌ Disney Cruise Line not found');
      return;
    }

    const disneyLine = lineResult.rows[0];
    console.log(`Found: ${disneyLine.name} (ID: ${disneyLine.id})\n`);

    // Get one Disney cruise with raw_data
    const cruiseResult = await pool.query(`
      SELECT
        c.id,
        c.cruise_id,
        c.name,
        c.raw_data,
        cp.interior_price,
        cp.oceanview_price,
        cp.balcony_price,
        cp.suite_price
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE c.cruise_line_id = $1
        AND c.raw_data IS NOT NULL
        AND c.updated_at > CURRENT_DATE - INTERVAL '7 days'
      ORDER BY c.updated_at DESC
      LIMIT 1
    `, [disneyLine.id]);

    if (cruiseResult.rows.length === 0) {
      console.log('No recent Disney cruises found with raw_data');
      return;
    }

    const cruise = cruiseResult.rows[0];
    console.log(`📊 Examining cruise ${cruise.cruise_id}: ${cruise.name}`);
    console.log(`DB Prices: Interior=$${cruise.interior_price}, Ocean=$${cruise.oceanview_price}, Balcony=$${cruise.balcony_price}, Suite=$${cruise.suite_price}\n`);

    const rawData = cruise.raw_data;

    // List all top-level keys
    console.log('🔑 Top-level keys in raw_data:');
    const topLevelKeys = Object.keys(rawData).sort();
    topLevelKeys.forEach(key => {
      const value = rawData[key];
      const valueType = Array.isArray(value) ? 'array' : typeof value;
      const preview = valueType === 'object' ?
        JSON.stringify(value).substring(0, 100) + '...' :
        String(value).substring(0, 100);
      console.log(`  - ${key}: (${valueType}) ${preview}`);
    });

    console.log('\n🔍 Looking for price-related fields:');

    // Check for any field containing 'price' in the name
    const priceFields = topLevelKeys.filter(key =>
      key.toLowerCase().includes('price') ||
      key.toLowerCase().includes('cheap') ||
      key.toLowerCase().includes('rate') ||
      key.toLowerCase().includes('fare') ||
      key.toLowerCase().includes('cost')
    );

    if (priceFields.length > 0) {
      console.log('Found potential price fields:');
      priceFields.forEach(field => {
        console.log(`  - ${field}: ${JSON.stringify(rawData[field]).substring(0, 200)}`);
      });
    } else {
      console.log('  No direct price fields found at top level');
    }

    // Check if there's a 'prices' object
    if (rawData.prices) {
      console.log('\n📦 Found "prices" object structure:');
      if (typeof rawData.prices === 'object') {
        const priceKeys = Object.keys(rawData.prices).slice(0, 3); // Show first 3 rate codes
        priceKeys.forEach(rateCode => {
          console.log(`  Rate code: ${rateCode}`);
          const rateData = rawData.prices[rateCode];
          if (typeof rateData === 'object') {
            const cabinTypes = Object.keys(rateData).slice(0, 3); // Show first 3 cabin types
            cabinTypes.forEach(cabinType => {
              console.log(`    Cabin type: ${cabinType}`);
              const cabinData = rateData[cabinType];
              if (typeof cabinData === 'object') {
                const occupancies = Object.keys(cabinData).slice(0, 2); // Show first 2 occupancies
                occupancies.forEach(occ => {
                  const occData = cabinData[occ];
                  console.log(`      Occupancy ${occ}: ${JSON.stringify(occData).substring(0, 150)}`);
                });
              }
            });
          }
        });
      }
    }

    // Look for any nested object that might contain prices
    console.log('\n🔍 Checking for nested price structures:');
    for (const key of topLevelKeys.slice(0, 20)) { // Check first 20 keys
      const value = rawData[key];
      if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        const nestedKeys = Object.keys(value);
        const hasPriceKey = nestedKeys.some(k =>
          k.toLowerCase().includes('price') ||
          k.toLowerCase().includes('cheap') ||
          k.toLowerCase().includes('rate') ||
          k.toLowerCase().includes('fare')
        );
        if (hasPriceKey) {
          console.log(`  ${key} contains price-related nested fields:`);
          nestedKeys.filter(k =>
            k.toLowerCase().includes('price') ||
            k.toLowerCase().includes('cheap') ||
            k.toLowerCase().includes('rate') ||
            k.toLowerCase().includes('fare')
          ).forEach(k => {
            console.log(`    - ${k}: ${JSON.stringify(value[k]).substring(0, 100)}`);
          });
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

examineDisneyRawData();
