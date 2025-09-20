#!/usr/bin/env node
require('dotenv').config();
const postgres = require('postgres');

const client = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function validateLargeSample() {
  try {
    console.log('🔍 COMPREHENSIVE CRUISE PRICE VALIDATION - LARGE SAMPLE');
    console.log('=' .repeat(70));

    // Get ALL recently synced cruises (last 30 days) with a limit of 50 per cruise line
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
        WHERE c.updated_at > NOW() - INTERVAL '30 days'
          AND c.raw_data IS NOT NULL
          AND c.cruise_line_id IS NOT NULL
      )
      SELECT *
      FROM recent_cruises
      WHERE rn <= 50
      ORDER BY cruise_line, updated_at DESC
    `;

    console.log(`\n📊 Sample Size: ${cruisesByLine.length} cruises across all lines`);
    console.log(`📅 Time Period: Last 30 days of updates\n`);

    const results = {
      total: 0,
      correct: 0,
      mismatch: 0,
      errors: 0,
      skipped: 0,
      byLine: {},
      mismatches: [],
      errorDetails: {}
    };

    let currentLine = '';
    let lineResults = null;

    for (const cruise of cruisesByLine) {
      if (cruise.cruise_line !== currentLine) {
        // Print summary for previous line
        if (currentLine && lineResults) {
          const accuracy = lineResults.total > 0 ? (lineResults.correct/lineResults.total*100).toFixed(1) : 0;
          console.log(`  Summary: ${lineResults.correct}/${lineResults.total} correct (${accuracy}%)\n`);
        }

        currentLine = cruise.cruise_line || 'Unknown';
        console.log(`📊 ${currentLine}`);
        console.log('-'.repeat(50));

        if (!results.byLine[currentLine]) {
          results.byLine[currentLine] = {
            total: 0,
            correct: 0,
            mismatch: 0,
            errors: 0,
            skipped: 0,
            mismatches: []
          };
        }
        lineResults = results.byLine[currentLine];
      }

      results.total++;
      lineResults.total++;

      try {
        // Extract prices from raw_data
        let rawData = cruise.raw_data;

        // Check if raw_data is corrupted (character-by-character)
        if (rawData && typeof rawData === 'object' && rawData['0'] !== undefined) {
          results.errors++;
          lineResults.errors++;
          continue;
        }

        // Parse if it's a string
        if (typeof rawData === 'string') {
          try {
            rawData = JSON.parse(rawData);
          } catch (e) {
            results.errors++;
            lineResults.errors++;
            if (!results.errorDetails[currentLine]) {
              results.errorDetails[currentLine] = [];
            }
            results.errorDetails[currentLine].push({
              id: cruise.id,
              error: 'Failed to parse JSON'
            });
            continue;
          }
        }

        // Skip if no raw data
        if (!rawData) {
          results.skipped++;
          lineResults.skipped++;
          continue;
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
        let mismatchCount = 0;

        for (const cabin of ['interior', 'oceanview', 'balcony', 'suite']) {
          const dbPrice = dbPrices[cabin];
          const jsonPrice = jsonPrices[cabin];

          if (dbPrice !== null && jsonPrice !== null) {
            if (Math.abs(dbPrice - jsonPrice) > tolerance) {
              hasMismatch = true;
              mismatchCount++;
              mismatchDetails.push(`${cabin}: DB=$${dbPrice} JSON=$${jsonPrice}`);
            }
          } else if (dbPrice !== null && jsonPrice === null) {
            // DB has price but JSON doesn't - might be okay
          } else if (dbPrice === null && jsonPrice !== null && jsonPrice > 0) {
            hasMismatch = true;
            mismatchCount++;
            mismatchDetails.push(`${cabin}: DB=null JSON=$${jsonPrice}`);
          }
        }

        if (hasMismatch) {
          results.mismatch++;
          lineResults.mismatch++;
          lineResults.mismatches.push({
            id: cruise.id,
            name: cruise.name,
            details: mismatchDetails,
            count: mismatchCount
          });
          results.mismatches.push({
            id: cruise.id,
            name: cruise.name,
            line: currentLine,
            details: mismatchDetails
          });
        } else {
          results.correct++;
          lineResults.correct++;
        }

      } catch (error) {
        results.errors++;
        lineResults.errors++;
        if (!results.errorDetails[currentLine]) {
          results.errorDetails[currentLine] = [];
        }
        results.errorDetails[currentLine].push({
          id: cruise.id,
          error: error.message
        });
      }
    }

    // Print summary for last line
    if (currentLine && lineResults) {
      const accuracy = lineResults.total > 0 ? (lineResults.correct/lineResults.total*100).toFixed(1) : 0;
      console.log(`  Summary: ${lineResults.correct}/${lineResults.total} correct (${accuracy}%)\n`);
    }

    // Overall Summary
    console.log('\n' + '='.repeat(70));
    console.log('📈 OVERALL SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total cruises checked: ${results.total}`);
    console.log(`✅ Correct: ${results.correct} (${(results.correct/results.total*100).toFixed(1)}%)`);
    console.log(`❌ Mismatches: ${results.mismatch} (${(results.mismatch/results.total*100).toFixed(1)}%)`);
    console.log(`⚠️  Errors: ${results.errors}`);
    console.log(`⏭️  Skipped (no data): ${results.skipped}`);

    // Detailed breakdown by cruise line
    console.log('\n📊 DETAILED BREAKDOWN BY CRUISE LINE:');
    console.log('='.repeat(70));

    // Sort lines by accuracy (worst first)
    const sortedLines = Object.entries(results.byLine)
      .map(([line, stats]) => ({
        line,
        ...stats,
        accuracy: stats.total > 0 ? (stats.correct/stats.total) : 0
      }))
      .sort((a, b) => a.accuracy - b.accuracy);

    console.log('\n🔴 Lines with Issues (< 95% accuracy):');
    console.log('-'.repeat(50));
    let hasIssues = false;

    for (const lineData of sortedLines) {
      if (lineData.accuracy < 0.95) {
        hasIssues = true;
        const pct = (lineData.accuracy * 100).toFixed(1);
        console.log(`\n${lineData.line}:`);
        console.log(`  Accuracy: ${pct}% (${lineData.correct}/${lineData.total})`);
        console.log(`  Mismatches: ${lineData.mismatch}`);
        console.log(`  Errors: ${lineData.errors}`);

        // Show top 3 mismatches
        if (lineData.mismatches && lineData.mismatches.length > 0) {
          console.log('  Sample mismatches:');
          for (const mismatch of lineData.mismatches.slice(0, 3)) {
            console.log(`    - ${mismatch.id}: ${mismatch.details.join(', ')}`);
          }
          if (lineData.mismatches.length > 3) {
            console.log(`    ... and ${lineData.mismatches.length - 3} more`);
          }
        }
      }
    }

    if (!hasIssues) {
      console.log('  None! All cruise lines have ≥95% accuracy');
    }

    console.log('\n🟢 Lines with Perfect/Near-Perfect Accuracy (≥99%):');
    console.log('-'.repeat(50));
    const perfectLines = sortedLines.filter(l => l.accuracy >= 0.99);
    if (perfectLines.length > 0) {
      const lineNames = perfectLines.map(l => `${l.line} (${l.correct}/${l.total})`);
      // Group into columns for better display
      for (let i = 0; i < lineNames.length; i += 3) {
        console.log('  ' + lineNames.slice(i, i + 3).join(', '));
      }
    } else {
      console.log('  None');
    }

    // Statistics
    console.log('\n📊 STATISTICS:');
    console.log('='.repeat(70));
    const avgAccuracy = results.total > 0 ? (results.correct/results.total*100).toFixed(2) : 0;
    const linesWithIssues = sortedLines.filter(l => l.accuracy < 0.95).length;
    const perfectLinesCount = sortedLines.filter(l => l.accuracy >= 0.99).length;

    console.log(`Average accuracy across all lines: ${avgAccuracy}%`);
    console.log(`Cruise lines with issues (<95%): ${linesWithIssues}/${sortedLines.length}`);
    console.log(`Cruise lines with perfect/near-perfect (≥99%): ${perfectLinesCount}/${sortedLines.length}`);

    // Pattern detection
    console.log('\n🔍 PATTERN ANALYSIS:');
    console.log('='.repeat(70));

    // Check if certain cabin types have more issues
    const cabinIssues = {interior: 0, oceanview: 0, balcony: 0, suite: 0};
    for (const mismatch of results.mismatches) {
      for (const detail of mismatch.details) {
        for (const cabin of Object.keys(cabinIssues)) {
          if (detail.includes(cabin)) {
            cabinIssues[cabin]++;
          }
        }
      }
    }

    console.log('Mismatches by cabin type:');
    for (const [cabin, count] of Object.entries(cabinIssues)) {
      const pct = results.mismatch > 0 ? (count/results.mismatch*100).toFixed(1) : 0;
      console.log(`  ${cabin}: ${count} (${pct}% of all mismatches)`);
    }

    // Final recommendation
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('='.repeat(70));

    if (avgAccuracy >= 95) {
      console.log('✅ System accuracy is EXCELLENT (≥95%). No immediate action required.');
    } else if (avgAccuracy >= 90) {
      console.log('⚠️  System accuracy is GOOD (90-95%) but could be improved.');
      console.log('   Focus on cruise lines with <95% accuracy listed above.');
    } else {
      console.log('🔴 System accuracy is BELOW TARGET (<90%). Immediate action needed.');
      console.log('   Review webhook processor logic for affected cruise lines.');
    }

    if (linesWithIssues > 0) {
      console.log(`\n📝 Action Items:`);
      console.log(`   1. Review price extraction logic for ${linesWithIssues} cruise lines with issues`);
      console.log(`   2. Check if these lines have different JSON structures`);
      console.log(`   3. Consider implementing line-specific extraction strategies`);
    }

    // Export problem cruise IDs for fixing
    if (results.mismatches.length > 0) {
      const mismatchIds = results.mismatches.map(m => `'${m.id}'`).slice(0, 100);
      console.log('\n📋 SQL to identify problem cruises (first 100):');
      console.log(`SELECT id, name, cruise_line_id FROM cruises WHERE id IN (${mismatchIds.join(',')});`);
    }

  } catch (error) {
    console.error('\nError:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

validateLargeSample();
