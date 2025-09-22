/**
 * Check ALL cruises under $300 sailing October 2025 or later
 * Thoroughly analyze raw_data pricing structures
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prodUrl = process.env.DATABASE_URL_PRODUCTION || 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';
const sql = postgres(prodUrl, { ssl: { rejectUnauthorized: false } });

function extractAllPriceData(rawData, cruiseLineId) {
  if (!rawData) return { source: 'no_raw_data', prices: null };

  const result = {
    source: [],
    prices: {
      interior: null,
      oceanview: null,
      balcony: null,
      suite: null
    },
    cached: null,
    combined: null
  };

  // Check for direct cheapestX fields
  if (rawData.cheapestinside !== undefined ||
      rawData.cheapestoutside !== undefined ||
      rawData.cheapestbalcony !== undefined ||
      rawData.cheapestsuite !== undefined) {
    result.source.push('direct_fields');

    if (rawData.cheapestinside !== undefined) {
      result.prices.interior = parseFloat(rawData.cheapestinside) || null;
    }
    if (rawData.cheapestoutside !== undefined) {
      result.prices.oceanview = parseFloat(rawData.cheapestoutside) || null;
    }
    if (rawData.cheapestbalcony !== undefined) {
      result.prices.balcony = parseFloat(rawData.cheapestbalcony) || null;
    }
    if (rawData.cheapestsuite !== undefined) {
      result.prices.suite = parseFloat(rawData.cheapestsuite) || null;
    }
  }

  // Check cheapest.prices object
  if (rawData.cheapest?.prices) {
    result.source.push('prices_object');

    if (!result.prices.interior && rawData.cheapest.prices.inside !== undefined) {
      result.prices.interior = parseFloat(rawData.cheapest.prices.inside) || null;
    }
    if (!result.prices.oceanview && rawData.cheapest.prices.outside !== undefined) {
      result.prices.oceanview = parseFloat(rawData.cheapest.prices.outside) || null;
    }
    if (!result.prices.balcony && rawData.cheapest.prices.balcony !== undefined) {
      result.prices.balcony = parseFloat(rawData.cheapest.prices.balcony) || null;
    }
    if (!result.prices.suite && rawData.cheapest.prices.suite !== undefined) {
      result.prices.suite = parseFloat(rawData.cheapest.prices.suite) || null;
    }
  }

  // Store cached prices separately for comparison
  if (rawData.cheapest?.cachedprices) {
    result.source.push('has_cached');
    result.cached = {
      interior: parseFloat(rawData.cheapest.cachedprices.inside) || null,
      oceanview: parseFloat(rawData.cheapest.cachedprices.outside) || null,
      balcony: parseFloat(rawData.cheapest.cachedprices.balcony) || null,
      suite: parseFloat(rawData.cheapest.cachedprices.suite) || null
    };
  }

  // Store combined for analysis
  if (rawData.cheapest?.combined) {
    result.source.push('has_combined');
    result.combined = {
      interior: parseFloat(rawData.cheapest.combined.inside) || null,
      oceanview: parseFloat(rawData.cheapest.combined.outside) || null,
      balcony: parseFloat(rawData.cheapest.combined.balcony) || null,
      suite: parseFloat(rawData.cheapest.combined.suite) || null
    };
  }

  // Special handling for Riviera Travel
  if (cruiseLineId === 329) {
    if (result.prices.interior) result.prices.interior = result.prices.interior / 1000;
    if (result.prices.oceanview) result.prices.oceanview = result.prices.oceanview / 1000;
    if (result.prices.balcony) result.prices.balcony = result.prices.balcony / 1000;
    if (result.prices.suite) result.prices.suite = result.prices.suite / 1000;
  }

  if (result.source.length === 0) {
    result.source.push('no_price_data');
  }

  return result;
}

async function main() {
  console.log('=' .repeat(80));
  console.log('CHECKING ALL CRUISES UNDER $300 (OCTOBER 2025+)');
  console.log('=' .repeat(80));
  console.log();

  try {
    // Get ALL cruises under $300
    const cruises = await sql`
      SELECT
        id,
        cruise_id,
        name,
        cruise_line_id,
        ship_id,
        sailing_date,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price,
        updated_at,
        raw_data
      FROM cruises
      WHERE cheapest_price::decimal < 300
      AND cheapest_price::decimal > 0
      AND sailing_date >= '2025-10-01'
      AND is_active = true
      ORDER BY cheapest_price ASC
    `;

    console.log(`Found ${cruises.length} active cruises under $300 sailing October 2025+\n`);

    const stats = {
      total: cruises.length,
      noRawData: 0,
      hasDirectFields: 0,
      hasPricesObject: 0,
      hasCachedOnly: 0,
      noPriceData: 0,
      mismatches: [],
      cachedVsFresh: [],
      suspiciouslyLow: []
    };

    let processed = 0;

    for (const cruise of cruises) {
      processed++;

      if (!cruise.raw_data) {
        stats.noRawData++;
        continue;
      }

      const extractedData = extractAllPriceData(cruise.raw_data, cruise.cruise_line_id);

      // Count data sources
      if (extractedData.source.includes('direct_fields')) stats.hasDirectFields++;
      if (extractedData.source.includes('prices_object')) stats.hasPricesObject++;
      if (extractedData.source.includes('has_cached') && !extractedData.source.includes('direct_fields') && !extractedData.source.includes('prices_object')) {
        stats.hasCachedOnly++;
      }
      if (extractedData.source.includes('no_price_data')) stats.noPriceData++;

      // Check for mismatches between DB and fresh data
      const dbPrices = {
        interior: parseFloat(cruise.interior_price) || null,
        oceanview: parseFloat(cruise.oceanview_price) || null,
        balcony: parseFloat(cruise.balcony_price) || null,
        suite: parseFloat(cruise.suite_price) || null
      };

      // If we have fresh prices, compare
      if (extractedData.prices.interior || extractedData.prices.oceanview ||
          extractedData.prices.balcony || extractedData.prices.suite) {

        const differences = [];

        if (extractedData.prices.interior && dbPrices.interior) {
          const diff = Math.abs(dbPrices.interior - extractedData.prices.interior);
          if (diff > 0.01) {
            differences.push({
              type: 'interior',
              db: dbPrices.interior,
              fresh: extractedData.prices.interior,
              diff: diff
            });
          }
        }

        if (extractedData.prices.oceanview && dbPrices.oceanview) {
          const diff = Math.abs(dbPrices.oceanview - extractedData.prices.oceanview);
          if (diff > 0.01) {
            differences.push({
              type: 'oceanview',
              db: dbPrices.oceanview,
              fresh: extractedData.prices.oceanview,
              diff: diff
            });
          }
        }

        if (extractedData.prices.balcony && dbPrices.balcony) {
          const diff = Math.abs(dbPrices.balcony - extractedData.prices.balcony);
          if (diff > 0.01) {
            differences.push({
              type: 'balcony',
              db: dbPrices.balcony,
              fresh: extractedData.prices.balcony,
              diff: diff
            });
          }
        }

        if (extractedData.prices.suite && dbPrices.suite) {
          const diff = Math.abs(dbPrices.suite - extractedData.prices.suite);
          if (diff > 0.01) {
            differences.push({
              type: 'suite',
              db: dbPrices.suite,
              fresh: extractedData.prices.suite,
              diff: diff
            });
          }
        }

        if (differences.length > 0) {
          stats.mismatches.push({
            id: cruise.id,
            name: cruise.name,
            differences: differences,
            lastUpdated: cruise.updated_at
          });
        }
      }

      // Check if cached differs from fresh (when both exist)
      if (extractedData.cached && extractedData.prices.interior) {
        const cachedDiff = Math.abs((extractedData.cached.interior || 0) - extractedData.prices.interior);
        if (cachedDiff > 0.01) {
          stats.cachedVsFresh.push({
            id: cruise.id,
            name: cruise.name,
            cached: extractedData.cached.interior,
            fresh: extractedData.prices.interior
          });
        }
      }

      // Check for suspiciously low prices
      if (dbPrices.interior && dbPrices.interior < 50 ||
          dbPrices.oceanview && dbPrices.oceanview < 50 ||
          dbPrices.balcony && dbPrices.balcony < 50) {
        stats.suspiciouslyLow.push({
          id: cruise.id,
          name: cruise.name,
          prices: dbPrices
        });
      }

      // Progress indicator
      if (processed % 100 === 0) {
        console.log(`Progress: ${processed}/${cruises.length} checked`);
      }
    }

    // Report results
    console.log();
    console.log('=' .repeat(80));
    console.log('FINAL RESULTS FOR ALL ' + stats.total + ' CRUISES');
    console.log('=' .repeat(80));
    console.log();

    console.log('RAW DATA AVAILABILITY:');
    console.log(`- No raw_data at all: ${stats.noRawData} (${(stats.noRawData/stats.total*100).toFixed(1)}%)`);
    console.log(`- Has direct price fields: ${stats.hasDirectFields} (${(stats.hasDirectFields/stats.total*100).toFixed(1)}%)`);
    console.log(`- Has prices object: ${stats.hasPricesObject} (${(stats.hasPricesObject/stats.total*100).toFixed(1)}%)`);
    console.log(`- Has only cached prices: ${stats.hasCachedOnly} (${(stats.hasCachedOnly/stats.total*100).toFixed(1)}%)`);
    console.log(`- No price data in raw_data: ${stats.noPriceData} (${(stats.noPriceData/stats.total*100).toFixed(1)}%)`);
    console.log();

    console.log('PRICE VERIFICATION:');
    console.log(`- Mismatches found: ${stats.mismatches.length} (${(stats.mismatches.length/stats.total*100).toFixed(1)}%)`);
    console.log(`- Cached vs Fresh differences: ${stats.cachedVsFresh.length}`);
    console.log(`- Suspiciously low (<$50): ${stats.suspiciouslyLow.length} (${(stats.suspiciouslyLow.length/stats.total*100).toFixed(1)}%)`);
    console.log();

    if (stats.mismatches.length > 0) {
      console.log('PRICE MISMATCHES (DB vs FRESH DATA):');
      console.log('=' .repeat(80));

      for (const mismatch of stats.mismatches.slice(0, 10)) {
        console.log(`\nCruise ${mismatch.id}: ${mismatch.name}`);
        console.log(`  Last updated: ${mismatch.lastUpdated}`);
        for (const diff of mismatch.differences) {
          console.log(`  ${diff.type}: DB=$${diff.db} vs Fresh=$${diff.fresh} (diff: $${diff.diff.toFixed(2)})`);
        }
      }

      if (stats.mismatches.length > 10) {
        console.log(`\n... and ${stats.mismatches.length - 10} more mismatches`);
      }
    }

    // Summary
    console.log();
    console.log('SUMMARY:');
    console.log('=' .repeat(80));
    console.log(`✅ ${stats.total - stats.mismatches.length} cruises have correct prices`);
    console.log(`❌ ${stats.mismatches.length} cruises have price mismatches`);
    console.log(`⚠️  ${stats.noPriceData} cruises cannot be verified (no price data in raw_data)`);
    console.log(`📊 ${stats.suspiciouslyLow.length} cruises have suspiciously low prices (<$50)`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
