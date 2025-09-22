/**
 * Fix cruises where raw_data was incorrectly stored as character arrays
 * This reconstructs the JSON and updates prices
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prodUrl = process.env.DATABASE_URL_PRODUCTION || 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';
const sql = postgres(prodUrl, { ssl: { rejectUnauthorized: false } });

function reconstructJsonFromCharArray(rawData) {
  // Check if this is a character array
  if (!rawData['0'] || !rawData['1']) {
    return null; // Not a character array
  }

  // Reconstruct the JSON string
  let jsonString = '';
  let i = 0;
  const maxChars = 10000000; // Safety limit

  while (rawData[i.toString()] !== undefined && i < maxChars) {
    jsonString += rawData[i.toString()];
    i++;
  }

  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('Failed to parse reconstructed JSON:', e.message);
    return null;
  }
}

function extractPrices(data, cruiseLineId) {
  const prices = {
    interior: null,
    oceanview: null,
    balcony: null,
    suite: null
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
  const LIMIT = args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || null;

  console.log('=' .repeat(80));
  console.log('FIXING CHARACTER ARRAY CORRUPTION IN RAW_DATA');
  console.log('=' .repeat(80));
  console.log('Mode:', DRY_RUN ? '🔍 DRY RUN' : '⚠️  EXECUTE MODE');
  if (LIMIT) console.log('Limit:', LIMIT);
  console.log();

  try {
    // Find all cruises with character array corruption
    let query = sql`
      SELECT
        id,
        cruise_id,
        name,
        cruise_line_id,
        sailing_date,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price,
        raw_data,
        updated_at
      FROM cruises
      WHERE raw_data ? '0'
      AND raw_data ? '1'
      AND raw_data ? '2'
      AND is_active = true
      ORDER BY cheapest_price::decimal ASC
    `;

    if (LIMIT) {
      query = sql`
        SELECT
          id,
          cruise_id,
          name,
          cruise_line_id,
          sailing_date,
          interior_price,
          oceanview_price,
          balcony_price,
          suite_price,
          cheapest_price,
          raw_data,
          updated_at
        FROM cruises
        WHERE raw_data ? '0'
        AND raw_data ? '1'
        AND raw_data ? '2'
        AND is_active = true
        ORDER BY cheapest_price::decimal ASC
        LIMIT ${parseInt(LIMIT)}
      `;
    }

    const corruptedCruises = await query;
    console.log(`Found ${corruptedCruises.length} cruises with character array corruption\n`);

    let fixed = 0;
    let failed = 0;
    const fixes = [];

    for (const cruise of corruptedCruises) {
      // Reconstruct the JSON
      const reconstructed = reconstructJsonFromCharArray(cruise.raw_data);

      if (!reconstructed) {
        console.log(`❌ Failed to reconstruct cruise ${cruise.id}`);
        failed++;
        continue;
      }

      // Extract correct prices
      const correctPrices = extractPrices(reconstructed, cruise.cruise_line_id);

      // Compare with current prices
      const dbPrices = {
        interior: parseFloat(cruise.interior_price) || null,
        oceanview: parseFloat(cruise.oceanview_price) || null,
        balcony: parseFloat(cruise.balcony_price) || null,
        suite: parseFloat(cruise.suite_price) || null
      };

      const differences = [];

      if (correctPrices.interior && dbPrices.interior) {
        const diff = Math.abs(dbPrices.interior - correctPrices.interior);
        if (diff > 0.01) {
          differences.push(`Interior: $${dbPrices.interior} → $${correctPrices.interior}`);
        }
      }

      if (correctPrices.oceanview && dbPrices.oceanview) {
        const diff = Math.abs(dbPrices.oceanview - correctPrices.oceanview);
        if (diff > 0.01) {
          differences.push(`Oceanview: $${dbPrices.oceanview} → $${correctPrices.oceanview}`);
        }
      }

      if (correctPrices.balcony && dbPrices.balcony) {
        const diff = Math.abs(dbPrices.balcony - correctPrices.balcony);
        if (diff > 0.01) {
          differences.push(`Balcony: $${dbPrices.balcony} → $${correctPrices.balcony}`);
        }
      }

      if (correctPrices.suite && dbPrices.suite) {
        const diff = Math.abs(dbPrices.suite - correctPrices.suite);
        if (diff > 0.01) {
          differences.push(`Suite: $${dbPrices.suite} → $${correctPrices.suite}`);
        }
      }

      if (differences.length > 0 || !cruise.raw_data.cheapest) {
        fixes.push({
          id: cruise.id,
          name: cruise.name,
          differences,
          oldCheapest: cruise.cheapest_price,
          newPrices: correctPrices
        });

        if (!DRY_RUN) {
          // Calculate new cheapest
          const allPrices = [
            correctPrices.interior,
            correctPrices.oceanview,
            correctPrices.balcony,
            correctPrices.suite
          ].filter(p => p && p > 0);

          const newCheapest = allPrices.length > 0 ? Math.min(...allPrices) : null;

          // Update both raw_data and prices
          await sql`
            UPDATE cruises
            SET
              raw_data = ${JSON.stringify(reconstructed)}::jsonb,
              interior_price = ${correctPrices.interior?.toString() || cruise.interior_price},
              oceanview_price = ${correctPrices.oceanview?.toString() || cruise.oceanview_price},
              balcony_price = ${correctPrices.balcony?.toString() || cruise.balcony_price},
              suite_price = ${correctPrices.suite?.toString() || cruise.suite_price},
              cheapest_price = ${newCheapest?.toString() || cruise.cheapest_price},
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${cruise.id}
          `;

          console.log(`✅ Fixed cruise ${cruise.id}: ${cruise.name}`);
        }

        fixed++;
      }

      // Progress
      if ((fixed + failed) % 50 === 0) {
        console.log(`Progress: ${fixed + failed}/${corruptedCruises.length} processed`);
      }
    }

    // Report
    console.log();
    console.log('=' .repeat(80));
    console.log('RESULTS');
    console.log('=' .repeat(80));
    console.log(`Total corrupted cruises: ${corruptedCruises.length}`);
    console.log(`Successfully ${DRY_RUN ? 'would fix' : 'fixed'}: ${fixed}`);
    console.log(`Failed to reconstruct: ${failed}`);
    console.log();

    if (fixes.length > 0) {
      console.log('SAMPLE FIXES:');
      for (const fix of fixes.slice(0, 10)) {
        console.log(`\n${fix.id}: ${fix.name}`);
        console.log(`  Old cheapest: $${fix.oldCheapest}`);
        console.log(`  New prices: Interior=$${fix.newPrices.interior || 'N/A'}, Ocean=$${fix.newPrices.oceanview || 'N/A'}, Balcony=$${fix.newPrices.balcony || 'N/A'}, Suite=$${fix.newPrices.suite || 'N/A'}`);
        if (fix.differences.length > 0) {
          console.log(`  Changes: ${fix.differences.join(', ')}`);
        }
      }

      if (fixes.length > 10) {
        console.log(`\n... and ${fixes.length - 10} more`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

// Run
if (process.argv.includes('--help')) {
  console.log('Usage: node fix-character-array-corruption.js [options]');
  console.log();
  console.log('Options:');
  console.log('  --execute    Actually apply the fixes (default is dry-run)');
  console.log('  --limit=N    Limit to N cruises');
  console.log('  --help       Show this help');
} else {
  main();
}
