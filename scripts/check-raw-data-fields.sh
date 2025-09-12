#!/bin/bash

echo "=== Checking raw_data fields for cabin and pricing info ==="

# Use production database to check a sample cruise
DATABASE_URL="$DATABASE_URL_PRODUCTION" node << 'EOF'
const { Client } = require('pg');

async function checkRawData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();

    // Get a sample cruise with raw_data
    const result = await client.query(`
      SELECT
        c.id,
        c.name,
        c.raw_data,
        cp.interior_price_code,
        cp.oceanview_price_code,
        cp.balcony_price_code,
        cp.suite_price_code
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.raw_data IS NOT NULL
      AND c.id = '2143102'
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      const cruise = result.rows[0];
      console.log('Cruise ID:', cruise.id);
      console.log('Cruise Name:', cruise.name);
      console.log('\nPrice codes from cheapest_pricing:');
      console.log('  Interior code:', cruise.interior_price_code || 'NULL');
      console.log('  Oceanview code:', cruise.oceanview_price_code || 'NULL');
      console.log('  Balcony code:', cruise.balcony_price_code || 'NULL');
      console.log('  Suite code:', cruise.suite_price_code || 'NULL');

      if (cruise.raw_data) {
        const raw = cruise.raw_data;
        console.log('\nChecking raw_data structure:');
        console.log('  Has prices field:', raw.prices ? 'YES' : 'NO');
        console.log('  Has cabins field:', raw.cabins ? 'YES' : 'NO');
        console.log('  Has cheapestinside:', raw.cheapestinside ? 'YES' : 'NO');
        console.log('  Has cheapestinsidepricecode:', raw.cheapestinsidepricecode ? 'YES' : 'NO');

        if (raw.prices && raw.cheapestinsidepricecode) {
          console.log('\nSample price structure:');
          const priceCode = raw.cheapestinsidepricecode;
          console.log('  Price code:', priceCode);

          // Parse the price code (format: RATECODE|CABIN|OCC)
          const [rateCode, cabinCode, occCode] = priceCode.split('|');
          console.log('  Rate code:', rateCode);
          console.log('  Cabin code:', cabinCode);
          console.log('  Occupancy code:', occCode);
        }

        if (raw.cabins) {
          console.log('\nSample cabin data:');
          const cabinKeys = Object.keys(raw.cabins).slice(0, 3);
          cabinKeys.forEach(key => {
            const cabin = raw.cabins[key];
            console.log(`  Cabin ${key}:`, {
              name: cabin.name,
              hasImage: !!cabin.imageurlhd,
              hasDescription: !!cabin.description
            });
          });
        }
      }
    } else {
      console.log('No cruise found with raw_data');
    }

    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    await client.end();
  }
}

checkRawData();
EOF
