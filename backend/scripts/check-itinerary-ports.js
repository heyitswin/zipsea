#!/usr/bin/env node

const dotenv = require('dotenv');
const path = require('path');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const cruiseId = '2143102';

async function checkPorts() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log(`\n=== Checking Itinerary Ports for Cruise ${cruiseId} ===\n`);

    // 1. Get full itinerary data
    const itineraryResult = await pool.query(
      'SELECT * FROM cruise_itinerary WHERE cruise_id = $1 ORDER BY day_number',
      [cruiseId]
    );

    console.log('Full itinerary data:');
    itineraryResult.rows.forEach(row => {
      console.log(`\nDay ${row.day_number}:`);
      console.log(`  ID: ${row.id}`);
      console.log(`  Port ID: ${row.port_id}`);
      console.log(`  Port Name: ${row.port_name || 'NULL'}`);
      console.log(`  Arrive: ${row.arrive_time || 'NULL'}`);
      console.log(`  Depart: ${row.depart_time || 'NULL'}`);
      console.log(`  Is Sea Day: ${row.is_sea_day || false}`);
    });

    // 2. Check if port_name exists but port_id is null
    const portsWithNames = itineraryResult.rows.filter(r => r.port_name && !r.port_id);
    if (portsWithNames.length > 0) {
      console.log('\n=== Ports with names but no IDs ===');
      for (const row of portsWithNames) {
        console.log(`\nDay ${row.day_number}: ${row.port_name}`);

        // Try to find matching port in ports table
        const portMatch = await pool.query(
          'SELECT id, name, code FROM ports WHERE LOWER(name) LIKE $1 OR LOWER(code) LIKE $1 LIMIT 5',
          [`%${row.port_name.toLowerCase()}%`]
        );

        if (portMatch.rows.length > 0) {
          console.log('  Possible matches in ports table:');
          portMatch.rows.forEach(p => {
            console.log(`    ID ${p.id}: ${p.name} (${p.code})`);
          });
        } else {
          console.log('  No matches found in ports table');
        }
      }
    }

    // 3. Check API query to understand why it's not returning
    console.log('\n=== Testing API Query ===');
    const apiQueryResult = await pool.query(`
      SELECT
        i.*,
        p.name as port_name,
        p.code as port_code,
        p.country as port_country
      FROM cruise_itinerary i
      LEFT JOIN ports p ON i.port_id = p.id
      WHERE i.cruise_id = $1
      ORDER BY i.day_number ASC
    `, [cruiseId]);

    console.log(`\nAPI query returns ${apiQueryResult.rows.length} rows`);
    if (apiQueryResult.rows.length > 0) {
      console.log('Sample row:', JSON.stringify(apiQueryResult.rows[0], null, 2));
    }

    // 4. Check if this is a recent issue
    console.log('\n=== Checking Historical Data ===');
    const historicalResult = await pool.query(`
      SELECT
        DATE(c.updated_at) as update_date,
        COUNT(DISTINCT i.cruise_id) as cruises_with_itinerary,
        COUNT(CASE WHEN i.port_id IS NULL THEN 1 END) as null_port_count,
        COUNT(CASE WHEN i.port_id IS NOT NULL THEN 1 END) as valid_port_count
      FROM cruise_itinerary i
      JOIN cruises c ON i.cruise_id = c.id
      WHERE c.ship_id = (SELECT ship_id FROM cruises WHERE id = $1)
      GROUP BY DATE(c.updated_at)
      ORDER BY DATE(c.updated_at) DESC
      LIMIT 5
    `, [cruiseId]);

    console.log('Port ID status by update date:');
    historicalResult.rows.forEach(row => {
      console.log(`  ${row.update_date}: ${row.valid_port_count} valid ports, ${row.null_port_count} null ports`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkPorts();
