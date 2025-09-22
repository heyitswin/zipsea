/**
 * Fast fix for corrupted raw_data - processes in smaller batches
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prodUrl =
  process.env.DATABASE_URL_PRODUCTION ||
  'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';
const sql = postgres(prodUrl, { ssl: { rejectUnauthorized: false } });

async function main() {
  const args = process.argv.slice(2);
  const EXECUTE = args.includes('--execute');

  console.log('='.repeat(80));
  console.log('FAST FIX FOR CORRUPTED RAW_DATA');
  console.log('='.repeat(80));
  console.log('Mode:', EXECUTE ? '⚠️  EXECUTE' : '🔍 DRY RUN');
  console.log();

  try {
    // First, just count how many we have
    console.log('Counting corrupted cruises...');
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM cruises
      WHERE cheapest_price::decimal < 50
      AND is_active = true
    `;

    console.log(`Found ${countResult[0].total} cruises under $50 to check\n`);

    // Get them in small batches
    const batchSize = 10;
    let offset = 0;
    let totalFixed = 0;
    let totalChecked = 0;

    while (true) {
      const batch = await sql`
        SELECT
          id,
          name,
          cruise_line_id,
          cheapest_price,
          interior_price,
          oceanview_price,
          balcony_price,
          suite_price,
          raw_data::text as raw_text
        FROM cruises
        WHERE cheapest_price::decimal < 50
        AND is_active = true
        ORDER BY id
        LIMIT ${batchSize}
        OFFSET ${offset}
      `;

      if (batch.length === 0) break;

      for (const cruise of batch) {
        totalChecked++;

        // Check if it's corrupted (character array)
        if (cruise.raw_text.startsWith('{"0":')) {
          console.log(`Found corrupted: ${cruise.id} - ${cruise.name} ($${cruise.cheapest_price})`);

          try {
            // Parse and reconstruct
            const parsed = JSON.parse(cruise.raw_text);
            let reconstructed = '';
            let i = 0;
            while (parsed[i.toString()] !== undefined && i < 10000000) {
              reconstructed += parsed[i.toString()];
              i++;
            }

            const fixedData = JSON.parse(reconstructed);

            // Extract prices
            const newPrices = {
              interior: fixedData.cheapestinside ? parseFloat(fixedData.cheapestinside) : null,
              oceanview: fixedData.cheapestoutside ? parseFloat(fixedData.cheapestoutside) : null,
              balcony: fixedData.cheapestbalcony ? parseFloat(fixedData.cheapestbalcony) : null,
              suite: fixedData.cheapestsuite ? parseFloat(fixedData.cheapestsuite) : null,
            };

            // Handle Riviera Travel
            if (cruise.cruise_line_id === 329) {
              if (newPrices.interior) newPrices.interior = newPrices.interior / 1000;
              if (newPrices.oceanview) newPrices.oceanview = newPrices.oceanview / 1000;
              if (newPrices.balcony) newPrices.balcony = newPrices.balcony / 1000;
              if (newPrices.suite) newPrices.suite = newPrices.suite / 1000;
            }

            const allPrices = Object.values(newPrices).filter(p => p && p > 0);
            const newCheapest = allPrices.length > 0 ? Math.min(...allPrices) : null;

            console.log(`  Current: $${cruise.cheapest_price}, Should be: $${newCheapest}`);

            if (EXECUTE) {
              await sql`
                UPDATE cruises
                SET
                  raw_data = ${JSON.stringify(fixedData)}::jsonb,
                  interior_price = ${newPrices.interior?.toString() || cruise.interior_price},
                  oceanview_price = ${newPrices.oceanview?.toString() || cruise.oceanview_price},
                  balcony_price = ${newPrices.balcony?.toString() || cruise.balcony_price},
                  suite_price = ${newPrices.suite?.toString() || cruise.suite_price},
                  cheapest_price = ${newCheapest?.toString() || cruise.cheapest_price},
                  updated_at = CURRENT_TIMESTAMP
                WHERE id = ${cruise.id}
              `;
              console.log(`  ✅ FIXED`);
            }

            totalFixed++;
          } catch (e) {
            console.log(`  ❌ Failed to fix: ${e.message}`);
          }
        }
      }

      offset += batchSize;
      console.log(`Progress: Checked ${totalChecked} cruises, fixed ${totalFixed}`);

      // Safety limit
      if (offset > 100) {
        console.log('Stopping at 100 for safety');
        break;
      }
    }

    console.log();
    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total checked: ${totalChecked}`);
    console.log(`Total ${EXECUTE ? 'fixed' : 'would fix'}: ${totalFixed}`);

    if (!EXECUTE && totalFixed > 0) {
      console.log('\nRun with --execute to apply fixes');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
