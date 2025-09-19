#!/usr/bin/env node

// Fix specific cruise pricing in cheapest_pricing table

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

async function fixSpecificCruisePricing(cruiseId) {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log(`Fixing pricing for cruise ${cruiseId}...\n`);

    // First check current status
    const checkQuery = `
      SELECT
        c.cruise_id,
        c.name,
        c.cheapest_price::numeric as cruise_cheapest,
        c.interior_price::numeric as cruise_interior,
        c.oceanview_price::numeric as cruise_oceanview,
        c.balcony_price::numeric as cruise_balcony,
        c.suite_price::numeric as cruise_suite,
        cp.cheapest_price as cp_cheapest,
        cp.interior_price as cp_interior,
        cp.oceanview_price as cp_oceanview,
        cp.balcony_price as cp_balcony,
        cp.suite_price as cp_suite
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.cruise_id = cp.cruise_id
      WHERE c.cruise_id = $1;
    `;

    const checkResult = await pool.query(checkQuery, [cruiseId]);

    if (checkResult.rows.length === 0) {
      console.log(`❌ Cruise ${cruiseId} not found in cruises table`);
      return;
    }

    const row = checkResult.rows[0];
    console.log('Current status:');
    console.log(`  Name: ${row.name}`);
    console.log(`  Cruises table prices:`);
    console.log(`    cheapest: $${row.cruise_cheapest}`);
    console.log(`    interior: $${row.cruise_interior}`);
    console.log(`    oceanview: $${row.cruise_oceanview}`);
    console.log(`    balcony: $${row.cruise_balcony}`);
    console.log(`    suite: $${row.cruise_suite}`);
    console.log(`  Cheapest_pricing table prices:`);
    console.log(`    cheapest: $${row.cp_cheapest}`);
    console.log(`    interior: $${row.cp_interior}`);
    console.log(`    oceanview: $${row.cp_oceanview}`);
    console.log(`    balcony: $${row.cp_balcony}`);
    console.log(`    suite: $${row.cp_suite}\n`);

    // If no record in cheapest_pricing, insert
    if (row.cp_cheapest === null) {
      const insertQuery = `
        INSERT INTO cheapest_pricing (
          cruise_id,
          cheapest_price,
          interior_price,
          oceanview_price,
          balcony_price,
          suite_price,
          cheapest_cabin_type,
          currency,
          last_updated
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          CASE
            WHEN $2::numeric = $3::numeric THEN 'inside'
            WHEN $2::numeric = $4::numeric THEN 'outside'
            WHEN $2::numeric = $5::numeric THEN 'balcony'
            WHEN $2::numeric = $6::numeric THEN 'suite'
            ELSE 'inside'
          END,
          'USD',
          NOW()
        );
      `;

      await pool.query(insertQuery, [
        cruiseId,
        row.cruise_cheapest,
        row.cruise_interior,
        row.cruise_oceanview,
        row.cruise_balcony,
        row.cruise_suite,
      ]);

      console.log('✅ Inserted new record into cheapest_pricing table');
    } else {
      // Update existing record
      const updateQuery = `
        UPDATE cheapest_pricing
        SET
          cheapest_price = $2,
          interior_price = $3,
          oceanview_price = $4,
          balcony_price = $5,
          suite_price = $6,
          cheapest_cabin_type = CASE
            WHEN $2::numeric = $3::numeric THEN 'inside'
            WHEN $2::numeric = $4::numeric THEN 'outside'
            WHEN $2::numeric = $5::numeric THEN 'balcony'
            WHEN $2::numeric = $6::numeric THEN 'suite'
            ELSE 'inside'
          END,
          last_updated = NOW()
        WHERE cruise_id = $1;
      `;

      await pool.query(updateQuery, [
        cruiseId,
        row.cruise_cheapest,
        row.cruise_interior,
        row.cruise_oceanview,
        row.cruise_balcony,
        row.cruise_suite,
      ]);

      console.log('✅ Updated existing record in cheapest_pricing table');
    }

    // Verify the update
    const verifyQuery = `
      SELECT
        cp.cheapest_price,
        cp.interior_price,
        cp.oceanview_price,
        cp.balcony_price,
        cp.suite_price,
        cp.cheapest_cabin_type
      FROM cheapest_pricing cp
      WHERE cp.cruise_id = $1;
    `;

    const verifyResult = await pool.query(verifyQuery, [cruiseId]);

    if (verifyResult.rows.length > 0) {
      const updated = verifyResult.rows[0];
      console.log('\nAfter update:');
      console.log(`  cheapest: $${updated.cheapest_price}`);
      console.log(`  interior: $${updated.interior_price}`);
      console.log(`  oceanview: $${updated.oceanview_price}`);
      console.log(`  balcony: $${updated.balcony_price}`);
      console.log(`  suite: $${updated.suite_price}`);
      console.log(`  cabin type: ${updated.cheapest_cabin_type}`);
    }

    console.log('\n✅ Script completed successfully');
  } catch (error) {
    console.error('Error fixing cruise pricing:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Fix cruise 2190299 (which has cruise_id 366593)
fixSpecificCruisePricing('366593');
