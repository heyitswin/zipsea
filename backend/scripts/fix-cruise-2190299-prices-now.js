require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixCruisePrices() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🔧 Fixing prices for cruise 2190299...\n');

    // According to the documentation, these are the correct prices
    const correctPrices = {
      interior: '1091.18',    // from cheapestinside
      oceanview: '1391.18',   // from cheapestoutside
      balcony: '1919.18',     // from cheapestbalcony
      suite: '3512.18'        // from cheapestsuite
    };

    // Check current prices first
    const currentResult = await client.query(`
      SELECT
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price
      FROM cruises
      WHERE id = '2190299'
    `);

    if (currentResult.rows.length === 0) {
      throw new Error('Cruise 2190299 not found');
    }

    const current = currentResult.rows[0];

    console.log('Current prices:');
    console.log(`  Interior:  ${current.interior_price} → ${correctPrices.interior}`);
    console.log(`  Oceanview: ${current.oceanview_price} → ${correctPrices.oceanview}`);
    console.log(`  Balcony:   ${current.balcony_price} → ${correctPrices.balcony}`);
    console.log(`  Suite:     ${current.suite_price} → ${correctPrices.suite}`);
    console.log(`  Cheapest:  ${current.cheapest_price} → ${correctPrices.interior} (will be recalculated)\n`);

    // Update the cruises table
    const updateResult = await client.query(`
      UPDATE cruises
      SET
        interior_price = $1::decimal,
        oceanview_price = $2::decimal,
        balcony_price = $3::decimal,
        suite_price = $4::decimal,
        updated_at = NOW()
      WHERE id = '2190299'
      RETURNING
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price
    `, [
      correctPrices.interior,
      correctPrices.oceanview,
      correctPrices.balcony,
      correctPrices.suite
    ]);

    if (updateResult.rows.length > 0) {
      const updated = updateResult.rows[0];
      console.log('✅ Cruises table updated successfully!');
      console.log('New prices:');
      console.log(`  Interior:  ${updated.interior_price}`);
      console.log(`  Oceanview: ${updated.oceanview_price}`);
      console.log(`  Balcony:   ${updated.balcony_price}`);
      console.log(`  Suite:     ${updated.suite_price}`);
      console.log(`  Cheapest:  ${updated.cheapest_price} (auto-calculated by trigger)\n`);
    }

    // Also update/insert into cheapest_pricing table
    const upsertPricingResult = await client.query(`
      INSERT INTO cheapest_pricing (
        cruise_id,
        interior,
        oceanview,
        balcony,
        suite,
        updated_at
      ) VALUES (
        '2190299',
        $1::decimal,
        $2::decimal,
        $3::decimal,
        $4::decimal,
        NOW()
      )
      ON CONFLICT (cruise_id)
      DO UPDATE SET
        interior = $1::decimal,
        oceanview = $2::decimal,
        balcony = $3::decimal,
        suite = $4::decimal,
        updated_at = NOW()
      RETURNING *
    `, [
      correctPrices.interior,
      correctPrices.oceanview,
      correctPrices.balcony,
      correctPrices.suite
    ]);

    if (upsertPricingResult.rows.length > 0) {
      console.log('✅ Cheapest_pricing table updated successfully!');
    }

    await client.query('COMMIT');
    console.log('\n🎉 All prices fixed successfully!');
    console.log('The website should now show the correct prices after any cache expires.');

    // Check if there's Redis cache that needs clearing
    console.log('\n📝 Note: If the website still shows old prices, it may be cached.');
    console.log('You may need to:');
    console.log('1. Clear any CDN cache (Cloudflare, etc.)');
    console.log('2. Clear Redis cache if used');
    console.log('3. Restart the backend service to clear in-memory cache');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixCruisePrices();
