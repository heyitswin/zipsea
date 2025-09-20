require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testFix() {
  const client = await pool.connect();

  try {
    console.log('🧪 TESTING RAW_DATA FIX ON SAMPLE CRUISES');
    console.log('=' .repeat(60));

    // Test on specific problematic cruises
    const testCruises = ['2145865', '2190299'];

    for (const cruiseId of testCruises) {
      console.log(`\n📍 Testing cruise ${cruiseId}:`);
      console.log('-' .repeat(40));

      // Get current state
      const beforeResult = await client.query(`
        SELECT
          id,
          interior_price as old_interior,
          oceanview_price as old_oceanview,
          raw_data,
          jsonb_typeof(raw_data) as raw_type
        FROM cruises
        WHERE id = $1
      `, [cruiseId]);

      if (beforeResult.rows.length === 0) {
        console.log('Cruise not found');
        continue;
      }

      const before = beforeResult.rows[0];
      console.log(`Current prices: Interior $${before.old_interior}, Oceanview $${before.old_oceanview}`);
      console.log(`Raw data type: ${before.raw_type}`);

      // Fix the data
      const corrupted = before.raw_data;
      let fixedData;
      let reconstructedChars = 0;

      try {
        // If it's a plain string, parse it
        if (typeof corrupted === 'string') {
          fixedData = JSON.parse(corrupted);
          console.log('✅ Parsed as direct JSON string');
        }
        // If it's character-by-character, reconstruct
        else if (corrupted && corrupted['0'] !== undefined) {
          const chars = [];
          let i = 0;
          while (corrupted[i.toString()] !== undefined) {
            chars.push(corrupted[i.toString()]);
            i++;
          }
          reconstructedChars = i;
          const reconstructed = chars.join('');
          fixedData = JSON.parse(reconstructed);
          console.log(`✅ Reconstructed ${reconstructedChars} characters`);
        } else {
          console.log('❌ Unknown data format');
          continue;
        }

        // Extract prices from fixed data
        console.log('\nExtracting prices from fixed data:');

        // Check top-level fields
        console.log('Top-level cheapest fields:');
        console.log(`  cheapestinside: $${fixedData.cheapestinside || 'NOT FOUND'}`);
        console.log(`  cheapestoutside: $${fixedData.cheapestoutside || 'NOT FOUND'}`);
        console.log(`  cheapestbalcony: $${fixedData.cheapestbalcony || 'NOT FOUND'}`);
        console.log(`  cheapestsuite: $${fixedData.cheapestsuite || 'NOT FOUND'}`);

        // Check cheapest.combined
        if (fixedData.cheapest?.combined) {
          console.log('Cheapest.combined fields:');
          console.log(`  inside: $${fixedData.cheapest.combined.inside || 'NOT FOUND'}`);
          console.log(`  outside: $${fixedData.cheapest.combined.outside || 'NOT FOUND'}`);
          console.log(`  balcony: $${fixedData.cheapest.combined.balcony || 'NOT FOUND'}`);
          console.log(`  suite: $${fixedData.cheapest.combined.suite || 'NOT FOUND'}`);
        }

        // Determine which prices to use
        let newPrices = {
          interior: null,
          oceanview: null,
          balcony: null,
          suite: null
        };

        // For cruise 2145865, top-level fields have correct prices
        // For cruise 2190299, we want the cheapest.combined prices
        if (cruiseId === '2145865') {
          // Use top-level fields (correct prices)
          if (fixedData.cheapestinside) newPrices.interior = parseFloat(fixedData.cheapestinside);
          if (fixedData.cheapestoutside) newPrices.oceanview = parseFloat(fixedData.cheapestoutside);
          if (fixedData.cheapestbalcony) newPrices.balcony = parseFloat(fixedData.cheapestbalcony);
          if (fixedData.cheapestsuite) newPrices.suite = parseFloat(fixedData.cheapestsuite);
          console.log('\n✅ Using top-level cheapest fields for pricing');
        } else {
          // For other cruises, check which source has valid prices
          const hasTopLevel = fixedData.cheapestinside || fixedData.cheapestoutside;
          const hasCombined = fixedData.cheapest?.combined?.inside || fixedData.cheapest?.combined?.outside;

          if (hasTopLevel) {
            if (fixedData.cheapestinside) newPrices.interior = parseFloat(fixedData.cheapestinside);
            if (fixedData.cheapestoutside) newPrices.oceanview = parseFloat(fixedData.cheapestoutside);
            if (fixedData.cheapestbalcony) newPrices.balcony = parseFloat(fixedData.cheapestbalcony);
            if (fixedData.cheapestsuite) newPrices.suite = parseFloat(fixedData.cheapestsuite);
            console.log('\n✅ Using top-level cheapest fields for pricing');
          } else if (hasCombined) {
            if (fixedData.cheapest.combined.inside) newPrices.interior = parseFloat(fixedData.cheapest.combined.inside);
            if (fixedData.cheapest.combined.outside) newPrices.oceanview = parseFloat(fixedData.cheapest.combined.outside);
            if (fixedData.cheapest.combined.balcony) newPrices.balcony = parseFloat(fixedData.cheapest.combined.balcony);
            if (fixedData.cheapest.combined.suite) newPrices.suite = parseFloat(fixedData.cheapest.combined.suite);
            console.log('\n✅ Using cheapest.combined fields for pricing');
          }
        }

        console.log('\nProposed new prices:');
        console.log(`  Interior: $${newPrices.interior || 'NO CHANGE'}`);
        console.log(`  Oceanview: $${newPrices.oceanview || 'NO CHANGE'}`);
        console.log(`  Balcony: $${newPrices.balcony || 'NO CHANGE'}`);
        console.log(`  Suite: $${newPrices.suite || 'NO CHANGE'}`);

        // Show what would be updated
        console.log('\n📝 Update summary:');
        console.log(`  Raw data: Will be stored as proper JSON object`);
        console.log(`  Size reduction: ~${reconstructedChars > 0 ? Math.round((1 - (JSON.stringify(fixedData).length / reconstructedChars)) * 100) : 0}%`);
        if (newPrices.interior) console.log(`  Interior: $${before.old_interior} → $${newPrices.interior}`);
        if (newPrices.oceanview) console.log(`  Oceanview: $${before.old_oceanview} → $${newPrices.oceanview}`);

      } catch (e) {
        console.log(`❌ Error: ${e.message}`);
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log('\n✅ TEST COMPLETE');
    console.log('The fix would:');
    console.log('1. Convert character-by-character storage to proper JSON');
    console.log('2. Update prices to correct values from raw_data');
    console.log('3. Reduce storage size significantly');
    console.log('\nRun fix-all-corrupted-rawdata.js to apply to all cruises');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

testFix();
