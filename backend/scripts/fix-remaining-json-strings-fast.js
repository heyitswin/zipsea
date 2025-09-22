/**
 * FAST VERSION - Fix remaining cruises with JSON strings
 * Optimized for speed while avoiding memory issues
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

// Use more connections for parallel processing
const sql = postgres(dbUrl, {
  ssl: { rejectUnauthorized: false },
  max: 10, // Increased connections
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

async function processBatch(batch) {
  const promises = [];

  for (const cruise of batch) {
    promises.push(processSingleCruise(cruise));
  }

  const results = await Promise.all(promises);
  return results.reduce((acc, result) => ({
    fixed: acc.fixed + result.fixed,
    errors: acc.errors + result.errors
  }), { fixed: 0, errors: 0 });
}

async function processSingleCruise(cruise) {
  try {
    let parsedData;

    // Handle different cases
    if (typeof cruise.raw_data === 'string') {
      parsedData = JSON.parse(cruise.raw_data);
    } else if (cruise.raw_text && cruise.raw_text.startsWith('"{')) {
      const unquoted = cruise.raw_text.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      parsedData = JSON.parse(unquoted);
    } else {
      return { fixed: 0, errors: 1 };
    }

    if (parsedData) {
      const realPrices = extractPrices(parsedData, cruise.cruise_line_id);

      const allPrices = [
        realPrices.interior,
        realPrices.oceanview,
        realPrices.balcony,
        realPrices.suite,
      ].filter(p => p !== null && p > 0);

      const realCheapest = allPrices.length > 0 ? Math.min(...allPrices) : null;

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

      return { fixed: 1, errors: 0 };
    }
    return { fixed: 0, errors: 0 };
  } catch (error) {
    return { fixed: 0, errors: 1 };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const DRY_RUN = !args.includes('--execute');
  const BATCH_SIZE = 50; // Larger batch size, still safe

  console.log('=' .repeat(80));
  console.log('FAST FIX FOR JSON STRINGS IN RAW_DATA');
  console.log('=' .repeat(80));
  console.log('Mode:', DRY_RUN ? '🔍 DRY RUN' : '⚠️  EXECUTE MODE');
  console.log('Batch size:', BATCH_SIZE, '(optimized for speed)');
  console.log('Processing strategy: Parallel within batches\n');

  const startTime = Date.now();

  try {
    // Count total
    console.log('Counting cruises with JSON strings...');
    const countResult = await sql`
      SELECT COUNT(*) as count
      FROM cruises
      WHERE raw_data::text LIKE '"{%'
      AND is_active = true
    `;

    const totalCount = parseInt(countResult[0].count);
    console.log(`Found ${totalCount} cruises to fix\n`);

    if (totalCount === 0) {
      console.log('✅ No JSON strings found - all cruises are fixed!');
      return;
    }

    if (!DRY_RUN) {
      console.log('PROCESSING...\n');

      let totalFixed = 0;
      let totalErrors = 0;
      let hasMore = true;
      let batchNum = 0;

      while (hasMore) {
        // Get batch - only fetch needed fields to reduce memory
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

        // Process batch in parallel
        const results = await processBatch(batch);
        totalFixed += results.fixed;
        totalErrors += results.errors;

        // Progress update every 10 batches
        if (batchNum % 10 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const rate = (totalFixed / elapsed).toFixed(1);
          const remaining = Math.ceil((totalCount - totalFixed) / parseFloat(rate));
          console.log(`Batch ${batchNum}: Fixed ${totalFixed}/${totalCount} (${(totalFixed/totalCount*100).toFixed(1)}%) | ${rate} cruises/sec | ETA: ${remaining}s`);
        }
      }

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log('\n' + '=' .repeat(80));
      console.log('COMPLETE');
      console.log('=' .repeat(80));
      console.log(`Total fixed: ${totalFixed}`);
      console.log(`Total errors: ${totalErrors}`);
      console.log(`Time taken: ${totalTime} seconds`);
      console.log(`Average speed: ${(totalFixed/totalTime).toFixed(1)} cruises/second`);

      // Final check
      const check = await sql`
        SELECT COUNT(*) as count
        FROM cruises
        WHERE raw_data::text LIKE '"{%'
        AND is_active = true
      `;

      if (check[0].count === 0) {
        console.log('\n✅ SUCCESS: All JSON strings have been fixed!');
      } else {
        console.log(`\n⚠️  WARNING: ${check[0].count} JSON strings remain`);
      }

    } else {
      console.log('DRY RUN - Would fix', totalCount, 'cruises');
      console.log('To execute: node scripts/fix-remaining-json-strings-fast.js --execute');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
