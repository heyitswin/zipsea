#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function checkCruise() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('Connected to production database\n');

    // First, let's see what columns exist
    const columnsResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'cruises'
      AND column_name IN (
        'traveltek_cruise_id', 'cruise_line_id', 'ship_name', 'name',
        'updated_at', 'created_at', 'sailing_date', 'nights',
        'destination_region', 'cheapest_inside_cabin_price',
        'cheapest_ocean_view_cabin_price', 'cheapest_balcony_cabin_price',
        'cheapest_suite_cabin_price'
      )
      ORDER BY ordinal_position
    `);

    console.log('Available columns in cruises table:');
    console.log('===================================');
    columnsResult.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });

    // Check cruise 2143102 with available columns
    const cruiseResult = await client.query(`
      SELECT
        traveltek_cruise_id,
        cruise_line_id,
        ship_name,
        name,
        updated_at,
        created_at,
        sailing_date,
        nights,
        destination_region,
        cheapest_inside_cabin_price,
        cheapest_ocean_view_cabin_price,
        cheapest_balcony_cabin_price,
        cheapest_suite_cabin_price
      FROM cruises
      WHERE traveltek_cruise_id = 2143102
    `);

    if (cruiseResult.rows.length > 0) {
      const cruise = cruiseResult.rows[0];
      console.log('\n\n🚢 Cruise 2143102 Details:');
      console.log('========================');
      console.log(`Name: ${cruise.name}`);
      console.log(`Ship: ${cruise.ship_name}`);
      console.log(`Line ID: ${cruise.cruise_line_id} (Royal Caribbean)`);
      console.log(`Sailing Date: ${cruise.sailing_date}`);
      console.log(`Nights: ${cruise.nights}`);
      console.log(`Region: ${cruise.destination_region}`);
      console.log(`\nCheapest Prices:`);
      console.log(`  Inside: $${cruise.cheapest_inside_cabin_price || 'N/A'}`);
      console.log(`  Ocean View: $${cruise.cheapest_ocean_view_cabin_price || 'N/A'}`);
      console.log(`  Balcony: $${cruise.cheapest_balcony_cabin_price || 'N/A'}`);
      console.log(`  Suite: $${cruise.cheapest_suite_cabin_price || 'N/A'}`);
      console.log(`\nTimestamps:`);
      console.log(`  Created: ${cruise.created_at}`);
      console.log(`  Last Updated: ${cruise.updated_at}`);

      // Calculate time since update
      const timeDiff = new Date() - new Date(cruise.updated_at);
      const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutesAgo = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const daysAgo = Math.floor(hoursAgo / 24);

      if (daysAgo > 0) {
        console.log(`\n⏱️  Updated ${daysAgo} days, ${hoursAgo % 24} hours ago`);
      } else {
        console.log(`\n⏱️  Updated ${hoursAgo} hours, ${minutesAgo} minutes ago`);
      }
    } else {
      console.log('\n❌ Cruise 2143102 not found in database');
    }

    // Check recent updates for line 22
    console.log('\n\n📊 Recent Royal Caribbean (Line 22) Updates:');
    console.log('=========================================');

    const recentUpdates = await client.query(`
      SELECT
        traveltek_cruise_id,
        name,
        sailing_date,
        updated_at,
        cheapest_inside_cabin_price,
        cheapest_ocean_view_cabin_price,
        cheapest_balcony_cabin_price,
        cheapest_suite_cabin_price
      FROM cruises
      WHERE cruise_line_id = 22
      ORDER BY updated_at DESC
      LIMIT 10
    `);

    for (const row of recentUpdates.rows) {
      const timeDiff = new Date() - new Date(row.updated_at);
      const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutesAgo = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const daysAgo = Math.floor(hoursAgo / 24);

      console.log(`\nCruise ${row.traveltek_cruise_id}: ${row.name}`);
      if (daysAgo > 0) {
        console.log(`  Updated: ${daysAgo}d ${hoursAgo % 24}h ago`);
      } else {
        console.log(`  Updated: ${hoursAgo}h ${minutesAgo}m ago`);
      }
      console.log(`  Sailing: ${row.sailing_date}`);

      const prices = [];
      if (row.cheapest_inside_cabin_price)
        prices.push(`Inside: $${row.cheapest_inside_cabin_price}`);
      if (row.cheapest_ocean_view_cabin_price)
        prices.push(`Ocean: $${row.cheapest_ocean_view_cabin_price}`);
      if (row.cheapest_balcony_cabin_price)
        prices.push(`Balcony: $${row.cheapest_balcony_cabin_price}`);
      if (row.cheapest_suite_cabin_price) prices.push(`Suite: $${row.cheapest_suite_cabin_price}`);

      if (prices.length > 0) {
        console.log(`  Prices: ${prices.join(', ')}`);
      } else {
        console.log(`  Prices: No pricing data`);
      }
    }

    // Check webhook sync events for line 22
    console.log('\n\n🔄 Recent Webhook Events for Line 22:');
    console.log('=====================================');

    const webhookEvents = await client.query(`
      SELECT
        created_at,
        status,
        metadata
      FROM webhook_events
      WHERE metadata::text LIKE '%"cruise_line_id":22%'
         OR metadata::text LIKE '%"lineId":22%'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (webhookEvents.rows.length > 0) {
      for (const event of webhookEvents.rows) {
        const timeDiff = new Date() - new Date(event.created_at);
        const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutesAgo = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const daysAgo = Math.floor(hoursAgo / 24);

        if (daysAgo > 0) {
          console.log(`\n${daysAgo}d ${hoursAgo % 24}h ago: ${event.status}`);
        } else {
          console.log(`\n${hoursAgo}h ${minutesAgo}m ago: ${event.status}`);
        }

        if (event.metadata) {
          const meta =
            typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata;
          if (meta.file_count) console.log(`  Files processed: ${meta.file_count}`);
          if (meta.processing_time_ms)
            console.log(`  Processing time: ${meta.processing_time_ms}ms`);
          if (meta.cruises_updated) console.log(`  Cruises updated: ${meta.cruises_updated}`);
        }
      }
    } else {
      console.log('No recent webhook events found for Royal Caribbean');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkCruise();
