/**
 * Test script to validate cruise prices against FTP files
 * Compares database prices with actual FTP file data for recently updated cruises
 */

const postgres = require('postgres');
const ftp = require('basic-ftp');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Database connection
const sql = postgres(process.env.DATABASE_URL, {
  ssl: process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

// FTP configuration
const FTP_CONFIG = {
  host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
  user: process.env.TRAVELTEK_FTP_USER || 'CEP_9_USD',
  password: process.env.TRAVELTEK_FTP_PASSWORD,
  secure: false,
};

// Configuration
const SAMPLE_SIZE = parseInt(process.env.SAMPLE_SIZE) || 50;
const HOURS_BACK = parseInt(process.env.HOURS_BACK) || 24;

async function getFtpConnection() {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access(FTP_CONFIG);
    return client;
  } catch (error) {
    console.error('Failed to connect to FTP:', error);
    throw error;
  }
}

async function fetchFtpFile(client, filePath) {
  try {
    const chunks = [];
    const stream = await client.downloadToWritable(filePath);

    return new Promise((resolve, reject) => {
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => {
        const content = Buffer.concat(chunks).toString('utf8');
        try {
          const json = JSON.parse(content);
          resolve(json);
        } catch (error) {
          reject(new Error(`Failed to parse JSON from ${filePath}: ${error.message}`));
        }
      });
      stream.on('error', reject);
    });
  } catch (error) {
    console.error(`Error fetching file ${filePath}:`, error);
    return null;
  }
}

function extractPricesFromFtpData(data, lineId) {
  const prices = {
    interior: null,
    oceanview: null,
    balcony: null,
    suite: null,
    cheapest: null,
  };

  // Helper function to parse and validate prices with Riviera Travel fix
  const parsePrice = (value, cabinType = 'cabin') => {
    if (!value) return null;
    let parsed = parseFloat(String(value));
    if (isNaN(parsed)) return null;

    // Fix Riviera Travel prices (they come in pence×10 from Traveltek FTP)
    if (lineId === 329) {
      parsed = parsed / 1000;
    }

    // Validate: no negative prices
    if (parsed < 0) {
      console.warn(`Negative ${cabinType} price: $${parsed}, setting to null`);
      return null;
    }

    return parsed > 0 ? parsed : null;
  };

  // Priority 1: cheapest.combined
  if (data.cheapest && data.cheapest.combined) {
    prices.interior = parsePrice(data.cheapest.combined.inside, 'interior');
    prices.oceanview = parsePrice(data.cheapest.combined.outside, 'oceanview');
    prices.balcony = parsePrice(data.cheapest.combined.balcony, 'balcony');
    prices.suite = parsePrice(data.cheapest.combined.suite, 'suite');
  }
  // Priority 2: cheapest.prices
  else if (data.cheapest && data.cheapest.prices) {
    prices.interior = parsePrice(data.cheapest.prices.inside, 'interior');
    prices.oceanview = parsePrice(data.cheapest.prices.outside, 'oceanview');
    prices.balcony = parsePrice(data.cheapest.prices.balcony, 'balcony');
    prices.suite = parsePrice(data.cheapest.prices.suite, 'suite');
  }
  // Priority 3: Individual cheapest objects
  else if (data.cheapestinside || data.cheapestoutside || data.cheapestbalcony || data.cheapestsuite) {
    if (data.cheapestinside) {
      prices.interior = parsePrice(data.cheapestinside.price || data.cheapestinside.total, 'interior');
    }
    if (data.cheapestoutside) {
      prices.oceanview = parsePrice(data.cheapestoutside.price || data.cheapestoutside.total, 'oceanview');
    }
    if (data.cheapestbalcony) {
      prices.balcony = parsePrice(data.cheapestbalcony.price || data.cheapestbalcony.total, 'balcony');
    }
    if (data.cheapestsuite) {
      prices.suite = parsePrice(data.cheapestsuite.price || data.cheapestsuite.total, 'suite');
    }
  }

  // Calculate cheapest overall from cabin prices
  const validPrices = [prices.interior, prices.oceanview, prices.balcony, prices.suite].filter(p => p > 0);
  prices.cheapest = validPrices.length > 0 ? Math.min(...validPrices) : null;

  return prices;
}

