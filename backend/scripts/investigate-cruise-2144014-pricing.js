/**
 * Investigation script for cruise 2144014 pricing mismatch
 * Wonder of the Seas - 2025-10-06
 */

const postgres = require('postgres');
const ftp = require('basic-ftp');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
const sql = postgres(databaseUrl, {
  ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function investigatePricing() {
  console.log('=' .repeat(80));
  console.log('INVESTIGATING CRUISE 2144014 PRICING MISMATCH');
  console.log('Wonder of the Seas - 2025-10-06');
  console.log('=' .repeat(80));
  console.log();

  try {
    // 1. Get current database pricing
    console.log('1. CURRENT DATABASE PRICING:');
    console.log('-'.repeat(40));

    const dbResult = await sql`
      SELECT
        id,
        cruise_id,
        name,
        sailing_date,
        cruise_line_id,
        ship_id,
        interior_cheapest_price,
        oceanview_cheapest_price,
        balcony_cheapest_price,
        suite_cheapest_price,
        cheapest_price,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        raw_data,
        updated_at,
        last_sync_at
      FROM cruises
      WHERE id = 2144014
    `;

    if (dbResult.length === 0) {
      console.log('❌ Cruise 2144014 not found in database');
      return;
    }

    const cruise = dbResult[0];
    console.log('Cruise Name:', cruise.name);
    console.log('Sailing Date:', cruise.sailing_date);
    console.log('Cruise Line ID:', cruise.cruise_line_id, '(Royal Caribbean is 22)');
    console.log('Last Updated:', cruise.updated_at);
    console.log('Last Sync:', cruise.last_sync_at);
    console.log();

    console.log('Current Pricing in Database:');
    console.log('  Interior:  $', cruise.interior_cheapest_price, '(cheapest) / $', cruise.interior_price, '(regular)');
    console.log('  Oceanview: $', cruise.oceanview_cheapest_price, '(cheapest) / $', cruise.oceanview_price, '(regular)');
    console.log('  Balcony:   $', cruise.balcony_cheapest_price, '(cheapest) / $', cruise.balcony_price, '(regular)');
    console.log('  Suite:     $', cruise.suite_cheapest_price, '(cheapest) / $', cruise.suite_price, '(regular)');
    console.log('  Cheapest Overall: $', cruise.cheapest_price);
    console.log();

    // 2. Check raw_data field
    console.log('2. RAW DATA ANALYSIS:');
    console.log('-'.repeat(40));

    if (cruise.raw_data) {
      try {
        const rawData = typeof cruise.raw_data === 'string'
          ? JSON.parse(cruise.raw_data)
          : cruise.raw_data;

        console.log('Raw data has pricing:', !!rawData.pricing);
        if (rawData.pricing) {
          console.log('Raw data pricing structure:');

          // Check for cheapest prices in raw data
          const cheapestPrices = {
            interior: null,
            oceanview: null,
            balcony: null,
            suite: null
          };

          if (Array.isArray(rawData.pricing)) {
            rawData.pricing.forEach(price => {
              const cabinType = price.cabin_category?.toLowerCase();
              const priceValue = parseFloat(price.price);

              if (cabinType && !isNaN(priceValue)) {
                if (!cheapestPrices[cabinType] || priceValue < cheapestPrices[cabinType]) {
                  cheapestPrices[cabinType] = priceValue;
                }
              }
            });
          }

          console.log('  Cheapest from raw_data:');
          console.log('    Interior:  $', cheapestPrices.interior);
          console.log('    Oceanview: $', cheapestPrices.oceanview);
          console.log('    Balcony:   $', cheapestPrices.balcony);
          console.log('    Suite:     $', cheapestPrices.suite);
        }
      } catch (e) {
        console.log('Error parsing raw_data:', e.message);
      }
    } else {
      console.log('No raw_data stored for this cruise');
    }
    console.log();

    // 3. Fetch FTP file
    console.log('3. FTP FILE PRICING:');
    console.log('-'.repeat(40));

    const ftpClient = new ftp.Client();
    ftpClient.ftp.verbose = false;

    try {
      await ftpClient.access({
        host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
        user: process.env.TRAVELTEK_FTP_USER || 'CEP_9_USD',
        password: process.env.TRAVELTEK_FTP_PASSWORD || 'g#3PmbVn',
        secure: false,
      });

      // Construct FTP path from sailing date
      const sailingDate = new Date(cruise.sailing_date);
      const year = sailingDate.getFullYear();
      const month = String(sailingDate.getMonth() + 1).padStart(2, '0');
      const day = String(sailingDate.getDate()).padStart(2, '0');

      // Path format: /YYYY/MM/DD/22/2144014.json (22 is Royal Caribbean)
      const ftpPath = `/${year}/${month}/${day}/22/2144014.json`;
      console.log('FTP Path:', ftpPath);

      const stream = require('stream');
      const chunks = [];
      const writable = new stream.Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });

      await ftpClient.downloadTo(writable, ftpPath);
      const ftpContent = Buffer.concat(chunks).toString('utf8');
      const ftpData = JSON.parse(ftpContent);

      console.log('FTP File Found ✅');
      console.log('FTP Pricing Data:');

      // Extract cheapest prices from FTP
      const ftpPrices = {
        cheapestinterior: ftpData.cheapestinterior,
        cheapestoutside: ftpData.cheapestoutside,
        cheapestbalcony: ftpData.cheapestbalcony,
        cheapestsuite: ftpData.cheapestsuite
      };

      console.log('  cheapestinterior:  $', ftpPrices.cheapestinterior);
      console.log('  cheapestoutside:   $', ftpPrices.cheapestoutside);
      console.log('  cheapestbalcony:   $', ftpPrices.cheapestbalcony);
      console.log('  cheapestsuite:     $', ftpPrices.cheapestsuite);
      console.log();

      // 4. Compare pricing
      console.log('4. PRICING COMPARISON:');
      console.log('-'.repeat(40));
      console.log('Category    | Database | FTP File | Match?');
      console.log('-'.repeat(45));
      console.log(`Interior    | $${cruise.interior_cheapest_price?.padEnd(7)} | $${ftpPrices.cheapestinterior?.toString().padEnd(7)} | ${cruise.interior_cheapest_price == ftpPrices.cheapestinterior ? '✅' : '❌'}`);
      console.log(`Oceanview   | $${cruise.oceanview_cheapest_price?.padEnd(7)} | $${ftpPrices.cheapestoutside?.toString().padEnd(7)} | ${cruise.oceanview_cheapest_price == ftpPrices.cheapestoutside ? '✅' : '❌'}`);
      console.log(`Balcony     | $${cruise.balcony_cheapest_price?.padEnd(7)} | $${ftpPrices.cheapestbalcony?.toString().padEnd(7)} | ${cruise.balcony_cheapest_price == ftpPrices.cheapestbalcony ? '✅' : '❌'}`);
      console.log(`Suite       | $${cruise.suite_cheapest_price?.padEnd(7)} | $${ftpPrices.cheapestsuite?.toString().padEnd(7)} | ${cruise.suite_cheapest_price == ftpPrices.cheapestsuite ? '✅' : '❌'}`);
      console.log();

      // 5. Check webhook events
      console.log('5. RECENT SYNC HISTORY:');
      console.log('-'.repeat(40));

      const webhookEvents = await sql`
        SELECT
          id,
          line_id,
          status,
          created_at,
          completed_at,
          metadata
        FROM webhook_events
        WHERE line_id = 22
        ORDER BY created_at DESC
        LIMIT 5
      `;

      console.log('Last 5 webhook events for Royal Caribbean (line 22):');
      webhookEvents.forEach(event => {
        const duration = event.completed_at
          ? Math.round((new Date(event.completed_at) - new Date(event.created_at)) / 1000)
          : 'N/A';
        console.log(`  ${event.created_at} - Status: ${event.status} (Duration: ${duration}s)`);
      });

      await ftpClient.close();

    } catch (ftpError) {
      console.log('❌ FTP Error:', ftpError.message);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

investigatePricing();
