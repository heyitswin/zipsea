#!/usr/bin/env node

/**
 * Find specific Quantum of the Seas cruise and diagnose search issues
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  console.log('Usage: DATABASE_URL=your_database_url node find-quantum-cruise.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false,
  max: 5,
});

async function findQuantumCruise() {
  const client = await pool.connect();

  try {
    console.log('🚢 FINDING QUANTUM OF THE SEAS - FEB 10 2026');
    console.log('==============================================\n');

    // First, find the Quantum of the Seas ship
    console.log('1️⃣ Finding Quantum of the Seas ship...');
    const shipResult = await client.query(`
      SELECT id, name, owner_id, nice_name, short_name
      FROM ships
      WHERE LOWER(name) LIKE '%quantum%'
         OR LOWER(nice_name) LIKE '%quantum%'
         OR LOWER(short_name) LIKE '%quantum%'
    `);

    if (shipResult.rows.length > 0) {
      console.log('✅ Found ship(s):');
      shipResult.rows.forEach(ship => {
        console.log(`  - ID: ${ship.id}, Name: ${ship.name}, Nice Name: ${ship.nice_name}`);
        console.log(`    Owner ID (Line): ${ship.owner_id}`);
      });
    } else {
      console.log('❌ No ship found with "Quantum" in name');
    }
    console.log();

    // Search for cruises on Feb 10 2026
    console.log('2️⃣ Searching for cruises on Feb 10, 2026...');
    const dateResult = await client.query(`
      SELECT
        c.id,
        c.cruise_id,
        c.name,
        c.cruise_name,
        c.sailing_date,
        c.return_date,
        c.nights,
        c.ship_id,
        s.name as ship_name,
        c.owner_id,
        c.price_from,
        c.destination,
        c.embarkation_port,
        c.disembarkation_port,
        c.raw_data IS NOT NULL as has_raw_data,
        c.raw_data->>'name' as raw_name,
        c.raw_data->>'saildate' as raw_saildate
      FROM cruises c
      LEFT JOIN ships s ON c.ship_id = s.id
      WHERE c.sailing_date = '2026-02-10'
      ORDER BY s.name
    `);

    if (dateResult.rows.length > 0) {
      console.log(`✅ Found ${dateResult.rows.length} cruise(s) on Feb 10, 2026:`);

      const quantumCruise = dateResult.rows.find(c =>
        c.ship_name && c.ship_name.toLowerCase().includes('quantum')
      );

      if (quantumCruise) {
        console.log('\n🎯 FOUND QUANTUM OF THE SEAS CRUISE:');
        console.log(`  ID: ${quantumCruise.id}`);
        console.log(`  Cruise ID: ${quantumCruise.cruise_id}`);
        console.log(`  Name: ${quantumCruise.name || quantumCruise.raw_name || 'NO NAME'}`);
        console.log(`  Ship: ${quantumCruise.ship_name} (ID: ${quantumCruise.ship_id})`);
        console.log(`  Sailing Date: ${quantumCruise.sailing_date}`);
        console.log(`  Nights: ${quantumCruise.nights}`);
        console.log(`  Price From: $${quantumCruise.price_from || 'NO PRICE'}`);
        console.log(`  Destination: ${quantumCruise.destination || 'NO DESTINATION'}`);
        console.log(`  Embarkation: ${quantumCruise.embarkation_port || 'NO PORT'}`);
        console.log(`  Has Raw Data: ${quantumCruise.has_raw_data}`);

        // Check why it might not show in search
        console.log('\n📍 Checking why it might not appear in search:');
        const issues = [];

        if (!quantumCruise.name && !quantumCruise.raw_name) {
          issues.push('❌ Missing name field');
        }
        if (!quantumCruise.price_from) {
          issues.push('❌ Missing price_from field');
        }
        if (!quantumCruise.destination) {
          issues.push('❌ Missing destination field');
        }
        if (!quantumCruise.embarkation_port) {
          issues.push('❌ Missing embarkation_port field');
        }

        if (issues.length > 0) {
          console.log('Issues found:');
          issues.forEach(issue => console.log(`  ${issue}`));
        } else {
          console.log('  ✅ All required fields present');
        }

        // Extract data from raw_data if needed
        if (quantumCruise.has_raw_data && (!quantumCruise.name || !quantumCruise.price_from)) {
          console.log('\n3️⃣ Extracting data from raw_data JSONB...');

          const extractResult = await client.query(`
            UPDATE cruises
            SET
              name = COALESCE(name, raw_data->>'name'),
              cruise_name = COALESCE(cruise_name, raw_data->>'cruisename'),
              destination = COALESCE(destination, raw_data->>'destination'),
              embarkation_port = COALESCE(embarkation_port, raw_data->>'embarkation'),
              disembarkation_port = COALESCE(disembarkation_port, raw_data->>'disembarkation'),
              nights = COALESCE(nights, (raw_data->>'nights')::integer),
              price_from = COALESCE(
                price_from,
                LEAST(
                  NULLIF((raw_data->'cheapest'->'combined'->>'inside')::numeric, 0),
                  NULLIF((raw_data->'cheapest'->'combined'->>'outside')::numeric, 0),
                  NULLIF((raw_data->'cheapest'->'combined'->>'balcony')::numeric, 0),
                  NULLIF((raw_data->'cheapest'->'combined'->>'suite')::numeric, 0)
                )
              ),
              updated_at = NOW()
            WHERE id = $1
            RETURNING *
          `, [quantumCruise.id]);

          if (extractResult.rows.length > 0) {
            const updated = extractResult.rows[0];
            console.log('✅ Data extracted and updated:');
            console.log(`  Name: ${updated.name}`);
            console.log(`  Price: $${updated.price_from}`);
            console.log(`  Destination: ${updated.destination}`);
          }
        }

      } else {
        console.log('\n⚠️ No Quantum of the Seas cruise found on this date');
        console.log('Other ships sailing on Feb 10, 2026:');
        dateResult.rows.forEach(cruise => {
          console.log(`  - ${cruise.ship_name || 'Unknown Ship'}: ${cruise.name || cruise.raw_name || 'No name'}`);
        });
      }
    } else {
      console.log('❌ No cruises found on Feb 10, 2026');
    }
    console.log();

    // Search more broadly for Quantum cruises
    console.log('4️⃣ Searching for all Quantum of the Seas cruises in Feb 2026...');
    const quantumResult = await client.query(`
      SELECT
        c.id,
        c.cruise_id,
        c.name,
        c.sailing_date,
        c.nights,
        c.price_from,
        c.destination,
        c.embarkation_port,
        s.name as ship_name
      FROM cruises c
      JOIN ships s ON c.ship_id = s.id
      WHERE LOWER(s.name) LIKE '%quantum%'
        AND c.sailing_date >= '2026-02-01'
        AND c.sailing_date <= '2026-02-28'
      ORDER BY c.sailing_date
    `);

    if (quantumResult.rows.length > 0) {
      console.log(`✅ Found ${quantumResult.rows.length} Quantum cruise(s) in Feb 2026:`);
      quantumResult.rows.forEach(cruise => {
        console.log(`  - ${cruise.sailing_date}: ${cruise.name || 'No name'}`);
        console.log(`    ${cruise.nights} nights, $${cruise.price_from || 'No price'}, ${cruise.embarkation_port || 'No port'}`);
      });
    } else {
      console.log('❌ No Quantum of the Seas cruises found in Feb 2026');
    }
    console.log();

    // Check if it exists in raw_data but not extracted
    console.log('5️⃣ Checking raw_data for unextracted Quantum cruises...');
    const rawDataResult = await client.query(`
      SELECT
        c.id,
        c.cruise_id,
        c.raw_data->>'name' as raw_name,
        c.raw_data->>'saildate' as raw_saildate,
        c.raw_data->>'shipname' as raw_shipname,
        c.raw_data->>'embarkation' as raw_embarkation,
        c.raw_data->'cheapest'->'combined'->>'inside' as raw_price
      FROM cruises c
      WHERE c.raw_data IS NOT NULL
        AND (
          LOWER(c.raw_data->>'shipname') LIKE '%quantum%'
          OR (c.raw_data->>'saildate')::date = '2026-02-10'
        )
        AND c.name IS NULL
      LIMIT 10
    `);

    if (rawDataResult.rows.length > 0) {
      console.log(`⚠️ Found ${rawDataResult.rows.length} unextracted cruise(s) in raw_data:`);
      rawDataResult.rows.forEach(cruise => {
        console.log(`  - ID: ${cruise.id}`);
        console.log(`    Name: ${cruise.raw_name}`);
        console.log(`    Ship: ${cruise.raw_shipname}`);
        console.log(`    Date: ${cruise.raw_saildate}`);
        console.log(`    Port: ${cruise.raw_embarkation}`);
        console.log(`    Price: $${cruise.raw_price}`);
        console.log();
      });

      console.log('💡 These cruises need data extraction!');
      console.log('   Run: node extract-jsonb-to-columns.js');
    }

    // Test search query
    console.log('\n6️⃣ Testing search query for "quantum"...');
    const searchResult = await client.query(`
      SELECT
        c.id,
        c.name,
        c.sailing_date,
        c.price_from,
        s.name as ship_name
      FROM cruises c
      JOIN ships s ON c.ship_id = s.id
      WHERE (
        LOWER(c.name) LIKE '%quantum%'
        OR LOWER(c.cruise_name) LIKE '%quantum%'
        OR LOWER(s.name) LIKE '%quantum%'
        OR LOWER(c.destination) LIKE '%quantum%'
      )
      AND c.sailing_date >= CURRENT_DATE
      AND c.price_from IS NOT NULL
      AND c.name IS NOT NULL
      ORDER BY c.sailing_date
      LIMIT 5
    `);

    if (searchResult.rows.length > 0) {
      console.log(`✅ Search for "quantum" returns ${searchResult.rows.length} result(s):`);
      searchResult.rows.forEach(cruise => {
        console.log(`  - ${cruise.sailing_date}: ${cruise.name}`);
        console.log(`    Ship: ${cruise.ship_name}, Price: $${cruise.price_from}`);
      });
    } else {
      console.log('❌ Search for "quantum" returns no results');
      console.log('   This explains why it\'s not showing in homepage search!');
    }

    console.log('\n==============================================');
    console.log('📊 SUMMARY');
    console.log('==============================================');

    // Final check
    const finalCheck = await client.query(`
      SELECT COUNT(*) as total
      FROM cruises c
      JOIN ships s ON c.ship_id = s.id
      WHERE LOWER(s.name) LIKE '%quantum%'
        AND c.sailing_date >= '2026-02-01'
        AND c.sailing_date <= '2026-02-28'
    `);

    const extracted = await client.query(`
      SELECT COUNT(*) as total
      FROM cruises c
      JOIN ships s ON c.ship_id = s.id
      WHERE LOWER(s.name) LIKE '%quantum%'
        AND c.sailing_date >= '2026-02-01'
        AND c.sailing_date <= '2026-02-28'
        AND c.name IS NOT NULL
        AND c.price_from IS NOT NULL
    `);

    console.log(`Total Quantum cruises in Feb 2026: ${finalCheck.rows[0].total}`);
    console.log(`With extracted data (name + price): ${extracted.rows[0].total}`);
    console.log(`Need extraction: ${finalCheck.rows[0].total - extracted.rows[0].total}`);

    if (extracted.rows[0].total === '0') {
      console.log('\n❌ PROBLEM: No Quantum cruises have extracted data!');
      console.log('   This is why they don\'t appear in search.');
      console.log('\n✅ SOLUTION: Run the extraction script:');
      console.log('   DATABASE_URL=... node extract-jsonb-to-columns.js');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the search
findQuantumCruise().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
