/**
 * Check all cruises under $300 sailing October 2025 or later
 * Compare database prices with FTP server prices
 */

const postgres = require('postgres');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prodUrl = process.env.DATABASE_URL_PRODUCTION || 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';
const sql = postgres(prodUrl, { ssl: { rejectUnauthorized: false } });

const FTP_BASE = '/Volumes/Data_2TB/zipsea-ftp-backup';

async function checkFTPFile(cruise) {
  // Build FTP path: /YYYY/MM/DD/{cruise_line_id}/{ship_id}/{cruise_id}.json
  const sailingDate = new Date(cruise.sailing_date);
  const year = sailingDate.getFullYear();
  const month = String(sailingDate.getMonth() + 1).padStart(2, '0');
  const day = String(sailingDate.getDate()).padStart(2, '0');

  const ftpPath = path.join(
    FTP_BASE,
    year.toString(),
    month,
    day,
    cruise.cruise_line_id.toString(),
    cruise.ship_id.toString(),
    `${cruise.cruise_id}.json`
  );

  try {
    const fileContent = await fs.readFile(ftpPath, 'utf-8');
    const ftpData = JSON.parse(fileContent);

    // Extract prices from FTP data
    const ftpPrices = {
      interior: null,
      oceanview: null,
      balcony: null,
      suite: null
    };

    // Priority 1: Direct cheapestX fields
    if (ftpData.cheapestinside !== undefined) {
      ftpPrices.interior = parseFloat(ftpData.cheapestinside) || null;
    }
    if (ftpData.cheapestoutside !== undefined) {
      ftpPrices.oceanview = parseFloat(ftpData.cheapestoutside) || null;
    }
    if (ftpData.cheapestbalcony !== undefined) {
      ftpPrices.balcony = parseFloat(ftpData.cheapestbalcony) || null;
    }
    if (ftpData.cheapestsuite !== undefined) {
      ftpPrices.suite = parseFloat(ftpData.cheapestsuite) || null;
    }

    // Priority 2: cheapest.prices object
    if (ftpData.cheapest?.prices) {
      if (ftpPrices.interior === null && ftpData.cheapest.prices.inside !== undefined) {
        ftpPrices.interior = parseFloat(ftpData.cheapest.prices.inside) || null;
      }
      if (ftpPrices.oceanview === null && ftpData.cheapest.prices.outside !== undefined) {
        ftpPrices.oceanview = parseFloat(ftpData.cheapest.prices.outside) || null;
      }
      if (ftpPrices.balcony === null && ftpData.cheapest.prices.balcony !== undefined) {
        ftpPrices.balcony = parseFloat(ftpData.cheapest.prices.balcony) || null;
      }
      if (ftpPrices.suite === null && ftpData.cheapest.prices.suite !== undefined) {
        ftpPrices.suite = parseFloat(ftpData.cheapest.prices.suite) || null;
      }
    }

    // Special handling for Riviera Travel (cruise_line_id 329)
    if (cruise.cruise_line_id === 329) {
      if (ftpPrices.interior) ftpPrices.interior = ftpPrices.interior / 1000;
      if (ftpPrices.oceanview) ftpPrices.oceanview = ftpPrices.oceanview / 1000;
      if (ftpPrices.balcony) ftpPrices.balcony = ftpPrices.balcony / 1000;
      if (ftpPrices.suite) ftpPrices.suite = ftpPrices.suite / 1000;
    }

    return {
      found: true,
      path: ftpPath,
      ftpPrices,
      hasCachedPrices: !!ftpData.cheapest?.cachedprices,
      hasCombined: !!ftpData.cheapest?.combined
    };
  } catch (error) {
    return {
      found: false,
      path: ftpPath,
      error: error.message
    };
  }
}

