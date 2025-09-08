const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function finalStatusCheck() {
  console.log('=== FINAL STATUS CHECK ===\n');
  console.log('Date: ' + new Date().toISOString());
  console.log('----------------------------\n');

  try {
    // Check overall data coverage
    const coverageResult = await pool.query(`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN raw_data IS NOT NULL AND raw_data::text != '{}' THEN 1 END) as with_raw_data,
        COUNT(ship_name) as with_ship_name,
        COUNT(voyage_code) as with_voyage_code,
        COUNT(nights) as with_nights,
        COUNT(embarkation_port_id) as with_embark_port,
        COUNT(disembarkation_port_id) as with_disembark_port
      FROM cruises
      WHERE is_active = true
    `);

    const stats = coverageResult.rows[0];
    const total = parseInt(stats.total_cruises);

    console.log('DATA COVERAGE:');
    console.log(`Total active cruises: ${total.toLocaleString()}`);
    console.log(`With raw_data: ${stats.with_raw_data.toLocaleString()} (${(stats.with_raw_data/total*100).toFixed(1)}%)`);
    console.log(`With ship_name: ${stats.with_ship_name.toLocaleString()} (${(stats.with_ship_name/total*100).toFixed(1)}%)`);
    console.log(`With voyage_code: ${stats.with_voyage_code.toLocaleString()} (${(stats.with_voyage_code/total*100).toFixed(1)}%)`);
    console.log(`With nights: ${stats.with_nights.toLocaleString()} (${(stats.with_nights/total*100).toFixed(1)}%)`);
    console.log(`With embark port: ${stats.with_embark_port.toLocaleString()} (${(stats.with_embark_port/total*100).toFixed(1)}%)`);
    console.log(`With disembark port: ${stats.with_disembark_port.toLocaleString()} (${(stats.with_disembark_port/total*100).toFixed(1)}%)\n`);

    // Check pricing data
    const pricingResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN cheapest_price IS NOT NULL THEN 1 END) as with_cheapest_price,
        COUNT(CASE WHEN interior_price IS NOT NULL THEN 1 END) as with_interior,
        COUNT(CASE WHEN oceanview_price IS NOT NULL THEN 1 END) as with_oceanview,
        COUNT(CASE WHEN balcony_price IS NOT NULL THEN 1 END) as with_balcony,
        COUNT(CASE WHEN suite_price IS NOT NULL THEN 1 END) as with_suite
      FROM cruises
      WHERE is_active = true
    `);

    const pricing = pricingResult.rows[0];
    console.log('PRICING DATA:');
    console.log(`With cheapest price: ${pricing.with_cheapest_price.toLocaleString()} (${(pricing.with_cheapest_price/total*100).toFixed(1)}%)`);
    console.log(`With interior price: ${pricing.with_interior.toLocaleString()} (${(pricing.with_interior/total*100).toFixed(1)}%)`);
    console.log(`With oceanview price: ${pricing.with_oceanview.toLocaleString()} (${(pricing.with_oceanview/total*100).toFixed(1)}%)`);
    console.log(`With balcony price: ${pricing.with_balcony.toLocaleString()} (${(pricing.with_balcony/total*100).toFixed(1)}%)`);
    console.log(`With suite price: ${pricing.with_suite.toLocaleString()} (${(pricing.with_suite/total*100).toFixed(1)}%)\n`);

    // Check cheapest_pricing table
    const cheapestPricingResult = await pool.query(`
      SELECT COUNT(*) as count FROM cheapest_pricing
    `);
    console.log(`Records in cheapest_pricing table: ${cheapestPricingResult.rows[0].count.toLocaleString()}\n`);

    // Recommendations
    console.log('RECOMMENDATIONS:');

    if (stats.with_ship_name < total * 0.9) {
      console.log('⚠️  Ship names need extraction - run: node scripts/update-fields-incremental.js');
    } else {
      console.log('✅ Ship names extracted successfully');
    }

    if (stats.with_voyage_code < total * 0.9) {
      console.log('⚠️  Voyage codes need extraction');
    } else {
      console.log('✅ Voyage codes extracted successfully');
    }

    if (pricing.with_cheapest_price < total * 0.7) {
      console.log('⚠️  Pricing data needs update - run webhook sync');
    } else {
      console.log('✅ Pricing data is reasonably complete');
    }

    console.log('\nNEXT STEPS:');
    console.log('1. If fields are missing, run: node scripts/update-fields-incremental.js');
    console.log('2. Create indexes for search performance');
    console.log('3. Fix webhook service to properly sync pricing data');
    console.log('4. Consider creating normalized tables for ports and regions');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

finalStatusCheck();
