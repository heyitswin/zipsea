/**
 * EMERGENCY FIX for critical pricing errors
 * Some cruises showing 5% of actual price due to corrupted raw_data
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prodUrl = process.env.DATABASE_URL_PRODUCTION || 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';
const sql = postgres(prodUrl, { ssl: { rejectUnauthorized: false } });

async function main() {
  const args = process.argv.slice(2);
  const EXECUTE = args.includes('--execute');

  console.log('=' .repeat(80));
  console.log('🚨 EMERGENCY PRICING FIX');
  console.log('=' .repeat(80));
  console.log('Mode:', EXECUTE ? '⚠️  EXECUTE MODE' : '🔍 DRY RUN');
  console.log();

  try {
    // Get ALL cruises under $100 that might be corrupted
    console.log('Finding potentially corrupted cruises...\n');

    const cruises = await sql`
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
        sailing_date,
        raw_data
      FROM cruises
      WHERE cheapest_price::decimal < 100
      AND is_active = true
      ORDER BY cheapest_price::decimal ASC
    `;

    console.log(`Checking ${cruises.length} cruises under $100...\n`);

    let totalCorrupted = 0;
    let totalFixed = 0;
    const criticalFixes = [];

    for (const cruise of cruises) {
      const rd = cruise.raw_data;

      // Check if this is the string-with-properties corruption
      if (typeof rd === 'string' && rd['0'] !== undefined) {
        totalCorrupted++;

        // Reconstruct the actual JSON
        let reconstructed = '';
        let i = 0;
        while (rd[i.toString()] !== undefined && i < 10000000) {
          reconstructed += rd[i.toString()];
          i++;
        }

        try {
          const fixedData = JSON.parse(reconstructed);

          // Extract real prices
          let realPrices = {
            interior: fixedData.cheapestinside ? parseFloat(fixedData.cheapestinside) : null,
            oceanview: fixedData.cheapestoutside ? parseFloat(fixedData.cheapestoutside) : null,
            balcony: fixedData.cheapestbalcony ? parseFloat(fixedData.cheapestbalcony) : null,
            suite: fixedData.cheapestsuite ? parseFloat(fixedData.cheapestsuite) : null
          };

          // Also check cheapest.prices
          if (fixedData.cheapest?.prices) {
            if (!realPrices.interior && fixedData.cheapest.prices.inside) {
              realPrices.interior = parseFloat(fixedData.cheapest.prices.inside);
            }
            if (!realPrices.oceanview && fixedData.cheapest.prices.outside) {
              realPrices.oceanview = parseFloat(fixedData.cheapest.prices.outside);
            }
            if (!realPrices.balcony && fixedData.cheapest.prices.balcony) {
              realPrices.balcony = parseFloat(fixedData.cheapest.prices.balcony);
            }
            if (!realPrices.suite && fixedData.cheapest.prices.suite) {
              realPrices.suite = parseFloat(fixedData.cheapest.prices.suite);
            }
          }

          // Handle Riviera Travel
          if (cruise.cruise_line_id === 329) {
            Object.keys(realPrices).forEach(key => {
              if (realPrices[key]) realPrices[key] = realPrices[key] / 1000;
            });
          }

          // Calculate real cheapest
          const validPrices = Object.values(realPrices).filter(p => p && p > 0);
          const realCheapest = validPrices.length > 0 ? Math.min(...validPrices) : null;

          if (realCheapest) {
            const currentPrice = parseFloat(cruise.cheapest_price);
            const priceDiff = realCheapest - currentPrice;
            const pctError = ((priceDiff / realCheapest) * 100);

            console.log(`${cruise.id}: ${cruise.name}`);
            console.log(`  Current: $${currentPrice.toFixed(2)}, Should be: $${realCheapest.toFixed(2)}`);

            if (pctError > 10) {
              console.log(`  🚨 CRITICAL: ${pctError.toFixed(1)}% too low!`);

              criticalFixes.push({
                id: cruise.id,
                name: cruise.name,
                sailing: cruise.sailing_date,
                current: currentPrice,
                correct: realCheapest,
                errorPct: pctError.toFixed(1)
              });
            }

            if (EXECUTE) {
              // Update with correct data
              await sql`
                UPDATE cruises
                SET
                  raw_data = ${fixedData}::jsonb,
                  interior_price = ${realPrices.interior?.toString() || null},
                  oceanview_price = ${realPrices.oceanview?.toString() || null},
                  balcony_price = ${realPrices.balcony?.toString() || null},
                  suite_price = ${realPrices.suite?.toString() || null},
                  cheapest_price = ${realCheapest.toString()},
                  updated_at = CURRENT_TIMESTAMP
                WHERE id = ${cruise.id}
              `;
              console.log(`  ✅ FIXED`);
              totalFixed++;
            }
          }
        } catch (e) {
          console.log(`❌ Failed to fix ${cruise.id}: ${e.message}`);
        }
      }
    }

    // Report
    console.log();
    console.log('=' .repeat(80));
    console.log('🚨 EMERGENCY FIX SUMMARY');
    console.log('=' .repeat(80));
    console.log(`Total cruises checked: ${cruises.length}`);
    console.log(`Total with corrupted data: ${totalCorrupted}`);
    console.log(`Total with critical pricing errors: ${criticalFixes.length}`);
    console.log(`Total ${EXECUTE ? 'FIXED' : 'TO FIX'}: ${EXECUTE ? totalFixed : criticalFixes.length}`);

    if (criticalFixes.length > 0) {
      console.log('\n🚨 CRITICAL PRICING ERRORS:');
      const sorted = criticalFixes.sort((a, b) => parseFloat(b.errorPct) - parseFloat(a.errorPct));
      for (const fix of sorted) {
        console.log(`  ${fix.id}: $${fix.current.toFixed(2)} → $${fix.correct.toFixed(2)} (${fix.errorPct}% error)`);
        console.log(`    ${fix.name} - ${new Date(fix.sailing).toISOString().split('T')[0]}`);
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
