/**
 * Check all cruises under $300 sailing October 2025 or later
 * Compare database prices with raw_data (which contains FTP data)
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prodUrl = process.env.DATABASE_URL_PRODUCTION || 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';
const sql = postgres(prodUrl, { ssl: { rejectUnauthorized: false } });

function extractPricesFromRawData(rawData, cruiseLineId) {
  if (!rawData) return null;

  const prices = {
    interior: null,
    oceanview: null,
    balcony: null,
    suite: null
  };

  // Priority 1: Direct cheapestX fields
  if (rawData.cheapestinside !== undefined) {
    prices.interior = parseFloat(rawData.cheapestinside) || null;
  }
  if (rawData.cheapestoutside !== undefined) {
    prices.oceanview = parseFloat(rawData.cheapestoutside) || null;
  }
  if (rawData.cheapestbalcony !== undefined) {
    prices.balcony = parseFloat(rawData.cheapestbalcony) || null;
  }
  if (rawData.cheapestsuite !== undefined) {
    prices.suite = parseFloat(rawData.cheapestsuite) || null;
  }

  // Priority 2: cheapest.prices object
  if (rawData.cheapest?.prices) {
    if (prices.interior === null && rawData.cheapest.prices.inside !== undefined) {
      prices.interior = parseFloat(rawData.cheapest.prices.inside) || null;
    }
    if (prices.oceanview === null && rawData.cheapest.prices.outside !== undefined) {
      prices.oceanview = parseFloat(rawData.cheapest.prices.outside) || null;
    }
    if (prices.balcony === null && rawData.cheapest.prices.balcony !== undefined) {
      prices.balcony = parseFloat(rawData.cheapest.prices.balcony) || null;
    }
    if (prices.suite === null && rawData.cheapest.prices.suite !== undefined) {
      prices.suite = parseFloat(rawData.cheapest.prices.suite) || null;
    }
  }

  // Special handling for Riviera Travel (cruise_line_id 329)
  if (cruiseLineId === 329) {
    if (prices.interior) prices.interior = prices.interior / 1000;
    if (prices.oceanview) prices.oceanview = prices.oceanview / 1000;
    if (prices.balcony) prices.balcony = prices.balcony / 1000;
    if (prices.suite) prices.suite = prices.suite / 1000;
  }

  return prices;
}

async function main() {
  console.log('=' .repeat(80));
  console.log('CHECKING CRUISES UNDER $300 (OCTOBER 2025+) AGAINST RAW_DATA');
  console.log('=' .repeat(80));
  console.log();

  try {
    // Get all cruises under $300 sailing October 2025 or later
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
      AND sailing_date >= '2025-10-01'
      AND is_active = true
      ORDER BY cheapest_price ASC
      LIMIT 100
    `;

    console.log(`Checking first 100 of cruises under $300 sailing October 2025 or later\n`);

    const mismatches = [];
    const noRawData = [];
    const suspicious = [];
    let checked = 0;

    for (const cruise of cruises) {
      checked++;

      if (!cruise.raw_data) {
        noRawData.push({
          id: cruise.id,
          name: cruise.name,
          cheapestPrice: cruise.cheapest_price
        });
        continue;
      }

      // Extract prices from raw_data
      const rawPrices = extractPricesFromRawData(cruise.raw_data, cruise.cruise_line_id);

      if (!rawPrices) {
        continue;
      }

      // Compare prices
      const dbPrices = {
        interior: parseFloat(cruise.interior_price) || null,
        oceanview: parseFloat(cruise.oceanview_price) || null,
        balcony: parseFloat(cruise.balcony_price) || null,
        suite: parseFloat(cruise.suite_price) || null
      };

      const differences = [];

      // Check if prices are suspiciously low (under $50 for any cabin)
      const suspiciouslyLow = [];
      if (dbPrices.interior && dbPrices.interior < 50) suspiciouslyLow.push(`Interior: $${dbPrices.interior}`);
      if (dbPrices.oceanview && dbPrices.oceanview < 50) suspiciouslyLow.push(`Oceanview: $${dbPrices.oceanview}`);
      if (dbPrices.balcony && dbPrices.balcony < 50) suspiciouslyLow.push(`Balcony: $${dbPrices.balcony}`);
      if (dbPrices.suite && dbPrices.suite < 50) suspiciouslyLow.push(`Suite: $${dbPrices.suite}`);

      if (suspiciouslyLow.length > 0) {
        suspicious.push({
          id: cruise.id,
          cruise_id: cruise.cruise_id,
          name: cruise.name,
          sailingDate: cruise.sailing_date,
          suspiciouslyLow,
          dbPrices,
          rawPrices,
          hasCachedPrices: !!cruise.raw_data.cheapest?.cachedprices
        });
      }

      // Compare each cabin type
      if (rawPrices.interior !== null && dbPrices.interior !== null) {
        if (Math.abs(dbPrices.interior - rawPrices.interior) > 0.01) {
          differences.push(`Interior: DB=$${dbPrices.interior} vs Raw=$${rawPrices.interior}`);
        }
      }

      if (rawPrices.oceanview !== null && dbPrices.oceanview !== null) {
        if (Math.abs(dbPrices.oceanview - rawPrices.oceanview) > 0.01) {
          differences.push(`Oceanview: DB=$${dbPrices.oceanview} vs Raw=$${rawPrices.oceanview}`);
        }
      }

      if (rawPrices.balcony !== null && dbPrices.balcony !== null) {
        if (Math.abs(dbPrices.balcony - rawPrices.balcony) > 0.01) {
          differences.push(`Balcony: DB=$${dbPrices.balcony} vs Raw=$${rawPrices.balcony}`);
        }
      }

      if (rawPrices.suite !== null && dbPrices.suite !== null) {
        if (Math.abs(dbPrices.suite - rawPrices.suite) > 0.01) {
          differences.push(`Suite: DB=$${dbPrices.suite} vs Raw=$${rawPrices.suite}`);
        }
      }

      if (differences.length > 0) {
        mismatches.push({
          id: cruise.id,
          cruise_id: cruise.cruise_id,
          name: cruise.name,
          sailingDate: cruise.sailing_date,
          cheapestPrice: cruise.cheapest_price,
          differences,
          dbPrices,
          rawPrices,
          hasCachedPrices: !!cruise.raw_data.cheapest?.cachedprices,
          lastUpdated: cruise.updated_at
        });
      }
    }

    // Report results
    console.log();
    console.log('=' .repeat(80));
    console.log('RESULTS');
    console.log('=' .repeat(80));
    console.log(`Total cruises checked: ${cruises.length}`);
    console.log(`Mismatches found: ${mismatches.length}`);
    console.log(`No raw_data: ${noRawData.length}`);
    console.log(`Suspiciously low prices (< $50): ${suspicious.length}`);
    console.log();

    if (suspicious.length > 0) {
      console.log('⚠️  SUSPICIOUSLY LOW PRICES (< $50):');
      console.log('=' .repeat(80));

      for (const cruise of suspicious) {
        console.log();
        console.log(`Cruise ${cruise.id} (${cruise.cruise_id}): ${cruise.name}`);
        console.log(`  Sailing: ${new Date(cruise.sailingDate).toISOString().split('T')[0]}`);
        console.log(`  Suspicious prices:`, cruise.suspiciouslyLow.join(', '));
        console.log(`  Database prices:`, JSON.stringify(cruise.dbPrices));
        console.log(`  Raw data prices:`, JSON.stringify(cruise.rawPrices));
        console.log(`  Has cached prices: ${cruise.hasCachedPrices}`);
      }
    }

    if (mismatches.length > 0) {
      console.log();
      console.log('PRICE MISMATCHES (DB vs RAW_DATA):');
      console.log('=' .repeat(80));

      for (const mismatch of mismatches) {
        console.log();
        console.log(`Cruise ${mismatch.id} (${mismatch.cruise_id}): ${mismatch.name}`);
        console.log(`  Sailing: ${new Date(mismatch.sailingDate).toISOString().split('T')[0]}`);
        console.log(`  Cheapest: $${mismatch.cheapestPrice}`);
        console.log(`  Last updated: ${mismatch.lastUpdated}`);
        console.log(`  Differences:`);
        mismatch.differences.forEach(diff => console.log(`    - ${diff}`));
        console.log(`  Database prices:`, JSON.stringify(mismatch.dbPrices));
        console.log(`  Raw data prices:`, JSON.stringify(mismatch.rawPrices));
      }
    }

    // Check data structure patterns
    console.log();
    console.log('DATA STRUCTURE ANALYSIS:');
    console.log('=' .repeat(80));

    let hasCheapestX = 0;
    let hasPricesObject = 0;
    let hasCachedPrices = 0;
    let hasCombined = 0;

    for (const cruise of cruises) {
      if (!cruise.raw_data) continue;

      if (cruise.raw_data.cheapestinside !== undefined) hasCheapestX++;
      if (cruise.raw_data.cheapest?.prices) hasPricesObject++;
      if (cruise.raw_data.cheapest?.cachedprices) hasCachedPrices++;
      if (cruise.raw_data.cheapest?.combined) hasCombined++;
    }

    console.log(`Has direct cheapestX fields: ${hasCheapestX}`);
    console.log(`Has prices object: ${hasPricesObject}`);
    console.log(`Has cached prices: ${hasCachedPrices}`);
    console.log(`Has combined: ${hasCombined}`);

    // Top 10 cheapest
    console.log();
    console.log('TOP 10 CHEAPEST CRUISES:');
    console.log('=' .repeat(80));

    for (const cruise of cruises.slice(0, 10)) {
      console.log(`$${cruise.cheapest_price} - ${cruise.name} (${new Date(cruise.sailing_date).toISOString().split('T')[0]})`);
      console.log(`  Interior: $${cruise.interior_price || 'N/A'}, Ocean: $${cruise.oceanview_price || 'N/A'}, Balcony: $${cruise.balcony_price || 'N/A'}, Suite: $${cruise.suite_price || 'N/A'}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
