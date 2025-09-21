/**
 * Test script to validate cruise prices by cruise line
 * Tests last 100 cruises for each cruise line against FTP data
 */

const postgres = require('postgres');
const ftp = require('basic-ftp');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Database connection - use production if available
const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
const sql = postgres(databaseUrl, {
  ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
});

// FTP configuration
const FTP_CONFIG = {
  host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
  user: process.env.TRAVELTEK_FTP_USER || 'CEP_9_USD',
  password: process.env.TRAVELTEK_FTP_PASSWORD,
  secure: false,
};

// Configuration
const CRUISES_PER_LINE = parseInt(process.env.CRUISES_PER_LINE) || 100;
const SPECIFIC_LINE_ID = process.env.CRUISE_LINE_ID ? parseInt(process.env.CRUISE_LINE_ID) : null;

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
    // Use downloadTo with a writable stream
    const stream = require('stream');
    const chunks = [];

    const writable = new stream.Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      }
    });

    await client.downloadTo(writable, filePath);

    const content = Buffer.concat(chunks).toString('utf8');
    try {
      const json = JSON.parse(content);
      return json;
    } catch (error) {
      console.error(`Failed to parse JSON from ${filePath}: ${error.message}`);
      return null;
    }
  } catch (error) {
    // Silent fail for missing files - common in FTP
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

async function getCruiseLines() {
  let query;

  if (SPECIFIC_LINE_ID) {
    query = `
      SELECT DISTINCT
        cl.id,
        cl.name,
        COUNT(c.id) as total_cruises
      FROM cruise_lines cl
      LEFT JOIN cruises c ON c.cruise_line_id = cl.id
      WHERE cl.id = ${SPECIFIC_LINE_ID}
      GROUP BY cl.id, cl.name
      ORDER BY cl.name
    `;
  } else {
    query = `
      SELECT DISTINCT
        cl.id,
        cl.name,
        COUNT(c.id) as total_cruises
      FROM cruise_lines cl
      LEFT JOIN cruises c ON c.cruise_line_id = cl.id
      GROUP BY cl.id, cl.name
      HAVING COUNT(c.id) > 0
      ORDER BY COUNT(c.id) DESC
    `;
  }

  const lines = await sql.unsafe(query);
  return lines;
}

async function getCruisesForLine(lineId, limit) {
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
      cl.name as cruise_line_name,
      s.name as ship_name
    FROM cruises c
    JOIN cruise_lines cl ON c.cruise_line_id = cl.id
    JOIN ships s ON c.ship_id = s.id
    WHERE c.cruise_line_id = ${lineId}
      AND c.cheapest_price > 0
      AND c.sailing_date > NOW()
    ORDER BY c.updated_at DESC
    LIMIT ${limit}
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

async function validateCruiseLine(lineId, lineName, ftpClient) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${lineName} (ID: ${lineId})`);
  console.log(`${'='.repeat(60)}`);

  const results = {
    lineName: lineName,
    lineId: lineId,
    total: 0,
    validated: 0,
    withDiscrepancies: 0,
    ftpErrors: 0,
    discrepanciesByType: {},
    sampleDiscrepancies: [],
  };

  // Get cruises for this line
  const cruises = await getCruisesForLine(lineId, CRUISES_PER_LINE);
  console.log(`Found ${cruises.length} cruises to validate`);

  if (cruises.length === 0) {
    console.log('No cruises found for this cruise line');
    return results;
  }

  // Validate each cruise
  for (let i = 0; i < cruises.length; i++) {
    const cruise = cruises[i];
    results.total++;

    // Show progress every 10 cruises
    if (i % 10 === 0) {
      process.stdout.write(`Progress: ${i}/${cruises.length}\r`);
    }

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
      results.ftpErrors++;
      continue;
    }

    // Validate prices
    const discrepancies = await validatePrices(cruise, ftpData);

    if (discrepancies.length > 0) {
      results.withDiscrepancies++;

      // Store sample for report
      if (results.sampleDiscrepancies.length < 5) {
        results.sampleDiscrepancies.push({
          cruiseId: cruise.id,
          cruiseName: cruise.name,
          sailingDate: cruise.sailing_date,
          discrepancies: discrepancies,
        });
      }

      // Count discrepancies by type
      discrepancies.forEach(d => {
        const key = `${d.type} - ${d.issue}`;
        results.discrepanciesByType[key] = (results.discrepanciesByType[key] || 0) + 1;
      });
    } else {
      results.validated++;
    }
  }

  // Print summary for this line
  console.log(`\nResults for ${lineName}:`);
  console.log(`  Total Checked: ${results.total}`);
  console.log(`  ✅ Validated: ${results.validated} (${(results.validated / results.total * 100).toFixed(1)}%)`);
  console.log(`  ⚠️  Issues: ${results.withDiscrepancies} (${(results.withDiscrepancies / results.total * 100).toFixed(1)}%)`);
  console.log(`  ❌ FTP Missing: ${results.ftpErrors} (${(results.ftpErrors / results.total * 100).toFixed(1)}%)`);

  if (Object.keys(results.discrepanciesByType).length > 0) {
    console.log('\n  Issue Types:');
    Object.entries(results.discrepanciesByType)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`    ${type}: ${count}`);
      });
  }

  return results;
}

async function main() {
  console.log('='.repeat(80));
  console.log('CRUISE PRICE VALIDATION BY CRUISE LINE');
  console.log('='.repeat(80));
  console.log(`Database: ${databaseUrl?.includes('production') || databaseUrl?.includes('d2idqjjipnbc73abma3g') ? 'PRODUCTION' : 'STAGING'}`);
  console.log(`Samples per line: ${CRUISES_PER_LINE}`);

  if (SPECIFIC_LINE_ID) {
    console.log(`Testing specific cruise line ID: ${SPECIFIC_LINE_ID}`);
  } else {
    console.log('Testing all cruise lines');
  }

  console.log('='.repeat(80));

  let ftpClient;
  const allResults = [];
  const overallStats = {
    totalLines: 0,
    totalCruises: 0,
    totalValidated: 0,
    totalWithIssues: 0,
    totalFtpErrors: 0,
  };

  try {
    // Get cruise lines
    console.log('\nFetching cruise lines...');
    const cruiseLines = await getCruiseLines();
    console.log(`Found ${cruiseLines.length} cruise line(s) to test\n`);

    if (cruiseLines.length === 0) {
      console.log('No cruise lines found');
      process.exit(0);
    }

    // Connect to FTP
    console.log('Connecting to FTP server...');
    ftpClient = await getFtpConnection();
    console.log('FTP connection established');

    // Test each cruise line
    for (const line of cruiseLines) {
      const lineResults = await validateCruiseLine(line.id, line.name, ftpClient);
      allResults.push(lineResults);

      // Update overall stats
      overallStats.totalLines++;
      overallStats.totalCruises += lineResults.total;
      overallStats.totalValidated += lineResults.validated;
      overallStats.totalWithIssues += lineResults.withDiscrepancies;
      overallStats.totalFtpErrors += lineResults.ftpErrors;
    }

    // Print overall summary
    console.log('\n' + '='.repeat(80));
    console.log('OVERALL SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Lines Tested: ${overallStats.totalLines}`);
    console.log(`Total Cruises Checked: ${overallStats.totalCruises}`);
    console.log(`✅ Fully Validated: ${overallStats.totalValidated} (${(overallStats.totalValidated / overallStats.totalCruises * 100).toFixed(1)}%)`);
    console.log(`⚠️  With Discrepancies: ${overallStats.totalWithIssues} (${(overallStats.totalWithIssues / overallStats.totalCruises * 100).toFixed(1)}%)`);
    console.log(`❌ FTP Errors: ${overallStats.totalFtpErrors} (${(overallStats.totalFtpErrors / overallStats.totalCruises * 100).toFixed(1)}%)`);

    // Show lines with most issues
    console.log('\n' + '='.repeat(80));
    console.log('LINES WITH MOST ISSUES');
    console.log('='.repeat(80));

    const linesWithIssues = allResults
      .filter(r => r.withDiscrepancies > 0)
      .sort((a, b) => (b.withDiscrepancies / b.total) - (a.withDiscrepancies / a.total))
      .slice(0, 10);

    linesWithIssues.forEach(line => {
      const issueRate = (line.withDiscrepancies / line.total * 100).toFixed(1);
      console.log(`${line.lineName}: ${line.withDiscrepancies}/${line.total} cruises with issues (${issueRate}%)`);
    });

    // Save detailed results to file
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `cruise-line-validation-${timestamp}.json`;
    fs.writeFileSync(fileName, JSON.stringify({
      summary: overallStats,
      lineResults: allResults,
      timestamp: new Date().toISOString(),
      database: databaseUrl?.includes('production') || databaseUrl?.includes('d2idqjjipnbc73abma3g') ? 'PRODUCTION' : 'STAGING',
    }, null, 2));

    console.log(`\n✅ Detailed results saved to: ${fileName}`);

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
