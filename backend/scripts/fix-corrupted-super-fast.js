/**
 * Super fast version - checks raw_data structure without text conversion
 * Processes in smaller batches to avoid timeouts
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prodUrl =
  process.env.DATABASE_URL_PRODUCTION ||
  'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';
const sql = postgres(prodUrl, { ssl: { rejectUnauthorized: false } });

function isCharacterArray(rawData) {
  if (typeof rawData === 'object' && rawData !== null && !Array.isArray(rawData)) {
    if (rawData['0'] !== undefined && rawData['1'] !== undefined && rawData['2'] !== undefined) {
      if (typeof rawData['0'] === 'string' && rawData['0'].length === 1) {
        return true;
      }
    }
  }
  return false;
}

function reconstructJsonFromCharArray(rawData) {
  if (!isCharacterArray(rawData)) return rawData;

  let jsonString = '';
  let i = 0;
  const maxChars = 10000000;

  while (rawData[i.toString()] !== undefined && i < maxChars) {
    jsonString += rawData[i.toString()];
    i++;
  }

  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('Failed to parse reconstructed JSON');
    return null;
  }
}

function extractPrices(data, cruiseLineId) {
  const prices = {
    interior: null,
    oceanview: null,
    balcony: null,
    suite: null,
  };

  // Try direct fields first
  if (data.cheapestinside !== undefined) {
    prices.interior = parseFloat(data.cheapestinside) || null;
  }
  if (data.cheapestoutside !== undefined) {
    prices.oceanview = parseFloat(data.cheapestoutside) || null;
  }
  if (data.cheapestbalcony !== undefined) {
    prices.balcony = parseFloat(data.cheapestbalcony) || null;
  }
  if (data.cheapestsuite !== undefined) {
    prices.suite = parseFloat(data.cheapestsuite) || null;
  }

  // Try cheapest.prices if needed
  if (data.cheapest?.prices) {
    if (!prices.interior && data.cheapest.prices.inside !== undefined) {
      prices.interior = parseFloat(data.cheapest.prices.inside) || null;
    }
    if (!prices.oceanview && data.cheapest.prices.outside !== undefined) {
      prices.oceanview = parseFloat(data.cheapest.prices.outside) || null;
    }
    if (!prices.balcony && data.cheapest.prices.balcony !== undefined) {
      prices.balcony = parseFloat(data.cheapest.prices.balcony) || null;
    }
    if (!prices.suite && data.cheapest.prices.suite !== undefined) {
      prices.suite = parseFloat(data.cheapest.prices.suite) || null;
    }
  }

  // Special handling for Riviera Travel
  if (cruiseLineId === 329) {
    if (prices.interior) prices.interior = prices.interior / 1000;
    if (prices.oceanview) prices.oceanview = prices.oceanview / 1000;
    if (prices.balcony) prices.balcony = prices.balcony / 1000;
    if (prices.suite) prices.suite = prices.suite / 1000;
  }

  return prices;
}

async function main() {
  const args = process.argv.slice(2);
  const DRY_RUN = !args.includes('--execute');
  const BATCH_SIZE = 100;

  console.log('=' .repeat(80));
  console.log('SUPER FAST FIX FOR CORRUPTED RAW_DATA');
  console.log('=' .repeat(80));
  console.log('Mode:', DRY_RUN ? '🔍 DRY RUN' : '⚠️  EXECUTE MODE');
  console.log('Strategy: Process in small batches, check JSONB structure directly\n');

  let totalCorrupted = 0;
  let totalFixed = 0;
  let totalErrors = 0;
  let offset = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      console.log(`\nChecking batch starting at offset ${offset}...`);

      // Get a batch of cruises with raw_data
      const batch = await sql`
        SELECT
          id,
          cruise_id,
          name,
          cruise_line_id,
          interior_price::decimal as interior_price,
          oceanview_price::decimal as oceanview_price,
          balcony_price::decimal as balcony_price,
          suite_price::decimal as suite_price,
          cheapest_price::decimal as cheapest_price,
          raw_data,
          updated_at
        FROM cruises
        WHERE is_active = true
        AND raw_data IS NOT NULL
        ORDER BY id
        LIMIT ${BATCH_SIZE}
        OFFSET ${offset}
      `;

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`  Fetched ${batch.length} cruises`);

      // Check each cruise for corruption
      for (const cruise of batch) {
        if (isCharacterArray(cruise.raw_data)) {
          totalCorrupted++;

          console.log(`\n❌ Corrupted: Cruise ${cruise.id} (${cruise.name})`);
          console.log(`   Current price: $${cruise.cheapest_price}`);

          if (!DRY_RUN) {
            try {
              // Reconstruct the JSON
              const fixedData = reconstructJsonFromCharArray(cruise.raw_data);

              if (fixedData) {
                // Extract real prices
                const realPrices = extractPrices(fixedData, cruise.cruise_line_id);

                // Calculate cheapest
                const allPrices = [
                  realPrices.interior,
                  realPrices.oceanview,
                  realPrices.balcony,
                  realPrices.suite,
                ].filter(p => p !== null && p > 0);

                const realCheapest = allPrices.length > 0 ? Math.min(...allPrices) : null;

                // Only update if prices changed significantly
                const priceDiff = Math.abs((cruise.cheapest_price || 0) - (realCheapest || 0));
                if (priceDiff > 0.01) {
                  await sql`
                    UPDATE cruises
                    SET
                      raw_data = ${fixedData}::jsonb,
                      interior_price = ${realPrices.interior},
                      oceanview_price = ${realPrices.oceanview},
                      balcony_price = ${realPrices.balcony},
                      suite_price = ${realPrices.suite},
                      cheapest_price = ${realCheapest},
                      updated_at = CURRENT_TIMESTAMP
                    WHERE id = ${cruise.id}
                  `;

                  console.log(`   ✅ FIXED: Old price $${cruise.cheapest_price} → New price $${realCheapest}`);
                  totalFixed++;
                }
              }
            } catch (error) {
              console.error(`   ❌ ERROR fixing cruise ${cruise.id}:`, error.message);
              totalErrors++;
            }
          }
        }
      }

      // Progress update
      if (offset % 1000 === 0 && offset > 0) {
        console.log(`\n📊 Progress: Checked ${offset + batch.length} cruises, found ${totalCorrupted} corrupted`);
      }

      offset += BATCH_SIZE;

      // Small delay to avoid overloading
      if (!DRY_RUN) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Final summary
    console.log('\n' + '=' .repeat(80));
    console.log('FINAL SUMMARY:');
    console.log('=' .repeat(80));
    console.log(`Total cruises checked: ${offset}`);
    console.log(`Total corrupted found: ${totalCorrupted}`);
    if (!DRY_RUN) {
      console.log(`Total fixed: ${totalFixed}`);
      console.log(`Total errors: ${totalErrors}`);
      console.log(`Success rate: ${totalFixed > 0 ? (totalFixed/totalCorrupted*100).toFixed(1) : 0}%`);
    }

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await sql.end();
  }
}

main();
