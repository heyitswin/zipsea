#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function checkColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to production database\n');

    // Check cruise 2143102 with actual columns
    const cruiseResult = await client.query(`
      SELECT
        traveltek_cruise_id,
        cruise_line_id,
        ship_name,
        name,
        updated_at,
        created_at,
        departure_date,
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
      console.log('🚢 Cruise 2143102 Details:');
      console.log('========================');
      console.log(`Name: ${cruise.name}`);
      console.log(`Ship: ${cruise.ship_name}`);
      console.log(`Line ID: ${cruise.cruise_line_id}`);
      console.log(`Departure: ${cruise.departure_date}`);
      console.log(`Nights: ${cruise.nights}`);
      console.log(`Region: ${cruise.destination_region}`);
      console.log(`\nCheapest Prices:`);
      console.log(`  Inside: $${cruise.cheapest_inside_cabin_price || 'N/A'}`);
      console.log(`  Ocean View: $${cruise.cheapest_ocean_view_cabin_price || 'N/A'}`);
      console.log(`  Balcony: $${cruise.cheapest_balcony_cabin_price || 'N/A'}`);
      console.log(`  Suite: $${cruise.cheapest_suite_cabin_price || 'N/A'}`);
      console.log(`\nLast Updated: ${cruise.updated_at}`);
      console.log(`Created: ${cruise.created_at}`);

      // Calculate time since update
      const timeDiff = new Date() - new Date(cruise.updated_at);
      const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutesAgo = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      console.log(`\n⏱️  Updated ${hoursAgo} hours ${minutesAgo} minutes ago`);
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

      console.log(`\nCruise ${row.traveltek_cruise_id}: ${row.name}`);
      console.log(`  Updated: ${hoursAgo}h ${minutesAgo}m ago (${row.updated_at})`);
      const prices = [];
      if (row.cheapest_inside_cabin_price) prices.push(`Inside: $${row.cheapest_inside_cabin_price}`);
      if (row.cheapest_ocean_view_cabin_price) prices.push(`Ocean: $${row.cheapest_ocean_view_cabin_price}`);
      if (row.cheapest_balcony_cabin_price) prices.push(`Balcony: $${row.cheapest_balcony_cabin_price}`);
      if (row.cheapest_suite_cabin_price) prices.push(`Suite: $${row.cheapest_suite_cabin_price}`);
      if (prices.length > 0) {
        console.log(`  Prices: ${prices.join(', ')}`);
      } else {
        console.log(`  Prices: No pricing data`);
      }
    }

    // Check pricing snapshots for this cruise
    console.log('\n\n📈 Price Snapshots for Cruise 2143102:');
    console.log('=====================================');

    const snapshots = await client.query(`
      SELECT
        snapshot_date,
        inside_price,
        ocean_view_price,
        balcony_price,
        suite_price
      FROM price_snapshots
      WHERE cruise_id IN (
        SELECT id FROM cruises WHERE traveltek_cruise_id = 2143102
      )
      ORDER BY snapshot_date DESC
      LIMIT 5
    `);

    if (snapshots.rows.length > 0) {
      for (const snap of snapshots.rows) {
        const timeDiff = new Date() - new Date(snap.snapshot_date);
        const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutesAgo = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

        console.log(`\n${hoursAgo}h ${minutesAgo}m ago (${snap.snapshot_date}):`);
        console.log(`  Inside: $${snap.inside_price || 'N/A'}, Ocean: $${snap.ocean_view_price || 'N/A'}`);
        console.log(`  Balcony: $${snap.balcony_price || 'N/A'}, Suite: $${snap.suite_price || 'N/A'}`);
      }
    } else {
      console.log('No price snapshots found for this cruise');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkColumns();