async function main() {
  console.log('=' .repeat(80));
  console.log('CHECKING CRUISES UNDER $300 (OCTOBER 2025+)');
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
        updated_at
      FROM cruises
      WHERE cheapest_price::decimal < 300
      AND sailing_date >= '2025-10-01'
      AND is_active = true
      ORDER BY cheapest_price ASC
    `;

    console.log(`Found ${cruises.length} cruises under $300 sailing October 2025 or later\n`);

    const mismatches = [];
    const notFoundOnFTP = [];
    let checked = 0;

    for (const cruise of cruises) {
      checked++;

      // Check FTP file
      const ftpResult = await checkFTPFile(cruise);

      if (!ftpResult.found) {
        notFoundOnFTP.push({
          id: cruise.id,
          name: cruise.name,
          sailingDate: cruise.sailing_date,
          path: ftpResult.path
        });
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

      // Compare each cabin type
      if (ftpResult.ftpPrices.interior !== null && dbPrices.interior !== null) {
        if (Math.abs(dbPrices.interior - ftpResult.ftpPrices.interior) > 0.01) {
          differences.push(`Interior: DB=$${dbPrices.interior} vs FTP=$${ftpResult.ftpPrices.interior}`);
        }
      }

      if (ftpResult.ftpPrices.oceanview !== null && dbPrices.oceanview !== null) {
        if (Math.abs(dbPrices.oceanview - ftpResult.ftpPrices.oceanview) > 0.01) {
          differences.push(`Oceanview: DB=$${dbPrices.oceanview} vs FTP=$${ftpResult.ftpPrices.oceanview}`);
        }
      }

      if (ftpResult.ftpPrices.balcony !== null && dbPrices.balcony !== null) {
        if (Math.abs(dbPrices.balcony - ftpResult.ftpPrices.balcony) > 0.01) {
          differences.push(`Balcony: DB=$${dbPrices.balcony} vs FTP=$${ftpResult.ftpPrices.balcony}`);
        }
      }

      if (ftpResult.ftpPrices.suite !== null && dbPrices.suite !== null) {
        if (Math.abs(dbPrices.suite - ftpResult.ftpPrices.suite) > 0.01) {
          differences.push(`Suite: DB=$${dbPrices.suite} vs FTP=$${ftpResult.ftpPrices.suite}`);
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
          hasCachedPrices: ftpResult.hasCachedPrices,
          hasCombined: ftpResult.hasCombined,
          lastUpdated: cruise.updated_at
        });
      }

      // Progress indicator
      if (checked % 10 === 0) {
        console.log(`Progress: ${checked}/${cruises.length} checked, ${mismatches.length} mismatches found`);
      }
    }

    // Report results
    console.log();
    console.log('=' .repeat(80));
    console.log('RESULTS');
    console.log('=' .repeat(80));
    console.log(`Total cruises checked: ${cruises.length}`);
    console.log(`Mismatches found: ${mismatches.length}`);
    console.log(`FTP files not found: ${notFoundOnFTP.length}`);
    console.log(`Percentage with mismatches: ${(mismatches.length / cruises.length * 100).toFixed(1)}%`);
    console.log();

    if (mismatches.length > 0) {
      console.log('PRICE MISMATCHES:');
      console.log('=' .repeat(80));

      for (const mismatch of mismatches.slice(0, 20)) { // Show first 20
        console.log();
        console.log(`Cruise ${mismatch.id} (${mismatch.cruise_id}): ${mismatch.name}`);
        console.log(`  Sailing: ${new Date(mismatch.sailingDate).toISOString().split('T')[0]}`);
        console.log(`  Cheapest: $${mismatch.cheapestPrice}`);
        console.log(`  Last updated: ${mismatch.lastUpdated}`);
        console.log(`  Has cached prices: ${mismatch.hasCachedPrices}`);
        console.log(`  Differences:`);
        mismatch.differences.forEach(diff => console.log(`    - ${diff}`));
      }

      if (mismatches.length > 20) {
        console.log();
        console.log(`... and ${mismatches.length - 20} more mismatches`);
      }
    }

    if (notFoundOnFTP.length > 0) {
      console.log();
      console.log('FTP FILES NOT FOUND:');
      console.log('=' .repeat(80));

      for (const missing of notFoundOnFTP.slice(0, 5)) {
        console.log(`  ${missing.id}: ${missing.name} (${new Date(missing.sailingDate).toISOString().split('T')[0]})`);
      }

      if (notFoundOnFTP.length > 5) {
        console.log(`  ... and ${notFoundOnFTP.length - 5} more`);
      }
    }

    // Summary of cheapest cruises
    console.log();
    console.log('TOP 10 CHEAPEST CRUISES:');
    console.log('=' .repeat(80));

    for (const cruise of cruises.slice(0, 10)) {
      console.log(`$${cruise.cheapest_price} - ${cruise.name} (${new Date(cruise.sailing_date).toISOString().split('T')[0]})`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
