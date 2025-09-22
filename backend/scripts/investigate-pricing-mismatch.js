/**
 * Investigation script for cruise pricing mismatches
 * Compares database pricing with FTP file pricing
 */

const postgres = require('postgres');
const ftp = require('basic-ftp');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
const sql = postgres(databaseUrl, {
  ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function investigateCruise(cruiseId) {
  console.log('='.repeat(80));
  console.log(`INVESTIGATING CRUISE ${cruiseId} PRICING`);
  console.log('='.repeat(80));
  console.log();

  try {
    // 1. Get current database pricing
    console.log('1. DATABASE PRICING:');
    console.log('-'.repeat(40));

    const dbResult = await sql`
      SELECT
        c.id,
        c.cruise_id,
        c.name,
        c.sailing_date,
        c.cruise_line_id,
        cl.name as cruise_line_name,
        c.ship_id,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        c.cheapest_price,
        c.raw_data,
        c.updated_at,
        c.metadata
      FROM cruises c
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.id = ${cruiseId}
    `;

    if (dbResult.length === 0) {
      console.log(`❌ Cruise ${cruiseId} not found in database`);
      return;
    }

    const cruise = dbResult[0];
    console.log('Cruise Name:', cruise.name);
    console.log('Sailing Date:', cruise.sailing_date);
    console.log('Cruise Line:', cruise.cruise_line_name, `(ID: ${cruise.cruise_line_id})`);
    console.log('Last Updated:', cruise.updated_at);
    console.log();

    console.log('Current Pricing in Database:');
    console.log('  Interior:  $', cruise.interior_price);
    console.log('  Oceanview: $', cruise.oceanview_price);
    console.log('  Balcony:   $', cruise.balcony_price);
    console.log('  Suite:     $', cruise.suite_price);
    console.log('  Cheapest:  $', cruise.cheapest_price);
    console.log();

    // 2. Parse metadata if available
    if (cruise.metadata) {
      console.log('2. METADATA ANALYSIS:');
      console.log('-'.repeat(40));
      try {
        const metadata =
          typeof cruise.metadata === 'string' ? JSON.parse(cruise.metadata) : cruise.metadata;

        if (metadata.pricing_updated_at) {
          console.log('Pricing last updated in metadata:', metadata.pricing_updated_at);
        }
        if (metadata.ftp_prices) {
          console.log('FTP prices stored in metadata:', metadata.ftp_prices);
        }
      } catch (e) {
        console.log('Could not parse metadata');
      }
      console.log();
    }

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

      // Path format: /YYYY/MM/DD/{cruise_line_id}/{cruise_id}.json
      const ftpPath = `/${year}/${month}/${day}/${cruise.cruise_line_id}/${cruiseId}.json`;
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
      console.log();

      console.log('FTP Cheapest Prices:');
      console.log('  cheapestinterior:  $', ftpData.cheapestinterior);
      console.log('  cheapestoutside:   $', ftpData.cheapestoutside);
      console.log('  cheapestbalcony:   $', ftpData.cheapestbalcony);
      console.log('  cheapestsuite:     $', ftpData.cheapestsuite);
      console.log();

      // 4. Compare pricing
      console.log('4. PRICING COMPARISON:');
      console.log('-'.repeat(50));
      console.log('Category    | Database    | FTP File    | Match?');
      console.log('-'.repeat(50));

      const formatPrice = price => (price ? `$${price}`.padEnd(10) : 'null'.padEnd(10));

      console.log(
        `Interior    | ${formatPrice(cruise.interior_price)} | ${formatPrice(ftpData.cheapestinterior)} | ${cruise.interior_price == ftpData.cheapestinterior ? '✅' : '❌ MISMATCH'}`
      );
      console.log(
        `Oceanview   | ${formatPrice(cruise.oceanview_price)} | ${formatPrice(ftpData.cheapestoutside)} | ${cruise.oceanview_price == ftpData.cheapestoutside ? '✅' : '❌ MISMATCH'}`
      );
      console.log(
        `Balcony     | ${formatPrice(cruise.balcony_price)} | ${formatPrice(ftpData.cheapestbalcony)} | ${cruise.balcony_price == ftpData.cheapestbalcony ? '✅' : '❌ MISMATCH'}`
      );
      console.log(
        `Suite       | ${formatPrice(cruise.suite_price)} | ${formatPrice(ftpData.cheapestsuite)} | ${cruise.suite_price == ftpData.cheapestsuite ? '✅' : '❌ MISMATCH'}`
      );
      console.log();

      // 5. Check detailed pricing array
      console.log('5. FTP PRICING ARRAY ANALYSIS:');
      console.log('-'.repeat(40));

      if (ftpData.pricing && Array.isArray(ftpData.pricing)) {
        const pricesByCategory = {};

        ftpData.pricing.forEach(price => {
          const category = price.cabin_category?.toLowerCase();
          if (!pricesByCategory[category]) {
            pricesByCategory[category] = [];
          }
          pricesByCategory[category].push({
            price: parseFloat(price.price),
            cabin_code: price.cabin_code,
            fare_code: price.fare_code,
          });
        });

        for (const [category, prices] of Object.entries(pricesByCategory)) {
          prices.sort((a, b) => a.price - b.price);
          console.log(`\n${category.toUpperCase()} prices (${prices.length} total):`);
          console.log(
            `  Lowest:  $${prices[0].price} (${prices[0].cabin_code}/${prices[0].fare_code})`
          );
          console.log(`  Highest: $${prices[prices.length - 1].price}`);
          console.log(
            `  Should match FTP cheapest${category === 'oceanview' ? 'outside' : category}: $${ftpData[`cheapest${category === 'oceanview' ? 'outside' : category}`]}`
          );
        }
      }
      console.log();

      // 6. Check webhook sync logic
      console.log('6. WEBHOOK SYNC ANALYSIS:');
      console.log('-'.repeat(40));

      const recentEvents = await sql`
        SELECT
          id,
          line_id,
          status,
          created_at,
          completed_at,
          metadata
        FROM webhook_events
        WHERE line_id = ${cruise.cruise_line_id}
        ORDER BY created_at DESC
        LIMIT 3
      `;

      console.log(`Recent webhook events for line ${cruise.cruise_line_id}:`);
      recentEvents.forEach(event => {
        const duration = event.completed_at
          ? Math.round((new Date(event.completed_at) - new Date(event.created_at)) / 1000)
          : 'N/A';
        console.log(`  ${event.created_at} - Status: ${event.status} (Duration: ${duration}s)`);
        if (event.metadata) {
          try {
            const meta =
              typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata;
            if (meta.cruises_updated) {
              console.log(`    Cruises updated: ${meta.cruises_updated}`);
            }
          } catch (e) {}
        }
      });

      await ftpClient.close();

      // 7. Final diagnosis
      console.log();
      console.log('='.repeat(80));
      console.log('DIAGNOSIS:');
      console.log('='.repeat(80));

      const mismatches = [];
      if (cruise.interior_price != ftpData.cheapestinterior) mismatches.push('Interior');
      if (cruise.oceanview_price != ftpData.cheapestoutside) mismatches.push('Oceanview');
      if (cruise.balcony_price != ftpData.cheapestbalcony) mismatches.push('Balcony');
      if (cruise.suite_price != ftpData.cheapestsuite) mismatches.push('Suite');

      if (mismatches.length > 0) {
        console.log('❌ PRICING MISMATCHES FOUND:', mismatches.join(', '));
        console.log();
        console.log('LIKELY CAUSES:');
        console.log('1. Webhook processor is not correctly extracting cheapest prices from FTP');
        console.log('2. The pricing extraction logic may be looking at wrong fields');
        console.log('3. Price conversion or rounding issues during sync');
        console.log();
        console.log('RECOMMENDED FIXES:');
        console.log('1. Review webhook processor pricing extraction logic');
        console.log("2. Ensure we're using cheapestX fields from FTP, not pricing array");
        console.log('3. Add validation to compare DB prices with FTP after each sync');
        console.log('4. Implement a batch price correction script for existing mismatches');
      } else {
        console.log('✅ All prices match between database and FTP!');
      }
    } catch (ftpError) {
      console.log('❌ FTP Error:', ftpError.message);
      console.log('Could not fetch FTP file at:', ftpPath);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

// Run for cruise 2144014
investigateCruise(2144014);
