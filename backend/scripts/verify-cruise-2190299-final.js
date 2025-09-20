require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyCruise() {
  try {
    console.log('📊 CRUISE 2190299 STATUS VERIFICATION\n');
    console.log('=' .repeat(50));

    // Check cruises table
    const cruiseResult = await pool.query(`
      SELECT
        id,
        name,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price,
        updated_at,
        voyage_code,
        sailing_date
      FROM cruises
      WHERE id = '2190299'
    `);

    if (cruiseResult.rows.length === 0) {
      console.log('❌ Cruise 2190299 not found in database!');
      return;
    }

    const cruise = cruiseResult.rows[0];

    console.log('\n✅ DATABASE STATUS:');
    console.log('-------------------');
    console.log('Name:', cruise.name);
    console.log('Voyage Code:', cruise.voyage_code);
    console.log('Sailing Date:', cruise.sailing_date);
    console.log('\n💰 CURRENT PRICES IN DATABASE:');
    console.log('  Interior:  $' + cruise.interior_price);
    console.log('  Oceanview: $' + cruise.oceanview_price);
    console.log('  Balcony:   $' + cruise.balcony_price);
    console.log('  Suite:     $' + cruise.suite_price);
    console.log('  Cheapest:  $' + cruise.cheapest_price);
    console.log('\nLast Updated:', new Date(cruise.updated_at).toLocaleString());

    // Check expected values
    const expected = {
      interior: '1091.18',
      oceanview: '1391.18',
      balcony: '1919.18',
      suite: '3512.18'
    };

    console.log('\n✅ VERIFICATION:');
    console.log('----------------');
    const allCorrect =
      cruise.interior_price === expected.interior &&
      cruise.oceanview_price === expected.oceanview &&
      cruise.balcony_price === expected.balcony &&
      cruise.suite_price === expected.suite;

    if (allCorrect) {
      console.log('✅ All prices are CORRECT in the database!');
    } else {
      console.log('❌ Some prices are INCORRECT:');
      if (cruise.interior_price !== expected.interior) {
        console.log(`  Interior: ${cruise.interior_price} should be ${expected.interior}`);
      }
      if (cruise.oceanview_price !== expected.oceanview) {
        console.log(`  Oceanview: ${cruise.oceanview_price} should be ${expected.oceanview}`);
      }
      if (cruise.balcony_price !== expected.balcony) {
        console.log(`  Balcony: ${cruise.balcony_price} should be ${expected.balcony}`);
      }
      if (cruise.suite_price !== expected.suite) {
        console.log(`  Suite: ${cruise.suite_price} should be ${expected.suite}`);
      }
    }

    // Check cheapest_pricing table
    const pricingResult = await pool.query(`
      SELECT
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price,
        last_updated
      FROM cheapest_pricing
      WHERE cruise_id = '2190299'
    `);

    if (pricingResult.rows.length > 0) {
      const pricing = pricingResult.rows[0];
      console.log('\n📋 CHEAPEST_PRICING TABLE:');
      console.log('-------------------------');
      console.log('  Interior:  $' + pricing.interior_price);
      console.log('  Oceanview: $' + pricing.oceanview_price);
      console.log('  Balcony:   $' + pricing.balcony_price);
      console.log('  Suite:     $' + pricing.suite_price);
      console.log('  Cheapest:  $' + pricing.cheapest_price);
      console.log('  Last Updated:', new Date(pricing.last_updated).toLocaleString());
    } else {
      console.log('\n⚠️  No entry in cheapest_pricing table');
    }

    console.log('\n' + '=' .repeat(50));
    console.log('\n📌 WEBSITE STATUS:');
    console.log('------------------');
    console.log('URL: https://www.zipsea.com/cruise/anthem-of-the-seas-2026-07-13-2190299');
    console.log('\nIf the website still shows old prices ($522 for interior):');
    console.log('1. ✅ Database has correct prices');
    console.log('2. ⚠️  Issue is likely caching:');
    console.log('   - CDN cache (Cloudflare)');
    console.log('   - Browser cache');
    console.log('   - Next.js static generation cache');
    console.log('   - API response cache');
    console.log('\n🔄 RECOMMENDED ACTIONS:');
    console.log('1. Clear Cloudflare cache for this URL');
    console.log('2. Check in incognito/private browser mode');
    console.log('3. Redeploy frontend to regenerate static pages');
    console.log('4. Check if API at api.zipsea.com needs restart');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

verifyCruise();
