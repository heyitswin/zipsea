/**
 * Fix remaining cruises with JSON strings - BATCH VERSION
 * Processes in small batches to avoid memory issues
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
  const BATCH_SIZE = 10; // Small batch size due to large raw_data fields

  console.log('=' .repeat(80));
  console.log('FIX REMAINING JSON STRINGS IN RAW_DATA (BATCH VERSION)');
  console.log('=' .repeat(80));
  console.log('Mode:', DRY_RUN ? '🔍 DRY RUN' : '⚠️  EXECUTE MODE');
  console.log('Batch size:', BATCH_SIZE, '(small due to large raw_data fields)');
  console.log();

  try {
    // First count how many need fixing
    console.log('Counting cruises with JSON strings...');
    const countResult = await sql`
      SELECT COUNT(*) as count
      FROM cruises
      WHERE raw_data::text LIKE '"{%'
      AND is_active = true
    `;

    const totalCount = parseInt(countResult[0].count);
    console.log(`Found ${totalCount} cruises with JSON strings\n`);

    if (totalCount === 0) {
      console.log('✅ No JSON strings found - all cruises are fixed!');
      return;
    }

    if (!DRY_RUN) {
      console.log('=' .repeat(80));
      console.log('FIXING JSON STRINGS IN BATCHES...');
      console.log('=' .repeat(80) + '\n');

      let totalFixed = 0;
      let totalErrors = 0;
      let hasMore = true;

      while (hasMore) {
        // Get a small batch of cruises with JSON strings
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
            raw_data::text as raw_text
          FROM cruises
          WHERE raw_data::text LIKE '"{%'
          AND is_active = true
          ORDER BY id
          LIMIT ${BATCH_SIZE}
        `;

        if (batch.length === 0) {
          hasMore = false;
          break;
        }

        console.log(`Processing batch of ${batch.length} cruises...`);

        for (const cruise of batch) {
          try {
            let parsedData;

            // Handle different cases
            if (typeof cruise.raw_data === 'string') {
              // It's a JSON string, parse it
              parsedData = JSON.parse(cruise.raw_data);
            } else if (cruise.raw_text && cruise.raw_text.startsWith('"{')) {
              // The text representation shows it's a quoted JSON string
              // Remove quotes and parse
              const unquoted = cruise.raw_text.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
              parsedData = JSON.parse(unquoted);
            } else {
              console.log(`  ⚠️  Skipping ${cruise.id} - unclear structure`);
              totalErrors++;
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

              // Show what we're fixing
              if (totalFixed < 5) {
                console.log(`  Fixing ${cruise.id}: ${cruise.name}`);
                console.log(`    Old price: $${cruise.cheapest_price}`);
                console.log(`    New price: $${realCheapest}`);
              }

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

              totalFixed++;
            }
          } catch (error) {
            console.error(`  Error fixing cruise ${cruise.id}:`, error.message);
            totalErrors++;
          }
        }

        // Progress update
        if (totalFixed % 100 === 0) {
          console.log(`\n📊 Progress: Fixed ${totalFixed}/${totalCount} cruises (${(totalFixed/totalCount*100).toFixed(1)}%)\n`);
        }

        // Small delay to avoid overloading
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('\n' + '=' .repeat(80));
      console.log('COMPLETE');
      console.log('=' .repeat(80));
      console.log(`Total fixed: ${totalFixed}`);
      console.log(`Total errors: ${totalErrors}`);
      if (totalFixed > 0) {
        console.log(`Success rate: ${(totalFixed/(totalFixed+totalErrors)*100).toFixed(1)}%`);
      }

      // Final verification
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
      // Dry run - just show examples
      console.log('Examples of cruises that need fixing:');
      const examples = await sql`
        SELECT
          id,
          name,
          cheapest_price::decimal as cheapest_price
        FROM cruises
        WHERE raw_data::text LIKE '"{%'
        AND is_active = true
        LIMIT 10
      `;

      for (const ex of examples) {
        console.log(`  ${ex.id}: ${ex.name} (current: $${ex.cheapest_price})`);
      }

      console.log('\n' + '=' .repeat(80));
      console.log('DRY RUN SUMMARY');
      console.log('=' .repeat(80));
      console.log(`Would fix ${totalCount} cruises with JSON strings`);
      console.log('\nTo execute the fix, run:');
      console.log('  node scripts/fix-remaining-json-strings-batch.js --execute');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
