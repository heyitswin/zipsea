const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function investigateDisneyPrices() {
  console.log('🔍 Investigating Disney Cruise Line pricing issues...\n');

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

    // Get 10 recent Disney cruises with their prices
    const cruisesResult = await pool.query(
      `
      SELECT
        c.id,
        c.cruise_id,
        c.name,
        c.raw_data,
        cp.interior_price as interior,
        cp.oceanview_price as oceanview,
        cp.balcony_price as balcony,
        cp.suite_price as suite,
        c.updated_at
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE c.cruise_line_id = $1
        AND c.raw_data IS NOT NULL
        AND c.updated_at > CURRENT_DATE - INTERVAL '7 days'
      ORDER BY c.updated_at DESC
      LIMIT 10
    `,
      [disneyLine.id]
    );

    console.log(`Analyzing ${cruisesResult.rows.length} Disney cruises:\n`);

    let patterns = {
      hasTopLevel: 0,
      hasCheapestCombined: 0,
      hasCheapestPrices: 0,
      hasCheapest: 0,
      hasOtherStructure: 0,
      mismatchCount: 0,
    };

    for (const cruise of cruisesResult.rows) {
      console.log(`\n📊 Cruise ${cruise.cruise_id}: ${cruise.name}`);
      console.log(
        `DB Prices: Interior=$${cruise.interior}, Ocean=$${cruise.oceanview}, Balcony=$${cruise.balcony}, Suite=$${cruise.suite}`
      );

      const rawData = cruise.raw_data;

      // Check what price structures exist
      if (
        rawData.cheapestinside ||
        rawData.cheapestoutside ||
        rawData.cheapestbalcony ||
        rawData.cheapestsuite
      ) {
        patterns.hasTopLevel++;
        console.log('✅ Has top-level price fields:');
        console.log(`   cheapestinside: ${rawData.cheapestinside || 'null'}`);
        console.log(`   cheapestoutside: ${rawData.cheapestoutside || 'null'}`);
        console.log(`   cheapestbalcony: ${rawData.cheapestbalcony || 'null'}`);
        console.log(`   cheapestsuite: ${rawData.cheapestsuite || 'null'}`);
      }

      if (rawData.cheapest) {
        patterns.hasCheapest++;
        console.log('📦 Has cheapest object:');

        if (rawData.cheapest.combined) {
          patterns.hasCheapestCombined++;
          console.log('   Has cheapest.combined:');
          console.log(`     inside: ${rawData.cheapest.combined.inside || 'null'}`);
          console.log(`     outside: ${rawData.cheapest.combined.outside || 'null'}`);
          console.log(`     balcony: ${rawData.cheapest.combined.balcony || 'null'}`);
          console.log(`     suite: ${rawData.cheapest.combined.suite || 'null'}`);
        }

        if (rawData.cheapest.prices) {
          patterns.hasCheapestPrices++;
          console.log('   Has cheapest.prices:');
          console.log(`     inside: ${rawData.cheapest.prices.inside || 'null'}`);
          console.log(`     outside: ${rawData.cheapest.prices.outside || 'null'}`);
          console.log(`     balcony: ${rawData.cheapest.prices.balcony || 'null'}`);
          console.log(`     suite: ${rawData.cheapest.prices.suite || 'null'}`);
        }

        // Check for other structures
        if (
          rawData.cheapest.inside ||
          rawData.cheapest.outside ||
          rawData.cheapest.balcony ||
          rawData.cheapest.suite
        ) {
          console.log('   Has direct cheapest fields:');
          console.log(`     inside: ${rawData.cheapest.inside || 'null'}`);
          console.log(`     outside: ${rawData.cheapest.outside || 'null'}`);
          console.log(`     balcony: ${rawData.cheapest.balcony || 'null'}`);
          console.log(`     suite: ${rawData.cheapest.suite || 'null'}`);
        }
      }

      // Check for other potential price locations
      if (rawData.price || rawData.prices || rawData.pricing) {
        patterns.hasOtherStructure++;
        console.log('🔍 Other potential price fields:');
        if (rawData.price)
          console.log(`   price: ${JSON.stringify(rawData.price).substring(0, 200)}`);
        if (rawData.prices)
          console.log(`   prices: ${JSON.stringify(rawData.prices).substring(0, 200)}`);
        if (rawData.pricing)
          console.log(`   pricing: ${JSON.stringify(rawData.pricing).substring(0, 200)}`);
      }

      // Try to extract correct prices using current logic
      let extractedPrices = {};

      // Priority 1: Top-level fields
      if (
        rawData.cheapestinside ||
        rawData.cheapestoutside ||
        rawData.cheapestbalcony ||
        rawData.cheapestsuite
      ) {
        extractedPrices.interior =
          parseFloat(String(rawData.cheapestinside || '0').replace(/[^0-9.-]/g, '')) || null;
        extractedPrices.oceanview =
          parseFloat(String(rawData.cheapestoutside || '0').replace(/[^0-9.-]/g, '')) || null;
        extractedPrices.balcony =
          parseFloat(String(rawData.cheapestbalcony || '0').replace(/[^0-9.-]/g, '')) || null;
        extractedPrices.suite =
          parseFloat(String(rawData.cheapestsuite || '0').replace(/[^0-9.-]/g, '')) || null;
      }
      // Priority 2: cheapest.combined
      else if (rawData.cheapest && rawData.cheapest.combined) {
        extractedPrices.interior =
          parseFloat(String(rawData.cheapest.combined.inside || '0').replace(/[^0-9.-]/g, '')) ||
          null;
        extractedPrices.oceanview =
          parseFloat(String(rawData.cheapest.combined.outside || '0').replace(/[^0-9.-]/g, '')) ||
          null;
        extractedPrices.balcony =
          parseFloat(String(rawData.cheapest.combined.balcony || '0').replace(/[^0-9.-]/g, '')) ||
          null;
        extractedPrices.suite =
          parseFloat(String(rawData.cheapest.combined.suite || '0').replace(/[^0-9.-]/g, '')) ||
          null;
      }
      // Priority 3: cheapest.prices
      else if (rawData.cheapest && rawData.cheapest.prices) {
        extractedPrices.interior =
          parseFloat(String(rawData.cheapest.prices.inside || '0').replace(/[^0-9.-]/g, '')) ||
          null;
        extractedPrices.oceanview =
          parseFloat(String(rawData.cheapest.prices.outside || '0').replace(/[^0-9.-]/g, '')) ||
          null;
        extractedPrices.balcony =
          parseFloat(String(rawData.cheapest.prices.balcony || '0').replace(/[^0-9.-]/g, '')) ||
          null;
        extractedPrices.suite =
          parseFloat(String(rawData.cheapest.prices.suite || '0').replace(/[^0-9.-]/g, '')) || null;
      }

      console.log(
        `\n🔧 Extracted prices: Interior=$${extractedPrices.interior}, Ocean=$${extractedPrices.oceanview}, Balcony=$${extractedPrices.balcony}, Suite=$${extractedPrices.suite}`
      );

      // Check for mismatches
      const mismatch =
        cruise.interior != extractedPrices.interior ||
        cruise.oceanview != extractedPrices.oceanview ||
        cruise.balcony != extractedPrices.balcony ||
        cruise.suite != extractedPrices.suite;

      if (mismatch) {
        patterns.mismatchCount++;
        console.log('❌ MISMATCH DETECTED!');
      } else {
        console.log('✅ Prices match!');
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 DISNEY CRUISE LINE PATTERN ANALYSIS:');
    console.log('='.repeat(80));
    console.log(`Total cruises analyzed: ${cruisesResult.rows.length}`);
    console.log(
      `Mismatches found: ${patterns.mismatchCount} (${((patterns.mismatchCount / cruisesResult.rows.length) * 100).toFixed(1)}%)`
    );
    console.log('\nData structure patterns:');
    console.log(`  Has top-level fields: ${patterns.hasTopLevel}`);
    console.log(`  Has cheapest object: ${patterns.hasCheapest}`);
    console.log(`  Has cheapest.combined: ${patterns.hasCheapestCombined}`);
    console.log(`  Has cheapest.prices: ${patterns.hasCheapestPrices}`);
    console.log(`  Has other price structures: ${patterns.hasOtherStructure}`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

investigateDisneyPrices();
