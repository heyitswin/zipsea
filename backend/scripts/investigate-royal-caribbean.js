#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function investigate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to production database\n');

    // 1. Check if ANY Royal Caribbean cruises have traveltek_cruise_id
    console.log('🔍 CHECKING ROYAL CARIBBEAN DATA QUALITY:');
    console.log('=========================================\n');

    const dataCheck = await client.query(`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(traveltek_cruise_id) as cruises_with_id,
        COUNT(CASE WHEN traveltek_cruise_id IS NULL THEN 1 END) as cruises_without_id,
        MIN(created_at) as first_cruise_added,
        MAX(created_at) as last_cruise_added,
        MIN(updated_at) as oldest_update,
        MAX(updated_at) as newest_update
      FROM cruises
      WHERE cruise_line_id = 22
    `);

    const stats = dataCheck.rows[0];
    console.log(`Total Royal Caribbean cruises: ${stats.total_cruises}`);
    console.log(`Cruises WITH traveltek_cruise_id: ${stats.cruises_with_id}`);
    console.log(`Cruises WITHOUT traveltek_cruise_id: ${stats.cruises_without_id}`);
    console.log(`First cruise added: ${stats.first_cruise_added}`);
    console.log(`Last cruise added: ${stats.last_cruise_added}`);
    console.log(`Oldest update: ${stats.oldest_update}`);
    console.log(`Newest update: ${stats.newest_update}`);

    // 2. Sample some Royal Caribbean cruises to see what IDs they have
    console.log('\n\n📋 SAMPLE OF ROYAL CARIBBEAN CRUISES:');
    console.log('=====================================\n');

    const samples = await client.query(`
      SELECT
        id,
        traveltek_cruise_id,
        name,
        ship_name,
        sailing_date,
        created_at,
        updated_at
      FROM cruises
      WHERE cruise_line_id = 22
      ORDER BY updated_at DESC
      LIMIT 5
    `);

    for (const cruise of samples.rows) {
      console.log(`Internal ID: ${cruise.id}`);
      console.log(`  Traveltek ID: ${cruise.traveltek_cruise_id || 'NULL'}`);
      console.log(`  Name: ${cruise.name}`);
      console.log(`  Ship: ${cruise.ship_name}`);
      console.log(`  Sailing: ${cruise.sailing_date}`);
      console.log(`  Updated: ${cruise.updated_at}`);
      console.log('');
    }

    // 3. Check if there's data in Traveltek ID format (as string)
    console.log('\n🔎 SEARCHING FOR CRUISE 2143102 IN VARIOUS FORMATS:');
    console.log('==================================================\n');

    // Try different search patterns
    const searchPatterns = [
      { query: "traveltek_cruise_id = '2143102'", desc: "Exact string match" },
      { query: "traveltek_cruise_id LIKE '%2143102%'", desc: "Contains 2143102" },
      { query: "name LIKE '%2143102%'", desc: "ID in name field" },
      { query: "id = 2143102", desc: "Internal ID match" }
    ];

    for (const pattern of searchPatterns) {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM cruises
        WHERE ${pattern.query}
      `);
      console.log(`${pattern.desc}: ${result.rows[0].count} matches`);
    }

    // 4. Check webhook_events table structure
    console.log('\n\n📊 WEBHOOK_EVENTS TABLE STRUCTURE:');
    console.log('==================================\n');

    const webhookColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'webhook_events'
      ORDER BY ordinal_position
    `);

    console.log('Columns in webhook_events:');
    webhookColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // 5. Check recent webhook events (using correct column names)
    console.log('\n\n🔄 RECENT WEBHOOK ACTIVITY:');
    console.log('==========================\n');

    // First, let's see if there's any timestamp column
    const timestampCol = webhookColumns.rows.find(col =>
      col.column_name.includes('created') ||
      col.column_name.includes('timestamp') ||
      col.column_name.includes('date')
    );

    if (timestampCol) {
      const recentEvents = await client.query(`
        SELECT *
        FROM webhook_events
        WHERE metadata::text LIKE '%cruise_line_id%'
        ORDER BY ${timestampCol.column_name} DESC
        LIMIT 3
      `);

      if (recentEvents.rows.length > 0) {
        console.log(`Found ${recentEvents.rows.length} recent webhook events`);
        recentEvents.rows.forEach(event => {
          console.log('\nEvent:', JSON.stringify(event, null, 2));
        });
      } else {
        console.log('No recent webhook events found');
      }
    } else {
      console.log('Could not find timestamp column in webhook_events table');
    }

    // 6. Check if Line 22 is even being synced
    console.log('\n\n🚨 CRITICAL CHECK - IS LINE 22 BEING SYNCED?');
    console.log('===========================================\n');

    const lastWeekCheck = await client.query(`
      SELECT
        cruise_line_id,
        COUNT(*) as cruise_count,
        MAX(updated_at) as last_updated
      FROM cruises
      WHERE updated_at > NOW() - INTERVAL '7 days'
      GROUP BY cruise_line_id
      ORDER BY cruise_line_id
    `);

    console.log('Cruises updated in last 7 days by line:');
    lastWeekCheck.rows.forEach(row => {
      console.log(`  Line ${row.cruise_line_id}: ${row.cruise_count} cruises, last update: ${row.last_updated}`);
    });

    const line22InList = lastWeekCheck.rows.find(r => r.cruise_line_id === 22);
    if (!line22InList) {
      console.log('\n⚠️  WARNING: Line 22 (Royal Caribbean) has NOT been updated in the last 7 days!');
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
  } finally {
    await client.end();
  }
}

investigate();
