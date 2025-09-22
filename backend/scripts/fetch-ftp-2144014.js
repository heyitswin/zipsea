/**
 * Fetch FTP file for cruise 2144014 and compare with DB
 */

const ftp = require('basic-ftp');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function fetchFTP() {
  const ftpClient = new ftp.Client();
  ftpClient.ftp.verbose = false;

  try {
    await ftpClient.access({
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER || 'CEP_9_USD',
      password: process.env.TRAVELTEK_FTP_PASSWORD || 'g#3PmbVn',
      secure: false,
    });

    console.log('Connected to FTP server');

    // Try both date paths (sailing date and day before)
    const paths = [
      '/2025/10/06/22/5457/2144014.json', // Oct 6 (sailing date)
      '/2025/10/05/22/5457/2144014.json'  // Oct 5 (day before)
    ];

    let ftpData = null;
    let successPath = null;

    for (const ftpPath of paths) {
      console.log(`\nTrying path: ${ftpPath}`);

      try {
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
        ftpData = JSON.parse(ftpContent);
        successPath = ftpPath;
        console.log('✅ File found!');
        break;
      } catch (e) {
        console.log('❌ Not found at this path');
      }
    }

    if (!ftpData) {
      console.log('\n❌ Could not find FTP file in any expected location');
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('FTP FILE DATA (from', successPath + ')');
    console.log('='.repeat(60));

    console.log('\nFTP CHEAPEST PRICES:');
    console.log('  cheapestinterior:  $', ftpData.cheapestinterior);
    console.log('  cheapestoutside:   $', ftpData.cheapestoutside);
    console.log('  cheapestbalcony:   $', ftpData.cheapestbalcony);
    console.log('  cheapestsuite:     $', ftpData.cheapestsuite);

    console.log('\n' + '='.repeat(60));
    console.log('COMPARISON WITH DATABASE:');
    console.log('='.repeat(60));
    console.log('Category    | Database    | FTP File    | Match?');
    console.log('-'.repeat(60));

    // Database prices from previous check
    const dbPrices = {
      interior: 276.50,
      oceanview: 396.00,
      balcony: 428.50,
      suite: 2054.29
    };

    const formatPrice = (price) => price ? `$${price}`.padEnd(10) : 'null'.padEnd(10);

    console.log(`Interior    | ${formatPrice(dbPrices.interior)} | ${formatPrice(ftpData.cheapestinterior)} | ${dbPrices.interior == ftpData.cheapestinterior ? '✅' : '❌ MISMATCH'}`);
    console.log(`Oceanview   | ${formatPrice(dbPrices.oceanview)} | ${formatPrice(ftpData.cheapestoutside)} | ${dbPrices.oceanview == ftpData.cheapestoutside ? '✅' : '❌ MISMATCH'}`);
    console.log(`Balcony     | ${formatPrice(dbPrices.balcony)} | ${formatPrice(ftpData.cheapestbalcony)} | ${dbPrices.balcony == ftpData.cheapestbalcony ? '✅' : '❌ MISMATCH'}`);
    console.log(`Suite       | ${formatPrice(dbPrices.suite)} | ${formatPrice(ftpData.cheapestsuite)} | ${dbPrices.suite == ftpData.cheapestsuite ? '✅' : '❌ MISMATCH'}`);

    // Analyze pricing array
    console.log('\n' + '='.repeat(60));
    console.log('PRICING ARRAY ANALYSIS:');
    console.log('='.repeat(60));

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
          fare_code: price.fare_code
        });
      });

      console.log('\nLowest price from pricing array by category:');
      for (const [category, prices] of Object.entries(pricesByCategory)) {
        if (prices.length > 0) {
          prices.sort((a, b) => a.price - b.price);
          console.log(`  ${category}: $${prices[0].price} (${prices[0].cabin_code}/${prices[0].fare_code})`);
        }
      }

      // Check if DB matches pricing array instead
      console.log('\n' + '-'.repeat(60));
      console.log('Does DB match pricing array instead of cheapestX fields?');
      console.log('-'.repeat(60));

      const extractedPrices = {};
      for (const [category, prices] of Object.entries(pricesByCategory)) {
        if (prices.length > 0) {
          extractedPrices[category] = Math.min(...prices.map(p => p.price));
        }
      }

      console.log('Interior:  ', extractedPrices.interior == dbPrices.interior ? `✅ YES (${extractedPrices.interior})` : '❌ NO');
      console.log('Oceanview: ', extractedPrices.oceanview == dbPrices.oceanview ? `✅ YES (${extractedPrices.oceanview})` : '❌ NO');
      console.log('Balcony:   ', extractedPrices.balcony == dbPrices.balcony ? `✅ YES (${extractedPrices.balcony})` : '❌ NO');
      console.log('Suite:     ', extractedPrices.suite == dbPrices.suite ? `✅ YES (${extractedPrices.suite})` : '❌ NO');

      const allMatch =
        extractedPrices.interior == dbPrices.interior &&
        extractedPrices.oceanview == dbPrices.oceanview &&
        extractedPrices.balcony == dbPrices.balcony &&
        extractedPrices.suite == dbPrices.suite;

      if (allMatch) {
        console.log('\n' + '🔍'.repeat(30));
        console.log('ROOT CAUSE IDENTIFIED!');
        console.log('🔍'.repeat(30));
        console.log('The webhook processor is extracting prices from the "pricing" array');
        console.log('instead of using the pre-calculated "cheapestX" fields from FTP.');
        console.log('\nThis is why all prices match the array but not the FTP cheapest fields!');
      }
    }

    await ftpClient.close();

  } catch (error) {
    console.error('Error:', error);
  }
}

fetchFTP();
