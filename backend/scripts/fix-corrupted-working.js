/**
 * WORKING VERSION - Handles raw_data coming back as string type
 * PostgreSQL returns corrupted JSONB as string when it has character arrays
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const sql = postgres(dbUrl, {
  ssl: { rejectUnauthorized: false },
  max: 5,
  idle_timeout: 20,
  connect_timeout: 30
});

function isCharacterArray(rawData) {
  // Handle both string and object types
  let dataToCheck = rawData;

  // If it's a string, try to parse it first
  if (typeof rawData === 'string') {
    try {
      dataToCheck = JSON.parse(rawData);
    } catch (e) {
      // If can't parse, it's not JSON
      return false;
    }
  }

  // Now check if it has the character array pattern
  if (typeof dataToCheck === 'object' && dataToCheck !== null && !Array.isArray(dataToCheck)) {
    if (dataToCheck['0'] !== undefined && dataToCheck['1'] !== undefined && dataToCheck['2'] !== undefined) {
      if (typeof dataToCheck['0'] === 'string' && dataToCheck['0'].length === 1) {
        return true;
      }
    }
  }
  return false;
}

function reconstructJsonFromCharArray(rawData) {
  // Handle both string and object types
  let dataToProcess = rawData;

  // If it's a string, parse it first
  if (typeof rawData === 'string') {
    try {
      dataToProcess = JSON.parse(rawData);
    } catch (e) {
      return null;
    }
  }

  if (!isCharacterArray(rawData)) {
    return dataToProcess;
  }

  // Reconstruct the JSON string from character array
  let jsonString = '';
  let i = 0;
  const maxChars = 10000000;

  while (dataToProcess[i.toString()] !== undefined && i < maxChars) {
    jsonString += dataToProcess[i.toString()];
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
  const BATCH_SIZE = 50;
  const TEST_MODE = args.includes('--test');

  console.log('=' .repeat(80));
  console.log('WORKING FIX FOR CORRUPTED RAW_DATA');
  console.log('=' .repeat(80));
  console.log('Mode:', DRY_RUN ? '🔍 DRY RUN' : '⚠️  EXECUTE MODE');
  if (TEST_MODE) console.log('TEST MODE: Processing only 5 batches');
  console.log('Strategy: Handle raw_data as both string and object types\n');

  let totalCorrupted = 0;
  let totalFixed = 0;
  let totalErrors = 0;
  let offset = 0;
  let hasMore = true;
  let batchCount = 0;

  try {
    // First test connection
    console.log('Testing database connection...');
    const test = await sql`SELECT COUNT(*) as count FROM cruises LIMIT 1`;
    console.log(`✅ Connected! Found ${test[0].count} total cruises\n`);

    while (hasMore) {
      console.log(`\nBatch ${batchCount + 1} - Checking offset ${offset}...`);

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
      let batchCorrupted = 0;
      let batchFixed = 0;

      // Check each cruise for corruption
      for (const cruise of batch) {
        if (isCharacterArray(cruise.raw_data)) {
          totalCorrupted++;
          batchCorrupted++;

          // Show first few corrupted in each batch
          if (batchCorrupted <= 2) {
            console.log(`  ❌ Corrupted: ${cruise.id} - ${cruise.name ? cruise.name.substring(0, 40) : 'Unknown'}`);
            console.log(`     Current price: $${cruise.cheapest_price}`);
          }

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

                  if (batchCorrupted <= 2) {
                    console.log(`     ✅ FIXED: $${cruise.cheapest_price} → $${realCheapest}`);
                  }
                  totalFixed++;
                  batchFixed++;
                }
              }
            } catch (error) {
              console.error(`     ❌ ERROR: ${error.message}`);
              totalErrors++;
            }
          }
        }
      }

      if (batchCorrupted > 2) {
        console.log(`  ... and ${batchCorrupted - 2} more corrupted in this batch`);
      }

      if (batchFixed > 0) {
        console.log(`  ✅ Fixed ${batchFixed} cruises in this batch`);
      }

      // Progress update every 20 batches
      if (batchCount > 0 && batchCount % 20 === 0) {
        console.log(`\n📊 PROGRESS REPORT:`);
        console.log(`   Checked: ${offset + batch.length} cruises`);
        console.log(`   Corrupted found: ${totalCorrupted}`);
        console.log(`   Fixed: ${totalFixed}`);
        console.log(`   Errors: ${totalErrors}`);
        const percentage = ((offset + batch.length) / 49000 * 100).toFixed(1);
        console.log(`   Progress: ${percentage}% complete`);
      }

      offset += BATCH_SIZE;
      batchCount++;

      // Test mode - stop after 5 batches
      if (TEST_MODE && batchCount >= 5) {
        console.log('\n⚠️  TEST MODE: Stopping after 5 batches');
        hasMore = false;
      }

      // Small delay to avoid overloading
      if (!DRY_RUN && batchCorrupted > 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // Final summary
    console.log('\n' + '=' .repeat(80));
    console.log('FINAL SUMMARY:');
    console.log('=' .repeat(80));
    console.log(`Total cruises checked: ${offset}`);
    console.log(`Total corrupted found: ${totalCorrupted} (${(totalCorrupted/offset*100).toFixed(1)}%)`);
    if (!DRY_RUN) {
      console.log(`Total fixed: ${totalFixed}`);
      console.log(`Total errors: ${totalErrors}`);
      console.log(`Success rate: ${totalFixed > 0 ? (totalFixed/totalCorrupted*100).toFixed(1) : 0}%`);
    } else {
      console.log('\n📌 This was a DRY RUN. To fix the corrupted data, run:');
      console.log('   node scripts/fix-corrupted-working.js --execute');
    }

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await sql.end();
  }
}

main();
