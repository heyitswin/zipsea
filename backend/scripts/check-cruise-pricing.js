require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

const cruiseId = '2106593'; // harmony-of-the-seas-2026-03-01

const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
const isProduction = databaseUrl && databaseUrl.includes('render.com');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

async function checkPricing() {
  try {
    console.log('🔍 Checking pricing for cruise:', cruiseId);
    console.log('');

    // Get cruise details and cached pricing
    const query = `
      SELECT 
        c.id,
        c.name,
        c.sailing_date,
        c.nights,
        c.cruise_line_id,
        cp.interior_price,
        cp.oceanview_price,
        cp.balcony_price,
        cp.suite_price,
        cp.cheapest_price
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.id = $1
    `;

    const result = await pool.query(query, [cruiseId]);

    if (result.rows.length === 0) {
      console.log('❌ Cruise not found in database');
      await pool.end();
      return;
    }

    const cruise = result.rows[0];

    console.log('📊 DATABASE CACHED PRICING:');
    console.log('════════════════════════════════════════');
    console.log(`Cruise: ${cruise.name}`);
    console.log(`Sailing Date: ${cruise.sailing_date}`);
    console.log(`Nights: ${cruise.nights}`);
    console.log('');
    console.log('Raw pricing data:', cruise);
    console.log('');
    console.log('Cached Prices (for 2 adults):');
    console.log(`  Interior:   $${cruise.interior_price ? parseFloat(cruise.interior_price).toFixed(2) : 'N/A'}`);
    console.log(`  Oceanview:  $${cruise.oceanview_price ? parseFloat(cruise.oceanview_price).toFixed(2) : 'N/A'}`);
    console.log(`  Balcony:    $${cruise.balcony_price ? parseFloat(cruise.balcony_price).toFixed(2) : 'N/A'}`);
    console.log(`  Suite:      $${cruise.suite_price ? parseFloat(cruise.suite_price).toFixed(2) : 'N/A'}`);
    console.log(`  Cheapest:   $${cruise.cheapest_price ? parseFloat(cruise.cheapest_price).toFixed(2) : 'N/A'}`);
    console.log('');

    console.log('💰 LIVE PRICING FROM FRONTEND (when 3+ guests selected):');
    console.log('════════════════════════════════════════');
    console.log('Interior Guaranteed: $1,635.34 (for 2 guests)');
    console.log('Interior (4V):       $1,790.34 (for 2 guests)');
    console.log('Interior w/ VB:      $1,846.34 (for 2 guests)');
    console.log('');

    console.log('📈 COMPARISON:');
    console.log('════════════════════════════════════════');
    const liveCheapest = 1635.34;
    const cachedCheapest = cruise.cheapest_price ? parseFloat(cruise.cheapest_price) : (cruise.interior_price ? parseFloat(cruise.interior_price) : 0);
    const difference = liveCheapest - cachedCheapest;
    const percentDiff = cachedCheapest ? ((difference / cachedCheapest) * 100).toFixed(2) : 'N/A';

    console.log(`Cached Cheapest:  $${cachedCheapest.toFixed(2)}`);
    console.log(`Live Cheapest:    $${liveCheapest.toFixed(2)}`);
    console.log(`Difference:       $${difference.toFixed(2)} (${percentDiff}%)`);
    console.log('');

    if (Math.abs(difference) < 50) {
      console.log('✅ Prices are very close (within $50)');
    } else if (Math.abs(difference) < 200) {
      console.log('⚠️  Moderate difference ($50-$200)');
    } else {
      console.log('❌ Significant difference (>$200)');
    }
    console.log('');

    console.log('🐛 CRITICAL BUG - 2 GUESTS SHOWS NO CABINS:');
    console.log('════════════════════════════════════════');
    console.log('Issue: Setting 2 guests shows NO cabins');
    console.log('       Setting 3 or 4 guests DOES show cabins');
    console.log('');
    console.log('This suggests a session or API parameter issue with adults=2');
    console.log('Need to check:');
    console.log('  1. Session creation with adults=2');
    console.log('  2. getCabinGrades API call parameters');
    console.log('  3. Traveltek API response with adults=2');
    console.log('  4. Check Render logs for actual API calls');

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkPricing();