async function getRecentlyUpdatedCruises() {
  const query = `
    SELECT
      c.id,
      c.name,
      c.cruise_line_id,
      c.ship_id,
      c.sailing_date,
      c.cheapest_price,
      c.interior_price,
      c.oceanview_price,
      c.balcony_price,
      c.suite_price,
      c.updated_at,
      c.raw_data,
      cl.name as cruise_line_name,
      s.name as ship_name
    FROM cruises c
    JOIN cruise_lines cl ON c.cruise_line_id = cl.id
    JOIN ships s ON c.ship_id = s.id
    WHERE c.updated_at > NOW() - INTERVAL '${HOURS_BACK} hours'
      AND c.cheapest_price > 0
    ORDER BY c.updated_at DESC
    LIMIT ${SAMPLE_SIZE}
  `;

  const cruises = await sql.unsafe(query);
  return cruises;
}

function constructFtpPath(cruiseId, sailingDate, lineId, shipId) {
  const date = new Date(sailingDate);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  return `/${year}/${String(month).padStart(2, '0')}/${lineId}/${shipId}/${cruiseId}.json`;
}

async function validatePrices(cruise, ftpData) {
  const ftpPrices = extractPricesFromFtpData(ftpData, cruise.cruise_line_id);

  const discrepancies = [];
  const tolerance = 0.01; // Allow for small floating point differences

  // Compare each price type
  const priceTypes = [
    { db: 'cheapest_price', ftp: 'cheapest', name: 'Cheapest' },
    { db: 'interior_price', ftp: 'interior', name: 'Interior' },
    { db: 'oceanview_price', ftp: 'oceanview', name: 'Oceanview' },
    { db: 'balcony_price', ftp: 'balcony', name: 'Balcony' },
    { db: 'suite_price', ftp: 'suite', name: 'Suite' },
  ];

  for (const priceType of priceTypes) {
    const dbPrice = parseFloat(cruise[priceType.db]) || null;
    const ftpPrice = ftpPrices[priceType.ftp];

    // Skip if both are null
    if (dbPrice === null && ftpPrice === null) continue;

    // Check for missing prices
    if (dbPrice === null && ftpPrice !== null) {
      discrepancies.push({
        type: priceType.name,
        issue: 'Missing in DB',
        dbPrice: null,
        ftpPrice: ftpPrice,
        difference: ftpPrice,
      });
    } else if (dbPrice !== null && ftpPrice === null) {
      discrepancies.push({
        type: priceType.name,
        issue: 'Missing in FTP',
        dbPrice: dbPrice,
        ftpPrice: null,
        difference: -dbPrice,
      });
    }
    // Check for price differences
    else if (dbPrice !== null && ftpPrice !== null) {
      const difference = Math.abs(dbPrice - ftpPrice);
      if (difference > tolerance) {
        const percentDiff = ((dbPrice - ftpPrice) / ftpPrice * 100).toFixed(2);
        discrepancies.push({
          type: priceType.name,
          issue: 'Price Mismatch',
          dbPrice: dbPrice,
          ftpPrice: ftpPrice,
          difference: dbPrice - ftpPrice,
          percentDiff: percentDiff,
        });
      }
    }
  }

  return discrepancies;
}

