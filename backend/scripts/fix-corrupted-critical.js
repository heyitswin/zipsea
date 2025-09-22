/**
 * CRITICAL FIX: Corrupted raw_data causing wrong prices
 * Some cruises showing $14 when they should be $275+
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prodUrl = process.env.DATABASE_URL_PRODUCTION || 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';
const sql = postgres(prodUrl, { ssl: { rejectUnauthorized: false } });

function reconstructFromCharArray(rawData) {
  // rawData comes already parsed as an object from postgres
  if (typeof rawData !== 'object' || !rawData['0']) {
    return null; // Not corrupted
  }

  let jsonStr = '';
  let i = 0;
  const maxChars = 10000000;

  while (rawData[i.toString()] !== undefined && i < maxChars) {
    jsonStr += rawData[i.toString()];
    i++;
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse reconstructed JSON:', e.message);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const EXECUTE = args.includes('--execute');

  console.log('=' .repeat(80));
  console.log('🚨 CRITICAL FIX: CORRUPTED PRICES');
  console.log('=' .repeat(80));
  console.log('Mode:', EXECUTE ? '⚠️  EXECUTE MODE' : '🔍 DRY RUN');
  console.log();

  try {
    // Get ALL cruises under $100 (likely corrupted)
    const suspiciousCruises = await sql`
      SELECT
        id,
        cruise_id,
        name,
        cruise_line_id,
        cheapest_price,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        raw_data,
        sailing_date
      FROM cruises
      WHERE cheapest_price::decimal < 100
      AND is_active = true
      ORDER BY cheapest_price::decimal ASC
    `;

    console.log(`Found ${suspiciousCruises.length} cruises under $100 to check\n`);

    let totalCorrupted = 0;
    let totalFixed = 0;
    const criticalFixes = [];

    for (const cruise of suspiciousCruises) {
      // Check if raw_data is corrupted
      const reconstructed = reconstructFromCharArray(cruise.raw_data);

      if (reconstructed) {
        totalCorrupted++;

        // Extract real prices
        let realPrices = {
          interior: null,
          oceanview: null,
          balcony: null,
          suite: null
        };

        // Get prices from reconstructed data
        if (reconstructed.cheapestinside) {
          realPrices.interior = parseFloat(reconstructed.cheapestinside);
        }
        if (reconstructed.cheapestoutside) {
          realPrices.oceanview = parseFloat(reconstructed.cheapestoutside);
        }
        if (reconstructed.cheapestbalcony) {
          realPrices.balcony = parseFloat(reconstructed.cheapestbalcony);
        }
        if (reconstructed.cheapestsuite) {
          realPrices.suite = parseFloat(reconstructed.cheapestsuite);
        }

        // Also check cheapest.prices if available
        if (reconstructed.cheapest?.prices) {
          if (!realPrices.interior && reconstructed.cheapest.prices.inside) {
            realPrices.interior = parseFloat(reconstructed.cheapest.prices.inside);
          }
          if (!realPrices.oceanview && reconstructed.cheapest.prices.outside) {
            realPrices.oceanview = parseFloat(reconstructed.cheapest.prices.outside);
          }
          if (!realPrices.balcony && reconstructed.cheapest.prices.balcony) {
            realPrices.balcony = parseFloat(reconstructed.cheapest.prices.balcony);
          }
          if (!realPrices.suite && reconstructed.cheapest.prices.suite) {
            realPrices.suite = parseFloat(reconstructed.cheapest.prices.suite);
          }
        }

        // Handle Riviera Travel special case
        if (cruise.cruise_line_id === 329) {
          if (realPrices.interior) realPrices.interior = realPrices.interior / 1000;
          if (realPrices.oceanview) realPrices.oceanview = realPrices.oceanview / 1000;
          if (realPrices.balcony) realPrices.balcony = realPrices.balcony / 1000;
          if (realPrices.suite) realPrices.suite = realPrices.suite / 1000;
        }

        // Calculate real cheapest
        const validPrices = Object.values(realPrices).filter(p => p && p > 0);
        const realCheapest = validPrices.length > 0 ? Math.min(...validPrices) : null;

        if (realCheapest && realCheapest > parseFloat(cruise.cheapest_price)) {
          const priceDiff = realCheapest - parseFloat(cruise.cheapest_price);
          const pctError = ((priceDiff / realCheapest) * 100).toFixed(1);

          console.log(`\n🚨 CRITICAL: ${cruise.id} - ${cruise.name}`);
          console.log(`  Showing: $${cruise.cheapest_price}`);
          console.log(`  Should be: $${realCheapest.toFixed(2)}`);
          console.log(`  ERROR: ${pctError}% too low!`);
          console.log(`  Sailing: ${new Date(cruise.sailing_date).toISOString().split('T')[0]}`);

          criticalFixes.push({
            id: cruise.id,
            name: cruise.name,
            current: cruise.cheapest_price,
            correct: realCheapest,
            errorPct: pctError
          });

          if (EXECUTE) {
            // Fix the database
            await sql`
              UPDATE cruises
              SET
                raw_data = ${JSON.stringify(reconstructed)}::jsonb,
                interior_price = ${realPrices.interior?.toString() || null},
                oceanview_price = ${realPrices.oceanview?.toString() || null},
                balcony_price = ${realPrices.balcony?.toString() || null},
                suite_price = ${realPrices.suite?.toString() || null},
                cheapest_price = ${realCheapest.toString()},
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ${cruise.id}
            `;
            console.log(`  ✅ FIXED!`);
            totalFixed++;
          }
        }
      }
    }

    // Summary
    console.log();
    console.log('=' .repeat(80));
    console.log('🚨 CRITICAL SUMMARY');
    console.log('=' .repeat(80));
    console.log(`Total cruises checked: ${suspiciousCruises.length}`);
    console.log(`Total with corrupted data: ${totalCorrupted}`);
    console.log(`Total with wrong prices: ${criticalFixes.length}`);
    console.log(`Total ${EXECUTE ? 'FIXED' : 'TO FIX'}: ${EXECUTE ? totalFixed : criticalFixes.length}`);

    if (criticalFixes.length > 0) {
      console.log('\nMOST SEVERE ERRORS:');
      const sorted = criticalFixes.sort((a, b) => parseFloat(b.errorPct) - parseFloat(a.errorPct));
      for (const fix of sorted.slice(0, 10)) {
        console.log(`  ${fix.id}: Was $${fix.current}, Should be $${fix.correct.toFixed(2)} (${fix.errorPct}% error)`);
      }
    }

    if (!EXECUTE && criticalFixes.length > 0) {
      console.log('\n⚠️  RUN WITH --execute TO FIX THESE CRITICAL PRICING ERRORS!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
