#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function checkRoyalCaribbean() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('Connected to production database\n');

    // Check cruise 2143102
    const cruiseResult = await client.query(`
      SELECT
        traveltek_cruise_id,
        cruise_line_id,
        ship_name,
        name,
        sailing_date,
        nights,
        updated_at,
        created_at
      FROM cruises
      WHERE traveltek_cruise_id = '2143102'
    `);

    if (cruiseResult.rows.length > 0) {
      const cruise = cruiseResult.rows[0];
      console.log('🚢 CRUISE 2143102 DETAILS:');
      console.log('========================');
      console.log(`Name: ${cruise.name}`);
      console.log(`Ship: ${cruise.ship_name}`);
      console.log(`Line ID: ${cruise.cruise_line_id} (Royal Caribbean)`);
      console.log(`Sailing Date: ${cruise.sailing_date}`);
      console.log(`Nights: ${cruise.nights}`);
      console.log(`Created: ${cruise.created_at}`);
      console.log(`Last Updated: ${cruise.updated_at}`);

      // Calculate time since update
      const timeDiff = new Date() - new Date(cruise.updated_at);
      const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutesAgo = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const daysAgo = Math.floor(hoursAgo / 24);

      if (daysAgo > 0) {
        console.log(`\n⏱️  Last updated ${daysAgo} days, ${hoursAgo % 24} hours ago`);
      } else {
        console.log(`\n⏱️  Last updated ${hoursAgo} hours, ${minutesAgo} minutes ago`);
      }
    } else {
      console.log('❌ Cruise 2143102 not found in database');
    }

    // Check most recent Royal Caribbean updates
    console.log('\n\n📊 RECENT ROYAL CARIBBEAN (LINE 22) UPDATES:');
    console.log('=========================================');

    const recentUpdates = await client.query(`
      SELECT
        traveltek_cruise_id,
        name,
        sailing_date,
        updated_at
      FROM cruises
      WHERE cruise_line_id = 22
      ORDER BY updated_at DESC
      LIMIT 15
    `);

    for (const row of recentUpdates.rows) {
      const timeDiff = new Date() - new Date(row.updated_at);
      const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutesAgo = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const daysAgo = Math.floor(hoursAgo / 24);

      const timeStr =
        daysAgo > 0 ? `${daysAgo}d ${hoursAgo % 24}h ago` : `${hoursAgo}h ${minutesAgo}m ago`;

      console.log(`\n${row.traveltek_cruise_id}: ${row.name}`);
      console.log(`  Sailing: ${row.sailing_date} | Updated: ${timeStr}`);

      // Highlight if this is our target cruise
      if (row.traveltek_cruise_id === '2143102') {
        console.log(`  ⭐ THIS IS THE CRUISE YOU'RE LOOKING FOR`);
      }
    }

    // Check webhook events for line 22 today
    console.log("\n\n🔄 TODAY'S WEBHOOK EVENTS FOR ROYAL CARIBBEAN:");
    console.log('============================================');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const webhookEvents = await client.query(
      `
      SELECT
        created_at,
        status,
        metadata
      FROM webhook_events
      WHERE (metadata::text LIKE '%"cruise_line_id":22%'
         OR metadata::text LIKE '%"lineId":22%')
         AND created_at >= $1
      ORDER BY created_at DESC
      LIMIT 10
    `,
      [today]
    );

    if (webhookEvents.rows.length > 0) {
      console.log(`Found ${webhookEvents.rows.length} webhook events today:\n`);

      for (const event of webhookEvents.rows) {
        const timeDiff = new Date() - new Date(event.created_at);
        const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutesAgo = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

        console.log(`${hoursAgo}h ${minutesAgo}m ago: ${event.status}`);

        if (event.metadata) {
          const meta =
            typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata;
          const details = [];
          if (meta.file_count) details.push(`Files: ${meta.file_count}`);
          if (meta.cruises_updated) details.push(`Cruises updated: ${meta.cruises_updated}`);
          if (meta.processing_time_ms) details.push(`Time: ${meta.processing_time_ms}ms`);
          if (details.length > 0) {
            console.log(`  ${details.join(' | ')}`);
          }
        }
      }
    } else {
      console.log('No webhook events found for Royal Caribbean today');
    }

    // Check if there are cabin prices in a different table
    console.log('\n\n💰 CHECKING FOR PRICING DATA:');
    console.log('============================');

    // Check if there's a cabin_prices table
    const priceTableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE '%price%'
      OR table_name LIKE '%cabin%'
    `);

    console.log('Price-related tables found:');
    priceTableCheck.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkRoyalCaribbean();
