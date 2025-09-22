/**
 * Fix remaining cruises that still have JSON strings
 * These were missed in the first pass
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

  console.log('=' .repeat(80));
  console.log('FIX REMAINING JSON STRINGS IN RAW_DATA');
  console.log('=' .repeat(80));
  console.log('Mode:', DRY_RUN ? '🔍 DRY RUN' : '⚠️  EXECUTE MODE');
  console.log();

  try {
    // Find remaining JSON strings using the text pattern check
    console.log('Finding remaining JSON strings...\n');

    const remaining = await sql`
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
        raw_data::text as raw_text
      FROM cruises
      WHERE raw_data::text LIKE '"{%'
      AND is_active = true
      ORDER BY id
    `;

    console.log(`Found ${remaining.length} cruises with JSON strings\n`);

    if (remaining.length === 0) {
      console.log('✅ No JSON strings found - all cruises are fixed!');
      return;
    }

    // Show examples
    console.log('Examples:');
    for (let i = 0; i < Math.min(5, remaining.length); i++) {
      const cruise = remaining[i];
      console.log(`  ${cruise.id}: ${cruise.name}`);
      console.log(`    Current cheapest: $${cruise.cheapest_price}`);

      // Check if it's actually a string that needs parsing
      if (typeof cruise.raw_data === 'string' && cruise.raw_data.startsWith('{')) {
        console.log(`    ✅ Can be parsed`);
      } else {
        console.log(`    ⚠️  Complex structure`);
      }
    }

    if (!DRY_RUN) {
      console.log('\n' + '=' .repeat(80));
      console.log('FIXING JSON STRINGS...');
      console.log('=' .repeat(80) + '\n');

      let fixed = 0;
      let errors = 0;

      for (const cruise of remaining) {
        try {
          let parsedData;

          // Handle different cases
          if (typeof cruise.raw_data === 'string') {
            // It's a JSON string, parse it
            parsedData = JSON.parse(cruise.raw_data);
          } else if (cruise.raw_text && cruise.raw_text.startsWith('"{')) {
            // The text representation shows it's a quoted JSON string
            // Remove quotes and parse
            const unquoted = cruise.raw_text.slice(1, -1).replace(/\\"/g, '"');
            parsedData = JSON.parse(unquoted);
          } else {
            console.log(`  ⚠️  Skipping ${cruise.id} - unclear structure`);
            continue;
          }

          if (parsedData) {
            // Extract prices
            const realPrices = extractPrices(parsedData, cruise.cruise_line_id);

            // Calculate cheapest
            const allPrices = [
              realPrices.interior,
              realPrices.oceanview,
              realPrices.balcony,
              realPrices.suite,
            ].filter(p => p !== null && p > 0);

            const realCheapest = allPrices.length > 0 ? Math.min(...allPrices) : null;

            // Update database
            await sql`
              UPDATE cruises
              SET
                raw_data = ${parsedData}::jsonb,
                interior_price = ${realPrices.interior},
                oceanview_price = ${realPrices.oceanview},
                balcony_price = ${realPrices.balcony},
                suite_price = ${realPrices.suite},
                cheapest_price = ${realCheapest},
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ${cruise.id}
            `;

            fixed++;

            if (fixed % 100 === 0) {
              console.log(`Progress: Fixed ${fixed}/${remaining.length} cruises...`);
            }
          }
        } catch (error) {
          console.error(`Error fixing cruise ${cruise.id}:`, error.message);
          errors++;
        }
      }

      console.log('\n' + '=' .repeat(80));
      console.log('COMPLETE');
      console.log('=' .repeat(80));
      console.log(`Total fixed: ${fixed}`);
      console.log(`Total errors: ${errors}`);
      console.log(`Success rate: ${(fixed/(fixed+errors)*100).toFixed(1)}%`);

      // Verify
      console.log('\nVerifying...');
      const check = await sql`
        SELECT COUNT(*) as count
        FROM cruises
        WHERE raw_data::text LIKE '"{%'
        AND is_active = true
      `;

      if (check[0].count === 0) {
        console.log('✅ SUCCESS: All JSON strings have been fixed!');
      } else {
        console.log(`⚠️  WARNING: ${check[0].count} JSON strings remain`);
      }

    } else {
      console.log('\n' + '=' .repeat(80));
      console.log('DRY RUN SUMMARY');
      console.log('=' .repeat(80));
      console.log(`Would fix ${remaining.length} cruises with JSON strings`);
      console.log('\nTo execute the fix, run:');
      console.log('  node scripts/fix-remaining-json-strings.js --execute');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
