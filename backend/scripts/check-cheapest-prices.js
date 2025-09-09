const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false
});

async function checkCheapestPrices() {
  try {
    await client.connect();
    console.log('Connected to database\n');

    // 1. Check table structure
    console.log('=== CHEAPEST_PRICES TABLE STRUCTURE ===\n');

    const structureQuery = `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'cheapest_prices'
      ORDER BY ordinal_position
    `;

    const structure = await client.query(structureQuery);

    console.log('Columns:');
    structure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // 2. Check if table is really empty
    console.log('\n=== TABLE STATUS ===\n');

    const countQuery = `SELECT COUNT(*) as count FROM cheapest_prices`;
    const count = await client.query(countQuery);
    console.log(`Total records: ${count.rows[0].count}`);

    // 3. Check what pricing data we have in the cruises table
    console.log('\n=== CRUISES TABLE PRICING DATA ===\n');

    const cruisePricingQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN interior_price IS NOT NULL OR oceanview_price IS NOT NULL
                   OR balcony_price IS NOT NULL OR suite_price IS NOT NULL THEN 1 END) as has_any_price,
        COUNT(CASE WHEN interior_price IS NOT NULL THEN 1 END) as has_interior,
        COUNT(CASE WHEN oceanview_price IS NOT NULL THEN 1 END) as has_oceanview,
        COUNT(CASE WHEN balcony_price IS NOT NULL THEN 1 END) as has_balcony,
        COUNT(CASE WHEN suite_price IS NOT NULL THEN 1 END) as has_suite
      FROM cruises
    `;

    const cruisePricing = await client.query(cruisePricingQuery);
    const cp = cruisePricing.rows[0];

    console.log(`Total cruises: ${cp.total}`);
    console.log(`Cruises with any price: ${cp.has_any_price}`);
    console.log(`Has interior price: ${cp.has_interior}`);
    console.log(`Has oceanview price: ${cp.has_oceanview}`);
    console.log(`Has balcony price: ${cp.has_balcony}`);
    console.log(`Has suite price: ${cp.has_suite}`);

    // 4. Check if we should populate cheapest_prices from cruises table
    if (count.rows[0].count === '0' && cp.has_any_price > 0) {
      console.log('\n=== RECOMMENDATION ===\n');
      console.log('The cheapest_prices table is empty but cruises table has pricing data.');
      console.log('The prices in the cruises table appear to already be the cheapest prices');
      console.log('(interior_price, oceanview_price, balcony_price, suite_price).');
      console.log('\nThese prices were likely extracted from the JSON data\'s "cheapest" object.');

      // Sample the data
      console.log('\n=== SAMPLE CRUISE PRICES ===\n');

      const sampleQuery = `
        SELECT
          id,
          name,
          interior_price,
          oceanview_price,
          balcony_price,
          suite_price
        FROM cruises
        WHERE interior_price IS NOT NULL
           OR oceanview_price IS NOT NULL
           OR balcony_price IS NOT NULL
           OR suite_price IS NOT NULL
        LIMIT 5
      `;

      const samples = await client.query(sampleQuery);

      samples.rows.forEach((row, i) => {
        console.log(`${i + 1}. Cruise ${row.id}: ${row.name}`);
        console.log(`   Interior: ${row.interior_price ? '$' + row.interior_price : 'N/A'}`);
        console.log(`   Oceanview: ${row.oceanview_price ? '$' + row.oceanview_price : 'N/A'}`);
        console.log(`   Balcony: ${row.balcony_price ? '$' + row.balcony_price : 'N/A'}`);
        console.log(`   Suite: ${row.suite_price ? '$' + row.suite_price : 'N/A'}`);
      });

      console.log('\n💡 The cheapest_prices table may be redundant since the cruises table');
      console.log('   already contains the cheapest prices for each cabin category.');
    }

    // 5. Check other pricing tables
    console.log('\n=== OTHER PRICING TABLES ===\n');

    const pricingTables = ['static_prices', 'cached_prices', 'detailed_pricing', 'pricing'];

    for (const table of pricingTables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`${table}: ${result.rows[0].count} records`);
      } catch (err) {
        console.log(`${table}: Error or doesn't exist`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkCheapestPrices();
