#!/usr/bin/env node

/**
 * Verify Enhanced Schema
 * Checks if the enhanced schema with complete data preservation exists
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function verifySchema() {
  const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();

    // Check for key enhanced schema features
    const checkQuery = `
      SELECT
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'cruises'
      AND column_name IN (
        'raw_data',
        'cheapest_pricing',
        'cached_prices',
        'prices_data',
        'itinerary_data',
        'cabins_data',
        'ports_data',
        'regions_data',
        'alt_sailings',
        'fly_cruise_info',
        'cheapest_inside',
        'cheapest_outside',
        'cheapest_balcony',
        'cheapest_suite',
        'cheapest_inside_price_code',
        'cheapest_outside_price_code',
        'cheapest_balcony_price_code',
        'cheapest_suite_price_code'
      )
      ORDER BY column_name
    `;

    const result = await client.query(checkQuery);

    // Check if we have the enhanced columns
    const hasRawData = result.rows.some(
      r => r.column_name === 'raw_data' && r.data_type === 'jsonb'
    );
    const hasCheapestPricing = result.rows.some(r => r.column_name === 'cheapest_pricing');
    const hasPriceCodes = result.rows.some(r => r.column_name === 'cheapest_inside_price_code');

    if (hasRawData && hasCheapestPricing && hasPriceCodes) {
      console.log('✅ Enhanced schema exists with complete data preservation');
      process.exit(0);
    } else {
      console.log('❌ Enhanced schema not found or incomplete');
      console.log('   Missing key features for complete data preservation');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error checking schema:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifySchema().catch(console.error);
