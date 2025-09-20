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

    // Check if already fixed
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

    console.log('Current prices in cruises table:');
    console.log(`  Interior:  ${current.interior_price} ${current.interior_price === correctPrices.interior ? '✅' : '→ ' + correctPrices.interior}`);
    console.log(`  Oceanview: ${current.oceanview_price} ${current.oceanview_price === correctPrices.oceanview ? '✅' : '→ ' + correctPrices.oceanview}`);
    console.log(`  Balcony:   ${current.balcony_price} ${current.balcony_price === correctPrices.balcony ? '✅' : '→ ' + correctPrices.balcony}`);
    console.log(`  Suite:     ${current.suite_price} ${current.suite_price === correctPrices.suite ? '✅' : '→ ' + correctPrices.suite}`);
    console.log(`  Cheapest:  ${current.cheapest_price}\n`);

    // Update cruises table if needed
    if (current.interior_price !== correctPrices.interior ||
        current.oceanview_price !== correctPrices.oceanview ||
        current.balcony_price !== correctPrices.balcony ||
        current.suite_price !== correctPrices.suite) {

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

      console.log('✅ Cruises table updated!');
    } else {
      console.log('✅ Cruises table prices already correct!');
    }

    // Update cheapest_pricing table with correct column names
    const upsertPricingResult = await client.query(`
      INSERT INTO cheapest_pricing (
        cruise_id,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price,
        cheapest_cabin_type,
        last_updated
      ) VALUES (
        '2190299',
        $1::decimal,
        $2::decimal,
        $3::decimal,
        $4::decimal,
        $1::decimal,  -- cheapest is interior
        'Interior',
        NOW()
      )
      ON CONFLICT (cruise_id)
      DO UPDATE SET
        interior_price = $1::decimal,
        oceanview_price = $2::decimal,
        balcony_price = $3::decimal,
        suite_price = $4::decimal,
        cheapest_price = $1::decimal,
        cheapest_cabin_type = 'Interior',
        last_updated = NOW()
      RETURNING interior_price, oceanview_price, balcony_price, suite_price, cheapest_price
    `, [
      correctPrices.interior,
      correctPrices.oceanview,
      correctPrices.balcony,
      correctPrices.suite
    ]);

    if (upsertPricingResult.rows.length > 0) {
      const pricing = upsertPricingResult.rows[0];
      console.log('\n✅ Cheapest_pricing table updated!');
      console.log('New prices in cheapest_pricing:');
      console.log(`  Interior:  ${pricing.interior_price}`);
      console.log(`  Oceanview: ${pricing.oceanview_price}`);
      console.log(`  Balcony:   ${pricing.balcony_price}`);
      console.log(`  Suite:     ${pricing.suite_price}`);
      console.log(`  Cheapest:  ${pricing.cheapest_price}`);
    }

    await client.query('COMMIT');
    console.log('\n🎉 All prices fixed successfully!');

    // Clear Redis cache if available
    try {
      const redis = require('ioredis');
      const redisClient = new redis(process.env.REDIS_URL || 'redis://localhost:6379');

      // Clear any cached data for this cruise
      const patterns = [
        `cruise:2190299:*`,
        `cruise-details:2190299`,
        `comprehensive:2190299`,
        `*:2190299:*`
      ];

      for (const pattern of patterns) {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(...keys);
          console.log(`\n✅ Cleared ${keys.length} Redis cache entries matching pattern: ${pattern}`);
        }
      }

      await redisClient.quit();
    } catch (e) {
      console.log('\n📝 Note: Could not clear Redis cache (Redis may not be configured)');
    }

    console.log('\n📝 Next Steps:');
    console.log('1. The database has been updated with correct prices');
    console.log('2. Check https://www.zipsea.com/cruise/anthem-of-the-seas-2026-07-13-2190299');
    console.log('3. If prices still show old values, you may need to:');
    console.log('   - Clear CDN cache (Cloudflare, etc.)');
    console.log('   - Restart the backend service');
    console.log('   - Wait for any browser cache to expire (try incognito mode)');

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
