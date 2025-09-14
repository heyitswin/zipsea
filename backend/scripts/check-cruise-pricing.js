#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function checkCruisePricing() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to PRODUCTION database\n');

    // 1. Check pricing data for cruise 2143102
    console.log('💰 PRICING DATA FOR CRUISE 2143102:');
    console.log('===================================\n');

    // Check main cruises table pricing columns
    const cruisePricing = await client.query(`
      SELECT
        id,
        name,
        ship_name,
        sailing_date,
        cheapest_inside_cabin_price,
        cheapest_ocean_view_cabin_price,
        cheapest_balcony_cabin_price,
        cheapest_suite_cabin_price,
        updated_at
      FROM cruises
      WHERE id = '2143102'
    `);

    if (cruisePricing.rows.length > 0) {
      const cruise = cruisePricing.rows[0];
      console.log('Cruise: ' + cruise.name);
      console.log('Ship: ' + cruise.ship_name);
      console.log('Sailing: ' + cruise.sailing_date);
      console.log('\nPrices in cruises table:');
      console.log('  Inside Cabin: $' + (cruise.cheapest_inside_cabin_price || 'NULL'));
      console.log('  Ocean View: $' + (cruise.cheapest_ocean_view_cabin_price || 'NULL'));
      console.log('  Balcony: $' + (cruise.cheapest_balcony_cabin_price || 'NULL'));
      console.log('  Suite: $' + (cruise.cheapest_suite_cabin_price || 'NULL'));
      console.log('\nLast Updated: ' + cruise.updated_at);
    }

    // 2. Check if there's data in cheapest_pricing table
    console.log('\n\n📊 CHEAPEST_PRICING TABLE DATA:');
    console.log('================================\n');

    const cheapestPricing = await client.query(`
      SELECT
        cruise_id,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        lowest_price,
        updated_at
      FROM cheapest_pricing
      WHERE cruise_id = '2143102'
    `);

    if (cheapestPricing.rows.length > 0) {
      const pricing = cheapestPricing.rows[0];
      console.log('Found in cheapest_pricing table:');
      console.log('  Interior: $' + (pricing.interior_price || 'NULL'));
      console.log('  Ocean View: $' + (pricing.oceanview_price || 'NULL'));
      console.log('  Balcony: $' + (pricing.balcony_price || 'NULL'));
      console.log('  Suite: $' + (pricing.suite_price || 'NULL'));
      console.log('  Lowest Overall: $' + (pricing.lowest_price || 'NULL'));
      console.log('  Updated: ' + pricing.updated_at);
    } else {
      console.log('❌ No data in cheapest_pricing table for this cruise');
    }

    // 3. Check raw_data JSON to see what Traveltek sent
    console.log('\n\n🔍 RAW TRAVELTEK DATA ANALYSIS:');
    console.log('================================\n');

    const rawDataQuery = await client.query(`
      SELECT
        raw_data->'cheapest' as cheapest_obj,
        raw_data->'cheapestinside' as cheapest_inside,
        raw_data->'cheapestoutside' as cheapest_outside,
        raw_data->'cheapestbalcony' as cheapest_balcony,
        raw_data->'cheapestsuite' as cheapest_suite,
        raw_data->'prices' as prices_obj,
        raw_data->'cabins' as cabins_obj
      FROM cruises
      WHERE id = '2143102'
    `);

    if (rawDataQuery.rows.length > 0 && rawDataQuery.rows[0].cheapest_obj) {
      const raw = rawDataQuery.rows[0];

      console.log('Raw data structure from Traveltek:');

      if (raw.cheapest_obj) {
        console.log('\n"cheapest" object exists');
        const cheapest = JSON.parse(raw.cheapest_obj);
        if (cheapest.combined) {
          console.log('  Has "combined" field with pricing');
        }
        if (cheapest.prices) {
          console.log('  Has "prices" field');
        }
      }

      if (raw.cheapest_inside) {
        console.log('\n"cheapestinside" object:');
        console.log(JSON.stringify(JSON.parse(raw.cheapest_inside), null, 2).substring(0, 500));
      }

      if (raw.prices_obj) {
        console.log('\n"prices" object exists');
      }

      if (raw.cabins_obj) {
        console.log('\n"cabins" object exists');
        const cabins = JSON.parse(raw.cabins_obj);
        console.log(`  Total cabin categories: ${Object.keys(cabins).length}`);
      }
    } else {
      console.log('No raw_data field or it\'s empty');
    }

    // 4. Compare with other Royal Caribbean cruises
    console.log('\n\n📈 COMPARISON WITH OTHER ROYAL CARIBBEAN CRUISES:');
    console.log('=================================================\n');

    const comparison = await client.query(`
      SELECT
        id,
        name,
        ship_name,
        sailing_date,
        cheapest_inside_cabin_price,
        cheapest_ocean_view_cabin_price,
        cheapest_balcony_cabin_price,
        cheapest_suite_cabin_price
      FROM cruises
      WHERE cruise_line_id = 22
      AND ship_name = 'Symphony of the Seas'
      AND sailing_date >= '2025-09-01'
      AND sailing_date <= '2025-11-01'
      ORDER BY sailing_date
      LIMIT 10
    `);

    console.log('Other Symphony of the Seas cruises (Sep-Nov 2025):');
    comparison.rows.forEach(cruise => {
      const prices = [];
      if (cruise.cheapest_inside_cabin_price) prices.push(`Inside: $${cruise.cheapest_inside_cabin_price}`);
      if (cruise.cheapest_ocean_view_cabin_price) prices.push(`Ocean: $${cruise.cheapest_ocean_view_cabin_price}`);
      if (cruise.cheapest_balcony_cabin_price) prices.push(`Balcony: $${cruise.cheapest_balcony_cabin_price}`);
      if (cruise.cheapest_suite_cabin_price) prices.push(`Suite: $${cruise.cheapest_suite_cabin_price}`);

      console.log(`\n${cruise.sailing_date} - ${cruise.name} (ID: ${cruise.id})`);
      if (prices.length > 0) {
        console.log(`  ${prices.join(', ')}`);
      } else {
        console.log('  NO PRICING DATA');
      }

      if (cruise.id === '2143102') {
        console.log('  ⭐ THIS IS THE CRUISE IN QUESTION');
      }
    });

    // 5. Check when pricing was last synced
    console.log('\n\n⏰ LAST SYNC INFORMATION:');
    console.log('========================\n');

    const lastSync = await client.query(`
      SELECT
        MAX(we.timestamp) as last_webhook,
        we.metadata
      FROM webhook_events we
      WHERE we.metadata::text LIKE '%"cruise_line_id":22%'
        OR we.metadata::text LIKE '%"lineId":22%'
      GROUP BY we.metadata
      ORDER BY MAX(we.timestamp) DESC
      LIMIT 1
    `);

    if (lastSync.rows.length > 0) {
      const syncInfo = lastSync.rows[0];
      console.log('Last Royal Caribbean webhook sync:');
      console.log('  Timestamp: ' + syncInfo.last_webhook);

      const timeDiff = new Date() - new Date(syncInfo.last_webhook);
      const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
      const daysAgo = Math.floor(hoursAgo / 24);

      if (daysAgo > 0) {
        console.log(`  ${daysAgo} days, ${hoursAgo % 24} hours ago`);
      } else {
        console.log(`  ${hoursAgo} hours ago`);
      }

      if (syncInfo.metadata) {
        const meta = typeof syncInfo.metadata === 'string' ?
          JSON.parse(syncInfo.metadata) : syncInfo.metadata;
        if (meta.cruises_updated) {
          console.log(`  Cruises updated: ${meta.cruises_updated}`);
        }
      }
    } else {
      console.log('No recent webhook sync found for Royal Caribbean');
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
  } finally {
    await client.end();
  }
}

checkCruisePricing();
