#!/usr/bin/env node
require('dotenv').config();
const postgres = require('postgres');

const client = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function validateCruisePrices() {
  try {
    console.log('🔍 VALIDATING CRUISE PRICES ACROSS ALL LINES');
    console.log('=' .repeat(60));

    // Get sample of recently synced cruises from each cruise line
    const cruisesByLine = await client`
      WITH recent_cruises AS (
        SELECT
          c.id,
          c.name,
          c.interior_price,
          c.oceanview_price,
          c.balcony_price,
          c.suite_price,
          c.cheapest_price,
          c.raw_data,
          c.updated_at,
          cl.name as cruise_line,
          c.cruise_line_id,
          ROW_NUMBER() OVER (PARTITION BY c.cruise_line_id ORDER BY c.updated_at DESC) as rn
        FROM cruises c
        LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        WHERE c.updated_at > NOW() - INTERVAL '7 days'
          AND c.raw_data IS NOT NULL
          AND c.cruise_line_id IS NOT NULL
      )
      SELECT *
      FROM recent_cruises
      WHERE rn <= 10
      ORDER BY cruise_line, updated_at DESC
    `;

    console.log(`\nFound ${cruisesByLine.length} recent cruises to validate\n`);

    const results = {
      total: 0,
      correct: 0,
      mismatch: 0,
      errors: 0,
      byLine: {},
      mismatches: []
    };

    let currentLine = '';

    for (const cruise of cruisesByLine) {
      if (cruise.cruise_line !== currentLine) {
        currentLine = cruise.cruise_line || 'Unknown';
        console.log(`\n📊 ${currentLine}`);
        console.log('-'.repeat(40));
        if (!results.byLine[currentLine]) {
          results.byLine[currentLine] = { total: 0, correct: 0, mismatch: 0 };
        }
      }

      results.total++;
      results.byLine[currentLine].total++;

      try {
        // Extract prices from raw_data
        let rawData = cruise.raw_data;

        // Check if raw_data is corrupted (character-by-character)
        if (rawData && typeof rawData === 'object' && rawData['0'] !== undefined) {
          // Skip corrupted data that hasn't been fixed yet
          console.log(`  ⚠️  ${cruise.id}: Skipping - raw_data still corrupted`);
          results.errors++;
          continue;
        }

        // Parse if it's a string
        if (typeof rawData === 'string') {
          try {
            rawData = JSON.parse(rawData);
          } catch (e) {
            console.log(`  ❌ ${cruise.id}: Failed to parse raw_data`);
            results.errors++;
            continue;
          }
        }

        // Extract prices from various possible locations
        let jsonPrices = {
          interior: null,
          oceanview: null,
          balcony: null,
          suite: null
        };

        // Priority 1: Top-level cheapest fields (most accurate)
        if (rawData.cheapestinside || rawData.cheapestoutside || rawData.cheapestbalcony || rawData.cheapestsuite) {
          jsonPrices.interior = parseFloat(String(rawData.cheapestinside || '0').replace(/[^0-9.-]/g, '')) || null;
          jsonPrices.oceanview = parseFloat(String(rawData.cheapestoutside || '0').replace(/[^0-9.-]/g, '')) || null;
          jsonPrices.balcony = parseFloat(String(rawData.cheapestbalcony || '0').replace(/[^0-9.-]/g, '')) || null;
          jsonPrices.suite = parseFloat(String(rawData.cheapestsuite || '0').replace(/[^0-9.-]/g, '')) || null;
        }
        // Priority 2: cheapest.combined
        else if (rawData.cheapest && rawData.cheapest.combined) {
          jsonPrices.interior = parseFloat(String(rawData.cheapest.combined.inside || '0')) || null;
          jsonPrices.oceanview = parseFloat(String(rawData.cheapest.combined.outside || '0')) || null;
          jsonPrices.balcony = parseFloat(String(rawData.cheapest.combined.balcony || '0')) || null;
          jsonPrices.suite = parseFloat(String(rawData.cheapest.combined.suite || '0')) || null;
        }
        // Priority 3: cheapest.prices
        else if (rawData.cheapest && rawData.cheapest.prices) {
          jsonPrices.interior = parseFloat(String(rawData.cheapest.prices.inside || '0')) || null;
          jsonPrices.oceanview = parseFloat(String(rawData.cheapest.prices.outside || '0')) || null;
          jsonPrices.balcony = parseFloat(String(rawData.cheapest.prices.balcony || '0')) || null;
          jsonPrices.suite = parseFloat(String(rawData.cheapest.prices.suite || '0')) || null;
        }

        // Compare with database values
        const dbPrices = {
          interior: parseFloat(cruise.interior_price || '0') || null,
          oceanview: parseFloat(cruise.oceanview_price || '0') || null,
          balcony: parseFloat(cruise.balcony_price || '0') || null,
          suite: parseFloat(cruise.suite_price || '0') || null
        };

        // Check for mismatches (allowing for small floating point differences)
        const tolerance = 0.01;
        let hasMismatch = false;
        let mismatchDetails = [];

        for (const cabin of ['interior', 'oceanview', 'balcony', 'suite']) {
          const dbPrice = dbPrices[cabin];
          const jsonPrice = jsonPrices[cabin];

          if (dbPrice !== null && jsonPrice !== null) {
            if (Math.abs(dbPrice - jsonPrice) > tolerance) {
              hasMismatch = true;
              mismatchDetails.push(`${cabin}: DB=$${dbPrice} JSON=$${jsonPrice}`);
            }
          } else if (dbPrice !== null && jsonPrice === null) {
            // DB has price but JSON doesn't - might be okay
          } else if (dbPrice === null && jsonPrice !== null && jsonPrice > 0) {
            hasMismatch = true;
            mismatchDetails.push(`${cabin}: DB=null JSON=$${jsonPrice}`);
          }
        }

        if (hasMismatch) {
          console.log(`  ❌ ${cruise.id} (${cruise.name}): MISMATCH`);
          console.log(`     ${mismatchDetails.join(', ')}`);
          results.mismatch++;
          results.byLine[currentLine].mismatch++;
          results.mismatches.push({
            id: cruise.id,
            name: cruise.name,
            line: currentLine,
            details: mismatchDetails
          });
        } else {
          console.log(`  ✅ ${cruise.id}: Prices match`);
          results.correct++;
          results.byLine[currentLine].correct++;
        }

      } catch (error) {
        console.log(`  ❌ ${cruise.id}: Error - ${error.message}`);
        results.errors++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total cruises checked: ${results.total}`);
    console.log(`✅ Correct: ${results.correct} (${(results.correct/results.total*100).toFixed(1)}%)`);
    console.log(`❌ Mismatches: ${results.mismatch} (${(results.mismatch/results.total*100).toFixed(1)}%)`);
    console.log(`⚠️  Errors: ${results.errors}`);

    console.log('\nBy Cruise Line:');
    for (const [line, stats] of Object.entries(results.byLine)) {
      const accuracy = stats.total > 0 ? (stats.correct/stats.total*100).toFixed(1) : 0;
      console.log(`  ${line}: ${stats.correct}/${stats.total} correct (${accuracy}%)`);
    }

    if (results.mismatches.length > 0) {
      console.log('\n⚠️  MISMATCHES REQUIRING ATTENTION:');
      console.log('=' .repeat(60));

      // Group mismatches by cruise line
      const mismatchesByLine = {};
      for (const mismatch of results.mismatches) {
        if (!mismatchesByLine[mismatch.line]) {
          mismatchesByLine[mismatch.line] = [];
        }
        mismatchesByLine[mismatch.line].push(mismatch);
      }

      for (const [line, mismatches] of Object.entries(mismatchesByLine)) {
        console.log(`\n${line}:`);
        for (const mismatch of mismatches.slice(0, 5)) { // Show max 5 per line
          console.log(`  - ${mismatch.id}: ${mismatch.details.join(', ')}`);
        }
        if (mismatches.length > 5) {
          console.log(`  ... and ${mismatches.length - 5} more`);
        }
      }

      // Check if we need to fix these
      console.log('\n💡 RECOMMENDATION:');
      if (results.mismatch > results.total * 0.1) { // More than 10% mismatches
        console.log('  ⚠️  High mismatch rate detected! Consider running fix script for these cruises.');

        // Get IDs of mismatched cruises
        const mismatchedIds = results.mismatches.map(m => `'${m.id}'`).join(',');
        console.log(`\n  To fix these ${results.mismatches.length} cruises, you can run:`);
        console.log(`  UPDATE cruises SET needs_resync = true WHERE id IN (${mismatchedIds.slice(0, 200)}...)`);
      } else {
        console.log('  ✅ Mismatch rate is acceptable (< 10%). System is working correctly.');
      }
    }

    // Check for systematic issues
    console.log('\n🔎 PATTERN ANALYSIS:');
    const lineAccuracy = {};
    for (const [line, stats] of Object.entries(results.byLine)) {
      if (stats.total > 0) {
        lineAccuracy[line] = stats.correct / stats.total;
      }
    }

    const worstLine = Object.entries(lineAccuracy).reduce((worst, [line, accuracy]) => {
      return accuracy < worst.accuracy ? {line, accuracy} : worst;
    }, {line: null, accuracy: 1});

    if (worstLine.line && worstLine.accuracy < 0.8) {
      console.log(`  ⚠️  ${worstLine.line} has low accuracy (${(worstLine.accuracy*100).toFixed(1)}%)`);
      console.log(`     This cruise line may need special handling in the webhook processor.`);
    } else {
      console.log('  ✅ No systematic issues detected with specific cruise lines.');
    }

  } catch (error) {
    console.error('\nError:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

validateCruisePrices();