async function main() {
  console.log('='.repeat(80));
  console.log('CRUISE PRICE VALIDATION TEST');
  console.log('='.repeat(80));
  console.log(`Sample Size: ${SAMPLE_SIZE} cruises`);
  console.log(`Time Range: Last ${HOURS_BACK} hours`);
  console.log(`Database: ${process.env.DATABASE_URL?.includes('production') ? 'PRODUCTION' : 'STAGING'}`);
  console.log('='.repeat(80));
  console.log();

  let ftpClient;
  const results = {
    total: 0,
    validated: 0,
    withDiscrepancies: 0,
    ftpErrors: 0,
    discrepanciesByType: {},
    cruisesWithIssues: [],
  };

  try {
    // Get recently updated cruises
    console.log('Fetching recently updated cruises...');
    const cruises = await getRecentlyUpdatedCruises();
    console.log(`Found ${cruises.length} cruises to validate\n`);

    if (cruises.length === 0) {
      console.log('No cruises found in the specified time range.');
      process.exit(0);
    }

    // Connect to FTP
    console.log('Connecting to FTP server...');
    ftpClient = await getFtpConnection();
    console.log('FTP connection established\n');

    // Validate each cruise
    for (let i = 0; i < cruises.length; i++) {
      const cruise = cruises[i];
      results.total++;

      process.stdout.write(`[${i + 1}/${cruises.length}] Validating cruise ${cruise.id} (${cruise.name})... `);

      // Construct FTP path
      const ftpPath = constructFtpPath(
        cruise.id,
        cruise.sailing_date,
        cruise.cruise_line_id,
        cruise.ship_id
      );

      // Fetch FTP file
      const ftpData = await fetchFtpFile(ftpClient, ftpPath);

      if (!ftpData) {
        console.log('❌ FTP file not found');
        results.ftpErrors++;
        continue;
      }

      // Validate prices
      const discrepancies = await validatePrices(cruise, ftpData);

      if (discrepancies.length > 0) {
        console.log(`⚠️  ${discrepancies.length} discrepancies found`);
        results.withDiscrepancies++;
        results.cruisesWithIssues.push({
          cruiseId: cruise.id,
          cruiseName: cruise.name,
          cruiseLine: cruise.cruise_line_name,
          ship: cruise.ship_name,
          sailingDate: cruise.sailing_date,
          discrepancies: discrepancies,
        });

        // Count discrepancies by type
        discrepancies.forEach(d => {
          const key = `${d.type} - ${d.issue}`;
          results.discrepanciesByType[key] = (results.discrepanciesByType[key] || 0) + 1;
        });
      } else {
        console.log('✅ All prices match');
        results.validated++;
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Cruises Checked: ${results.total}`);
    console.log(`✅ Fully Validated: ${results.validated} (${(results.validated / results.total * 100).toFixed(1)}%)`);
    console.log(`⚠️  With Discrepancies: ${results.withDiscrepancies} (${(results.withDiscrepancies / results.total * 100).toFixed(1)}%)`);
    console.log(`❌ FTP Errors: ${results.ftpErrors} (${(results.ftpErrors / results.total * 100).toFixed(1)}%)`);

    if (Object.keys(results.discrepanciesByType).length > 0) {
      console.log('\nDiscrepancies by Type:');
      Object.entries(results.discrepanciesByType)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log(`  ${type}: ${count}`);
        });
    }

    if (results.cruisesWithIssues.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('DETAILED DISCREPANCIES');
      console.log('='.repeat(80));

      // Show first 10 cruises with issues
      const toShow = Math.min(10, results.cruisesWithIssues.length);
      console.log(`Showing first ${toShow} cruises with discrepancies:\n`);

      results.cruisesWithIssues.slice(0, toShow).forEach(cruise => {
        console.log(`\nCruise ID: ${cruise.cruiseId}`);
        console.log(`Name: ${cruise.cruiseName}`);
        console.log(`Line: ${cruise.cruiseLine} | Ship: ${cruise.ship}`);
        console.log(`Sailing: ${new Date(cruise.sailingDate).toLocaleDateString()}`);
        console.log('Discrepancies:');

        cruise.discrepancies.forEach(d => {
          console.log(`  - ${d.type}: ${d.issue}`);
          console.log(`    DB: $${d.dbPrice || 'null'} | FTP: $${d.ftpPrice || 'null'}`);
          if (d.percentDiff) {
            console.log(`    Difference: $${d.difference.toFixed(2)} (${d.percentDiff}%)`);
          }
        });
      });

      // Save full results to file if there are many issues
      if (results.cruisesWithIssues.length > 10) {
        const fileName = `price-validation-${new Date().toISOString().split('T')[0]}.json`;
        const fs = require('fs');
        fs.writeFileSync(fileName, JSON.stringify(results, null, 2));
        console.log(`\nFull results saved to: ${fileName}`);
      }
    }

  } catch (error) {
    console.error('Error during validation:', error);
  } finally {
    if (ftpClient) {
      ftpClient.close();
    }
    await sql.end();
  }
}

// Run the script
main().catch(console.error);
