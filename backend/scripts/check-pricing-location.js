#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function checkPricingLocation() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to PRODUCTION database\n');

    // 1. List all tables that might contain pricing
    console.log('📊 TABLES THAT MIGHT CONTAIN PRICING:');
    console.log('=====================================\n');

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (
        table_name LIKE '%price%'
        OR table_name LIKE '%pricing%'
        OR table_name LIKE '%cabin%'
        OR table_name = 'cruises'
      )
      ORDER BY table_name
    `);

    console.log('Found tables:');
    tables.rows.forEach(row => console.log('  - ' + row.table_name));

    // 2. Check columns in cruises table
    console.log('\n\n📋 COLUMNS IN CRUISES TABLE:');
    console.log('============================\n');

    const cruiseColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'cruises'
      ORDER BY ordinal_position
    `);

    console.log('All columns:');
    cruiseColumns.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });

    // 3. Check if cheapest_pricing table exists and has data
    console.log('\n\n💰 CHEAPEST_PRICING TABLE:');
    console.log('=========================\n');

    const cheapestExists = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_name = 'cheapest_pricing'
    `);

    if (cheapestExists.rows[0].count > 0) {
      console.log('✅ cheapest_pricing table exists');

      // Check columns
      const cheapestColumns = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'cheapest_pricing'
        ORDER BY ordinal_position
      `);

      console.log('\nColumns:');
      cheapestColumns.rows.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type}`);
      });

      // Check if it has data for cruise 2143102
      const cheapestData = await client.query(`
        SELECT * FROM cheapest_pricing WHERE cruise_id = '2143102'
      `);

      if (cheapestData.rows.length > 0) {
        console.log('\n✅ Found pricing data for cruise 2143102:');
        console.log(JSON.stringify(cheapestData.rows[0], null, 2));
      } else {
        console.log('\n❌ No data for cruise 2143102 in cheapest_pricing table');
      }
    } else {
      console.log('❌ cheapest_pricing table does not exist');
    }

    // 4. Check basic cruise data
    console.log('\n\n🚢 CRUISE 2143102 BASIC DATA:');
    console.log('============================\n');

    const cruiseData = await client.query(`
      SELECT * FROM cruises WHERE id = '2143102'
    `);

    if (cruiseData.rows.length > 0) {
      const cruise = cruiseData.rows[0];
      console.log('Key fields:');
      console.log(`  ID: ${cruise.id}`);
      console.log(`  Name: ${cruise.name}`);
      console.log(`  Ship: ${cruise.ship_name || cruise.ship_id}`);
      console.log(`  Sailing Date: ${cruise.sailing_date}`);
      console.log(`  Updated: ${cruise.updated_at}`);

      // Check if there's a raw_data field
      if (cruise.raw_data) {
        console.log('\n✅ Has raw_data field');

        // Check what's in the raw data
        const rawData = cruise.raw_data;
        if (rawData.cheapest) {
          console.log('  Has "cheapest" object in raw data');
        }
        if (rawData.prices) {
          console.log('  Has "prices" object in raw data');
        }
        if (rawData.cabins) {
          console.log('  Has "cabins" object in raw data');
          console.log(`    Number of cabin categories: ${Object.keys(rawData.cabins).length}`);
        }

        // Look for pricing fields
        const pricingFields = [
          'cheapestinside', 'cheapestoutside', 'cheapestbalcony', 'cheapestsuite',
          'cheapestinsideprice', 'cheapestoutsideprice', 'cheapestbalconyprice', 'cheapestsuiteprice'
        ];

        console.log('\n  Pricing fields in raw data:');
        pricingFields.forEach(field => {
          if (rawData[field]) {
            console.log(`    ${field}: exists`);
          }
        });
      } else {
        console.log('\n❌ No raw_data field');
      }
    }

    // 5. Search for any Symphony of the Seas pricing
    console.log('\n\n📈 SYMPHONY OF THE SEAS PRICING COMPARISON:');
    console.log('==========================================\n');

    // Check if any Symphony cruises have pricing in cheapest_pricing
    const symphonyPricing = await client.query(`
      SELECT
        c.id,
        c.name,
        c.sailing_date,
        cp.interior_price,
        cp.oceanview_price,
        cp.balcony_price,
        cp.suite_price,
        cp.lowest_price
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.cruise_line_id = 22
      AND c.ship_name = 'Symphony of the Seas'
      AND c.sailing_date >= '2025-09-01'
      AND c.sailing_date <= '2025-11-01'
      ORDER BY c.sailing_date
      LIMIT 10
    `);

    console.log('Symphony of the Seas cruises (Sep-Nov 2025):');
    symphonyPricing.rows.forEach(cruise => {
      const hasPricing = cruise.interior_price || cruise.oceanview_price ||
                        cruise.balcony_price || cruise.suite_price;

      console.log(`\n${cruise.sailing_date} - ${cruise.name} (ID: ${cruise.id})`);
      if (hasPricing) {
        console.log(`  Interior: $${cruise.interior_price || 'N/A'}`);
        console.log(`  Ocean View: $${cruise.oceanview_price || 'N/A'}`);
        console.log(`  Balcony: $${cruise.balcony_price || 'N/A'}`);
        console.log(`  Suite: $${cruise.suite_price || 'N/A'}`);
        console.log(`  Lowest: $${cruise.lowest_price || 'N/A'}`);
      } else {
        console.log('  ❌ NO PRICING DATA');
      }

      if (cruise.id === '2143102') {
        console.log('  ⭐ THIS IS THE CRUISE IN QUESTION');
      }
    });

  } catch (error) {
    console.error('Error:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
  } finally {
    await client.end();
  }
}

checkPricingLocation();
