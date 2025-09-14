#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function checkCruiseIdMapping() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('Connected to PRODUCTION database\n');

    // 1. Check the actual structure of the cruises table
    console.log('📊 CRUISES TABLE STRUCTURE:');
    console.log('==========================\n');

    const tableInfo = await client.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'cruises'
      AND column_name IN ('id', 'traveltek_cruise_id', 'cruise_id', 'cruise_line_id')
      ORDER BY ordinal_position
    `);

    console.log('Key columns in cruises table:');
    tableInfo.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // 2. Check sample cruise IDs to understand the format
    console.log('\n\n🔍 SAMPLE CRUISE IDs (showing different patterns):');
    console.log('=================================================\n');

    // Get samples from different cruise lines
    const samples = await client.query(`
      SELECT
        id,
        traveltek_cruise_id,
        cruise_line_id,
        name,
        sailing_date
      FROM cruises
      WHERE cruise_line_id IN (22, 31, 21, 1, 2)  -- Different lines
      ORDER BY cruise_line_id, updated_at DESC
      LIMIT 15
    `);

    let lastLineId = null;
    samples.rows.forEach(row => {
      if (row.cruise_line_id !== lastLineId) {
        console.log(`\n--- Cruise Line ${row.cruise_line_id} ---`);
        lastLineId = row.cruise_line_id;
      }
      console.log(`ID: ${row.id}`);
      console.log(`  Traveltek ID: ${row.traveltek_cruise_id || 'NULL'}`);
      console.log(`  Name: ${row.name}`);
      console.log(`  Sailing: ${row.sailing_date}`);
    });

    // 3. Check if 2143102 exists in ANY form
    console.log('\n\n🎯 SEARCHING FOR CRUISE 2143102:');
    console.log('================================\n');

    // Check as string ID
    const asStringId = await client.query(`
      SELECT id, traveltek_cruise_id, cruise_line_id, name, sailing_date
      FROM cruises
      WHERE id = '2143102'
    `);

    if (asStringId.rows.length > 0) {
      console.log('✅ FOUND as primary ID (id field):');
      console.log(JSON.stringify(asStringId.rows[0], null, 2));
    } else {
      console.log('❌ NOT found with id = "2143102"');
    }

    // Check as traveltek_cruise_id
    const asTraveltekId = await client.query(`
      SELECT id, traveltek_cruise_id, cruise_line_id, name, sailing_date
      FROM cruises
      WHERE traveltek_cruise_id = '2143102'
    `);

    if (asTraveltekId.rows.length > 0) {
      console.log('\n✅ FOUND as traveltek_cruise_id:');
      console.log(JSON.stringify(asTraveltekId.rows[0], null, 2));
    } else {
      console.log('❌ NOT found with traveltek_cruise_id = "2143102"');
    }

    // 4. Check Royal Caribbean's ID pattern
    console.log('\n\n📈 ROYAL CARIBBEAN (Line 22) ID ANALYSIS:');
    console.log('=========================================\n');

    const rcAnalysis = await client.query(`
      SELECT
        COUNT(*) as total_cruises,
        COUNT(DISTINCT id) as unique_ids,
        MIN(LENGTH(id::text)) as min_id_length,
        MAX(LENGTH(id::text)) as max_id_length,
        COUNT(CASE WHEN id ~ '^[0-9]+$' THEN 1 END) as numeric_ids,
        COUNT(CASE WHEN traveltek_cruise_id IS NOT NULL THEN 1 END) as has_traveltek_id,
        MIN(id) as sample_min_id,
        MAX(id) as sample_max_id
      FROM cruises
      WHERE cruise_line_id = 22
    `);

    const stats = rcAnalysis.rows[0];
    console.log(`Total Royal Caribbean cruises: ${stats.total_cruises}`);
    console.log(`Unique IDs: ${stats.unique_ids}`);
    console.log(`ID length range: ${stats.min_id_length}-${stats.max_id_length} characters`);
    console.log(`Numeric IDs: ${stats.numeric_ids}`);
    console.log(`Has traveltek_cruise_id: ${stats.has_traveltek_id}`);
    console.log(`Sample ID range: ${stats.sample_min_id} to ${stats.sample_max_id}`);

    // 5. Check what the largest ID is to see if we're using internal IDs
    console.log('\n\n🔢 ID RANGE ANALYSIS:');
    console.log('====================\n');

    const idRange = await client.query(`
      SELECT
        MIN(CAST(id AS BIGINT)) as min_id,
        MAX(CAST(id AS BIGINT)) as max_id,
        COUNT(*) as count
      FROM cruises
      WHERE id ~ '^[0-9]+$'
      AND cruise_line_id = 22
    `);

    if (idRange.rows[0].count > 0) {
      console.log(`Royal Caribbean numeric ID range:`);
      console.log(`  Min: ${idRange.rows[0].min_id}`);
      console.log(`  Max: ${idRange.rows[0].max_id}`);
      console.log(`  Count: ${idRange.rows[0].count}`);

      // Check if 2143102 falls within this range
      const targetId = 2143102;
      if (targetId >= idRange.rows[0].min_id && targetId <= idRange.rows[0].max_id) {
        console.log(`\n⚠️  ID 2143102 falls within the range but doesn't exist!`);
        console.log(`This suggests IDs are being generated differently.`);
      }
    }

    // 6. Look for Symphony of the Seas cruise on Oct 5, 2025
    console.log('\n\n🚢 SEARCHING FOR SYMPHONY OF THE SEAS - Oct 5, 2025:');
    console.log('===================================================\n');

    const symphonySearch = await client.query(`
      SELECT
        id,
        traveltek_cruise_id,
        name,
        ship_name,
        sailing_date,
        nights,
        created_at,
        updated_at
      FROM cruises
      WHERE cruise_line_id = 22
      AND (
        ship_name ILIKE '%symphony%'
        OR name ILIKE '%symphony%'
      )
      AND sailing_date >= '2025-10-01'
      AND sailing_date <= '2025-10-31'
      ORDER BY sailing_date
      LIMIT 10
    `);

    if (symphonySearch.rows.length > 0) {
      console.log(
        `Found ${symphonySearch.rows.length} Symphony of the Seas cruises in October 2025:\n`
      );
      symphonySearch.rows.forEach(cruise => {
        console.log(`ID: ${cruise.id}`);
        console.log(`  Traveltek ID: ${cruise.traveltek_cruise_id || 'NULL'}`);
        console.log(`  Name: ${cruise.name}`);
        console.log(`  Ship: ${cruise.ship_name}`);
        console.log(`  Sailing: ${cruise.sailing_date}`);
        console.log(`  Nights: ${cruise.nights}`);
        console.log(`  Updated: ${cruise.updated_at}`);
        console.log('');
      });
    } else {
      console.log('❌ No Symphony of the Seas cruises found for October 2025');
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
  } finally {
    await client.end();
  }
}

checkCruiseIdMapping();
