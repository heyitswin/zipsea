const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function validateDisneyFix() {
  console.log('🔍 Validating Disney Cruise Line price accuracy after fix...\n');

  try {
    // Get Disney Cruise Line ID
    const lineResult = await pool.query(
      `SELECT id, name FROM cruise_lines WHERE LOWER(name) LIKE '%disney%'`
    );

    if (lineResult.rows.length === 0) {
      console.log('❌ Disney Cruise Line not found');
      return;
    }

    const disneyLine = lineResult.rows[0];
    console.log(`Found: ${disneyLine.name} (ID: ${disneyLine.id})\n`);

    // Get 50 recent Disney cruises with their prices
    const cruisesResult = await pool.query(`
      SELECT
        c.id,
        c.cruise_id,
        c.name,
        c.raw_data,
        cp.interior_price,
        cp.oceanview_price,
        cp.balcony_price,
        cp.suite_price,
        c.updated_at
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE c.cruise_line_id = $1
        AND c.raw_data IS NOT NULL
        AND c.updated_at > CURRENT_DATE - INTERVAL '30 days'
      ORDER BY c.updated_at DESC
      LIMIT 50
    `, [disneyLine.id]);

    console.log(`Analyzing ${cruisesResult.rows.length} Disney cruises:\n`);

    let correctCount = 0;
    let mismatchCount = 0;
    let corruptedCount = 0;
    let noDataCount = 0;

    for (const cruise of cruisesResult.rows) {
      const rawData = cruise.raw_data;

      // Check if data is still corrupted
      const keys = Object.keys(rawData);
      const hasNumericKeys = keys.some(key => /^\d+$/.test(key));

      if (hasNumericKeys) {
        corruptedCount++;
        console.log(`❌ Cruise ${cruise.cruise_id} still has corrupted data`);
        continue;
      }

      // Extract prices from raw_data
      let jsonPrices = {};

      // Priority 1: Top-level cheapest fields
      if (rawData.cheapestinside || rawData.cheapestoutside ||
          rawData.cheapestbalcony || rawData.cheapestsuite) {
        jsonPrices.interior = parseFloat(String(rawData.cheapestinside || '0').replace(/[^0-9.-]/g, '')) || null;
        jsonPrices.oceanview = parseFloat(String(rawData.cheapestoutside || '0').replace(/[^0-9.-]/g, '')) || null;
        jsonPrices.balcony = parseFloat(String(rawData.cheapestbalcony || '0').replace(/[^0-9.-]/g, '')) || null;
        jsonPrices.suite = parseFloat(String(rawData.cheapestsuite || '0').replace(/[^0-9.-]/g, '')) || null;
      }
      // Priority 2: cheapest.combined
      else if (rawData.cheapest && rawData.cheapest.combined) {
        jsonPrices.interior = parseFloat(String(rawData.cheapest.combined.inside || '0').replace(/[^0-9.-]/g, '')) || null;
        jsonPrices.oceanview = parseFloat(String(rawData.cheapest.combined.outside || '0').replace(/[^0-9.-]/g, '')) || null;
        jsonPrices.balcony = parseFloat(String(rawData.cheapest.combined.balcony || '0').replace(/[^0-9.-]/g, '')) || null;
        jsonPrices.suite = parseFloat(String(rawData.cheapest.combined.suite || '0').replace(/[^0-9.-]/g, '')) || null;
      }
      // Priority 3: cheapest.prices
      else if (rawData.cheapest && rawData.cheapest.prices) {
        jsonPrices.interior = parseFloat(String(rawData.cheapest.prices.inside || '0').replace(/[^0-9.-]/g, '')) || null;
        jsonPrices.oceanview = parseFloat(String(rawData.cheapest.prices.outside || '0').replace(/[^0-9.-]/g, '')) || null;
        jsonPrices.balcony = parseFloat(String(rawData.cheapest.prices.balcony || '0').replace(/[^0-9.-]/g, '')) || null;
        jsonPrices.suite = parseFloat(String(rawData.cheapest.prices.suite || '0').replace(/[^0-9.-]/g, '')) || null;
      } else {
        noDataCount++;
        continue;
      }

      // Compare prices
      const dbPrices = {
        interior: cruise.interior_price ? parseFloat(cruise.interior_price) : null,
        oceanview: cruise.oceanview_price ? parseFloat(cruise.oceanview_price) : null,
        balcony: cruise.balcony_price ? parseFloat(cruise.balcony_price) : null,
        suite: cruise.suite_price ? parseFloat(cruise.suite_price) : null
      };

      const mismatch =
        dbPrices.interior != jsonPrices.interior ||
        dbPrices.oceanview != jsonPrices.oceanview ||
        dbPrices.balcony != jsonPrices.balcony ||
        dbPrices.suite != jsonPrices.suite;

      if (mismatch) {
        mismatchCount++;
        console.log(`❌ Mismatch for ${cruise.cruise_id}: ${cruise.name}`);
        console.log(`   DB:   Interior=$${dbPrices.interior}, Ocean=$${dbPrices.oceanview}, Balcony=$${dbPrices.balcony}, Suite=$${dbPrices.suite}`);
        console.log(`   JSON: Interior=$${jsonPrices.interior}, Ocean=$${jsonPrices.oceanview}, Balcony=$${jsonPrices.balcony}, Suite=$${jsonPrices.suite}`);
      } else {
        correctCount++;
      }
    }

    // Summary
    const totalValidated = correctCount + mismatchCount;
    const accuracy = totalValidated > 0 ? (correctCount / totalValidated * 100).toFixed(1) : 0;

    console.log('\n' + '='.repeat(80));
    console.log('📊 DISNEY CRUISE LINE VALIDATION RESULTS:');
    console.log('='.repeat(80));
    console.log(`Total cruises analyzed: ${cruisesResult.rows.length}`);
    console.log(`Still corrupted: ${corruptedCount}`);
    console.log(`No price data: ${noDataCount}`);
    console.log(`Validated: ${totalValidated}`);
    console.log(`  ✅ Correct: ${correctCount}`);
    console.log(`  ❌ Mismatches: ${mismatchCount}`);
    console.log(`\n🎯 Accuracy: ${accuracy}% (was 34% before fix)`);

    if (accuracy >= 95) {
      console.log('\n✨ SUCCESS! Disney Cruise Line pricing is now accurate!');
    } else if (accuracy > 34) {
      console.log('\n📈 IMPROVED! But still needs more work.');
    } else {
      console.log('\n⚠️  No significant improvement detected.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

validateDisneyFix();
