/**
 * ULTRA FAST BULK VERSION - Fix JSON strings using bulk updates
 * Processes hundreds at once with single UPDATE statement
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
  max: 10,
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
  const BATCH_SIZE = 200; // Large batches for bulk update

  console.log('=' .repeat(80));
  console.log('BULK FIX FOR JSON STRINGS - ULTRA FAST');
  console.log('=' .repeat(80));
  console.log('Mode:', DRY_RUN ? '🔍 DRY RUN' : '⚠️  EXECUTE MODE');
  console.log('Strategy: Bulk updates with temporary table\n');

  const startTime = Date.now();

  try {
    // Count
    const countResult = await sql`
      SELECT COUNT(*) as count
      FROM cruises
      WHERE raw_data::text LIKE '"{%'
      AND is_active = true
    `;

    const totalCount = parseInt(countResult[0].count);
    console.log(`Found ${totalCount} cruises to fix\n`);

    if (totalCount === 0) {
      console.log('✅ All cruises already fixed!');
      return;
    }

    if (!DRY_RUN) {
      console.log('PROCESSING IN BULK...\n');

      // Create temporary table for updates
      await sql`
        CREATE TEMP TABLE cruise_fixes (
          id TEXT PRIMARY KEY,
          raw_data JSONB,
          interior_price DECIMAL,
          oceanview_price DECIMAL,
          balcony_price DECIMAL,
          suite_price DECIMAL,
          cheapest_price DECIMAL
        )
      `;

      let totalProcessed = 0;
      let totalErrors = 0;
      let hasMore = true;
      let batchNum = 0;

      while (hasMore) {
        // Get batch
        const batch = await sql`
          SELECT
            id,
            cruise_line_id,
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

        batchNum++;
        const fixes = [];

        // Process all in memory
        for (const cruise of batch) {
          try {
            let parsedData;

            if (typeof cruise.raw_data === 'string') {
              parsedData = JSON.parse(cruise.raw_data);
            } else if (cruise.raw_text && cruise.raw_text.startsWith('"{')) {
              const unquoted = cruise.raw_text.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
              parsedData = JSON.parse(unquoted);
            } else {
              totalErrors++;
              continue;
            }

            if (parsedData) {
              const prices = extractPrices(parsedData, cruise.cruise_line_id);
              const allPrices = [prices.interior, prices.oceanview, prices.balcony, prices.suite]
                .filter(p => p !== null && p > 0);
              const cheapest = allPrices.length > 0 ? Math.min(...allPrices) : null;

              fixes.push({
                id: cruise.id,
                raw_data: parsedData,
                interior_price: prices.interior,
                oceanview_price: prices.oceanview,
                balcony_price: prices.balcony,
                suite_price: prices.suite,
                cheapest_price: cheapest
              });
            }
          } catch (e) {
            totalErrors++;
          }
        }

        if (fixes.length > 0) {
          // Bulk insert to temp table
          await sql`
            INSERT INTO cruise_fixes ${sql(fixes)}
            ON CONFLICT (id) DO NOTHING
          `;

          // Bulk update from temp table
          await sql`
            UPDATE cruises c
            SET
              raw_data = f.raw_data,
              interior_price = f.interior_price,
              oceanview_price = f.oceanview_price,
              balcony_price = f.balcony_price,
              suite_price = f.suite_price,
              cheapest_price = f.cheapest_price,
              updated_at = CURRENT_TIMESTAMP
            FROM cruise_fixes f
            WHERE c.id = f.id
          `;

          // Clear temp table for next batch
          await sql`TRUNCATE cruise_fixes`;

          totalProcessed += fixes.length;
        }

        // Progress
        if (batchNum % 5 === 0 || batch.length < BATCH_SIZE) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const rate = (totalProcessed / elapsed).toFixed(1);
          const remaining = Math.ceil((totalCount - totalProcessed) / parseFloat(rate));
          console.log(`Batch ${batchNum}: Fixed ${totalProcessed}/${totalCount} (${(totalProcessed/totalCount*100).toFixed(1)}%) | ${rate}/sec | ETA: ${remaining}s`);
        }
      }

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log('\n' + '=' .repeat(80));
      console.log('COMPLETE');
      console.log('=' .repeat(80));
      console.log(`Total fixed: ${totalProcessed}`);
      console.log(`Total errors: ${totalErrors}`);
      console.log(`Time: ${totalTime}s (${(totalProcessed/totalTime).toFixed(1)}/sec)`);

      // Verify
      const check = await sql`
        SELECT COUNT(*) as count
        FROM cruises
        WHERE raw_data::text LIKE '"{%'
        AND is_active = true
      `;

      if (check[0].count === 0) {
        console.log('\n✅ SUCCESS: All JSON strings fixed!');
      } else {
        console.log(`\n⚠️  ${check[0].count} remain`);
      }

    } else {
      console.log('DRY RUN - Would fix', totalCount, 'cruises');
      console.log('Run with --execute to fix');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
