#!/usr/bin/env node

const dotenv = require('dotenv');
const path = require('path');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const cruiseId = '2143102'; // Symphony of the Seas cruise

async function checkItinerary() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log(`\n=== Checking Itinerary for Cruise ${cruiseId} ===\n`);

    // 1. Check if cruise exists
    const cruiseResult = await pool.query(
      'SELECT id, ship_id, sailing_date FROM cruises WHERE id = $1',
      [cruiseId]
    );
    if (cruiseResult.rows.length === 0) {
      console.log('❌ Cruise not found');
      return;
    }
    console.log('✅ Cruise found: ID', cruiseResult.rows[0].id);
    console.log('   Ship ID:', cruiseResult.rows[0].ship_id);
    console.log('   Sailing date:', cruiseResult.rows[0].sailing_date);

    // 2. Check cruise_itinerary table
    console.log('\n=== Checking cruise_itinerary table ===');
    const itineraryResult = await pool.query(
      'SELECT * FROM cruise_itinerary WHERE cruise_id = $1 ORDER BY day_number',
      [cruiseId]
    );

    if (itineraryResult.rows.length > 0) {
      console.log(`✅ Found ${itineraryResult.rows.length} itinerary entries`);
      itineraryResult.rows.forEach(row => {
        console.log(
          `   Day ${row.day_number}: Port ${row.port_id} (${row.arrive_time || 'N/A'} - ${row.depart_time || 'N/A'})`
        );
      });
    } else {
      console.log('❌ No itinerary entries found');
    }

    // 3. Check if other cruises have itineraries (sample)
    console.log('\n=== Checking other cruises for comparison ===');
    const otherCruisesResult = await pool.query(
      `
      SELECT c.id, COUNT(i.id) as itinerary_count
      FROM cruises c
      LEFT JOIN cruise_itinerary i ON c.id = i.cruise_id
      WHERE c.ship_id = (SELECT ship_id FROM cruises WHERE id = $1)
      AND c.id != $1
      GROUP BY c.id
      HAVING COUNT(i.id) > 0
      LIMIT 5
    `,
      [cruiseId]
    );

    if (otherCruisesResult.rows.length > 0) {
      console.log('Other cruises on same ship with itineraries:');
      otherCruisesResult.rows.forEach(row => {
        console.log(`   ${row.id}: ${row.itinerary_count} stops`);
      });
    } else {
      console.log('No other cruises found with itineraries on same ship');
    }

    // 4. Check total itinerary entries in database
    console.log('\n=== Database Statistics ===');
    const statsResult = await pool.query(`
      SELECT
        COUNT(DISTINCT cruise_id) as cruises_with_itinerary,
        COUNT(*) as total_itinerary_entries
      FROM cruise_itinerary
    `);
    console.log('Total cruises with itinerary:', statsResult.rows[0].cruises_with_itinerary);
    console.log('Total itinerary entries:', statsResult.rows[0].total_itinerary_entries);

    // 5. Check recent modifications
    console.log('\n=== Recent Itinerary Changes ===');
    const recentChangesResult = await pool.query(`
      SELECT cruise_id, COUNT(*) as entries, MAX(id) as latest_id
      FROM cruise_itinerary
      WHERE cruise_id::text LIKE '2143%'
      GROUP BY cruise_id
      ORDER BY cruise_id
    `);

    if (recentChangesResult.rows.length > 0) {
      console.log('Similar cruise IDs with itineraries:');
      recentChangesResult.rows.forEach(row => {
        console.log(`   ${row.cruise_id}: ${row.entries} entries`);
      });
    }

    // 6. Check if there's data in the FTP file
    console.log('\n=== Checking Raw Cruise Data ===');
    const cruiseDataResult = await pool.query(
      `SELECT
        CASE
          WHEN data::text LIKE '%itinerary%' THEN 'Has itinerary in data field'
          ELSE 'No itinerary in data field'
        END as has_itinerary
      FROM cruises
      WHERE id = $1 AND data IS NOT NULL`,
      [cruiseId]
    );

    if (cruiseDataResult.rows.length > 0) {
      console.log('Data field check:', cruiseDataResult.rows[0].has_itinerary);
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkItinerary();
