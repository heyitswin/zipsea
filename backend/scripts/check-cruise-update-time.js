#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function checkCruiseUpdate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('Connected to production database\n');

    // Check cruise 2143102 specifically
    const cruiseResult = await client.query(`
      SELECT
        traveltek_cruise_id,
        cruise_line_id,
        ship_name,
        name,
        updated_at,
        created_at,
        CASE
          WHEN cabin_pricing IS NOT NULL THEN 'Has cabin_pricing'
          ELSE 'No cabin_pricing'
        END as cabin_pricing_status,
        CASE
          WHEN cabin_pricing IS NOT NULL THEN
            jsonb_array_length(cabin_pricing)
          ELSE 0
        END as cabin_count,
        cheapest_inside_cabin_price,
        cheapest_ocean_view_cabin_price,
        cheapest_balcony_cabin_price,
        cheapest_suite_cabin_price
      FROM cruises
      WHERE traveltek_cruise_id = 2143102
    `);

    if (cruiseResult.rows.length > 0) {
      const cruise = cruiseResult.rows[0];
      console.log('🚢 Cruise 2143102 Details:');
      console.log('========================');
      console.log(`Name: ${cruise.name}`);
      console.log(`Ship: ${cruise.ship_name}`);
      console.log(`Line ID: ${cruise.cruise_line_id}`);
      console.log(`Cabin Pricing: ${cruise.cabin_pricing_status} (${cruise.cabin_count} cabins)`);
      console.log(`\nCheapest Prices:`);
      console.log(`  Inside: $${cruise.cheapest_inside_cabin_price || 'N/A'}`);
      console.log(`  Ocean View: $${cruise.cheapest_ocean_view_cabin_price || 'N/A'}`);
      console.log(`  Balcony: $${cruise.cheapest_balcony_cabin_price || 'N/A'}`);
      console.log(`  Suite: $${cruise.cheapest_suite_cabin_price || 'N/A'}`);
      console.log(`\nLast Updated: ${cruise.updated_at}`);
      console.log(`Created: ${cruise.created_at}`);
    } else {
      console.log('❌ Cruise 2143102 not found');
    }

    // Check recent updates for line 22
    console.log('\n\n📊 Recent Royal Caribbean (Line 22) Updates:');
    console.log('=========================================');

    const recentUpdates = await client.query(`
      SELECT
        traveltek_cruise_id,
        name,
        updated_at,
        CASE
          WHEN cabin_pricing IS NOT NULL THEN
            jsonb_array_length(cabin_pricing)
          ELSE 0
        END as cabin_count
      FROM cruises
      WHERE cruise_line_id = 22
      ORDER BY updated_at DESC
      LIMIT 10
    `);

    for (const row of recentUpdates.rows) {
      const timeDiff = new Date() - new Date(row.updated_at);
      const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutesAgo = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

      console.log(`\nCruise ${row.traveltek_cruise_id}: ${row.name}`);
      console.log(`  Updated: ${hoursAgo}h ${minutesAgo}m ago (${row.updated_at})`);
      console.log(`  Cabins: ${row.cabin_count}`);
    }

    // Check webhook events for line 22
    console.log('\n\n🔄 Recent Webhook Events for Line 22:');
    console.log('=====================================');

    const webhookEvents = await client.query(`
      SELECT
        created_at,
        status,
        metadata
      FROM webhook_events
      WHERE metadata::text LIKE '%"cruise_line_id":22%'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    for (const event of webhookEvents.rows) {
      const timeDiff = new Date() - new Date(event.created_at);
      const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutesAgo = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

      console.log(`\n${hoursAgo}h ${minutesAgo}m ago: ${event.status}`);
      if (event.metadata) {
        const meta =
          typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata;
        console.log(
          `  Files: ${meta.file_count || 0}, Processing: ${meta.processing_time_ms || 0}ms`
        );
      }
    }

    // Check if there's a sample cabin pricing to verify structure
    if (cruiseResult.rows.length > 0 && cruiseResult.rows[0].cabin_count > 0) {
      console.log('\n\n🔍 Sample Cabin Pricing Structure:');
      console.log('==================================');

      const sampleCabin = await client.query(`
        SELECT
          (cabin_pricing->0) as first_cabin
        FROM cruises
        WHERE traveltek_cruise_id = 2143102
      `);

      if (sampleCabin.rows.length > 0 && sampleCabin.rows[0].first_cabin) {
        console.log(JSON.stringify(sampleCabin.rows[0].first_cabin, null, 2));
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkCruiseUpdate();
