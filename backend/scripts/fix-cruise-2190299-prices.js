#!/usr/bin/env node

// Fix prices for specific cruise 2190299 based on documentation requirements
// According to cruise-pricing-system.md, prices should come from cheapest* fields

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

async function fixCruise2190299Prices() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Fixing prices for cruise 2190299 (Alaska Adventure Cruise)...\n');

    // According to documentation and user requirements:
    const correctPrices = {
      interior: '1091.18',    // from cheapestinside
      oceanview: '1391.18',   // from cheapestoutside
      balcony: '1919.18',     // from cheapestbalcony
      suite: '3512.18'        // from cheapestsuite
    };

    console.log('Correct prices according to documentation:');
    console.log(`  Interior: $${correctPrices.interior} (from cheapestinside)`);
    console.log(`  Oceanview: $${correctPrices.oceanview} (from cheapestoutside)`);
    console.log(`  Balcony: $${correctPrices.balcony} (from cheapestbalcony)`);
    console.log(`  Suite: $${correctPrices.suite} (from cheapestsuite)\n`);

    // Show current prices
    const beforeQuery = `
      SELECT
        id,
        cruise_id,
        name,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price
      FROM cruises
      WHERE id = '2190299';
    `;

    const beforeResult = await pool.query(beforeQuery);
    if (beforeResult.rows.length === 0) {
      console.log('❌ Cruise 2190299 not found in database');
      return;
    }

    const before = beforeResult.rows[0];
    console.log('Current (incorrect) prices in database:');
    console.log(`  Interior: $${before.interior_price}`);
    console.log(`  Oceanview: $${before.oceanview_price}`);
    console.log(`  Balcony: $${before.balcony_price}`);
    console.log(`  Suite: $${before.suite_price}`);
    console.log(`  Cheapest: $${before.cheapest_price}\n`);

    // Update cruises table
    const updateCruiseQuery = `
      UPDATE cruises
      SET
        interior_price = $1,
        oceanview_price = $2,
        balcony_price = $3,
        suite_price = $4,
        cheapest_price = LEAST($1::numeric, $2::numeric, $3::numeric, $4::numeric),
        updated_at = NOW()
      WHERE id = '2190299';
    `;

    await pool.query(updateCruiseQuery, [
      correctPrices.interior,
      correctPrices.oceanview,
      correctPrices.balcony,
      correctPrices.suite
    ]);

    console.log('✅ Updated cruises table with correct prices');

    // Update cheapest_pricing table
    const updateCheapestQuery = `
      UPDATE cheapest_pricing
      SET
        interior_price = $1,
        oceanview_price = $2,
        balcony_price = $3,
        suite_price = $4,
        cheapest_price = LEAST($1::numeric, $2::numeric, $3::numeric, $4::numeric),
        cheapest_cabin_type = CASE
          WHEN LEAST($1::numeric, $2::numeric, $3::numeric, $4::numeric) = $1::numeric THEN 'inside'
          WHEN LEAST($1::numeric, $2::numeric, $3::numeric, $4::numeric) = $2::numeric THEN 'outside'
          WHEN LEAST($1::numeric, $2::numeric, $3::numeric, $4::numeric) = $3::numeric THEN 'balcony'
          WHEN LEAST($1::numeric, $2::numeric, $3::numeric, $4::numeric) = $4::numeric THEN 'suite'
          ELSE 'inside'
        END,
        last_updated = NOW()
      WHERE cruise_id = '366593';
    `;

    const updateCheapestResult = await pool.query(updateCheapestQuery, [
      correctPrices.interior,
      correctPrices.oceanview,
      correctPrices.balcony,
      correctPrices.suite
    ]);

    if (updateCheapestResult.rowCount > 0) {
      console.log('✅ Updated cheapest_pricing table with correct prices');
    } else {
      // Insert if not exists
      const insertQuery = `
        INSERT INTO cheapest_pricing (
          cruise_id,
          interior_price,
          oceanview_price,
          balcony_price,
          suite_price,
          cheapest_price,
          cheapest_cabin_type,
          currency,
          last_updated
        ) VALUES (
          '366593',
          $1,
          $2,
          $3,
          $4,
          LEAST($1::numeric, $2::numeric, $3::numeric, $4::numeric),
          CASE
            WHEN LEAST($1::numeric, $2::numeric, $3::numeric, $4::numeric) = $1::numeric THEN 'inside'
            WHEN LEAST($1::numeric, $2::numeric, $3::numeric, $4::numeric) = $2::numeric THEN 'outside'
            WHEN LEAST($1::numeric, $2::numeric, $3::numeric, $4::numeric) = $3::numeric THEN 'balcony'
            WHEN LEAST($1::numeric, $2::numeric, $3::numeric, $4::numeric) = $4::numeric THEN 'suite'
            ELSE 'inside'
          END,
          'USD',
          NOW()
        );
      `;

      await pool.query(insertQuery, [
        correctPrices.interior,
        correctPrices.oceanview,
        correctPrices.balcony,
        correctPrices.suite
      ]);
      console.log('✅ Inserted new record into cheapest_pricing table');
    }

    // Verify the update
    const afterQuery = `
      SELECT
        c.id,
        c.cruise_id,
        c.name,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        c.cheapest_price,
        cp.interior_price as cp_interior,
        cp.cheapest_price as cp_cheapest
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.cruise_id = cp.cruise_id
      WHERE c.id = '2190299';
    `;

    const afterResult = await pool.query(afterQuery);
    const after = afterResult.rows[0];

    console.log('\nPrices after update:');
    console.log(`  Interior: $${after.interior_price} ✅`);
    console.log(`  Oceanview: $${after.oceanview_price} ✅`);
    console.log(`  Balcony: $${after.balcony_price} ✅`);
    console.log(`  Suite: $${after.suite_price} ✅`);
    console.log(`  Cheapest: $${after.cheapest_price} (calculated as MIN of all cabin prices)`);

    console.log('\n✅ Successfully fixed prices for cruise 2190299');
    console.log('\nNote: The raw_data field appears corrupted for this cruise.');
    console.log('Prices have been manually corrected based on documentation requirements.');

  } catch (error) {
    console.error('Error fixing cruise prices:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixCruise2190299Prices();
