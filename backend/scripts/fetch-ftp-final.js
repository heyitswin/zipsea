/**
 * Fetch cruise 2144014 from FTP with correct path format
 */

const ftp = require('basic-ftp');
const path = require('path');
const fs = require('fs');
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

    console.log('Connected to FTP server\n');

    // Sailing date is 2025-10-06, so try these paths (no leading zeros on day)
    const paths = [
      '/2025/10/6/22/5457/2144014.json',  // Oct 6
      '/2025/10/5/22/5457/2144014.json',  // Oct 5
      '/2025/10/7/22/5457/2144014.json'   // Oct 7
    ];

    let ftpData = null;
    let successPath = null;

    for (const ftpPath of paths) {
      console.log(`Trying: ${ftpPath}`);

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
        console.log('✅ File found!\n');
        break;
      } catch (e) {
        console.log('❌ Not found');
      }
    }

    if (!ftpData) {
      console.log('\n❌ Could not find cruise file on FTP server');
      await ftpClient.close();
      return;
    }

    // Save raw data
    fs.writeFileSync('cruise-2144014-raw.json', JSON.stringify(ftpData, null, 2));
    console.log('Saved raw data to cruise-2144014-raw.json\n');

    console.log('=' .repeat(60));
    console.log('FTP DATA ANALYSIS');
    console.log('=' .repeat(60));

    // Show the cheapest fields that SHOULD be used
    console.log('\n✅ CORRECT PRICES (from cheapestX fields):');
    console.log('  cheapestinterior:', ftpData.cheapestinterior);
    console.log('  cheapestoutside:', ftpData.cheapestoutside);
    console.log('  cheapestbalcony:', ftpData.cheapestbalcony);
    console.log('  cheapestsuite:', ftpData.cheapestsuite);

    // Check what the webhook processor might be extracting
    console.log('\n❌ WHAT WEBHOOK MIGHT BE EXTRACTING:');

    // Check if prices are being extracted from pricing array
    if (ftpData.pricing && Array.isArray(ftpData.pricing)) {
      const byCategory = {};
      ftpData.pricing.forEach(p => {
        const cat = p.cabin_category?.toLowerCase();
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(parseFloat(p.price));
      });

      console.log('From pricing array:');
      for (const [cat, prices] of Object.entries(byCategory)) {
        if (prices.length > 0) {
          const lowest = Math.min(...prices);
          console.log(`  ${cat}: $${lowest}`);
        }
      }
    }

    // Compare with database values
    console.log('\n' + '=' .repeat(60));
    console.log('COMPARISON WITH DATABASE');
    console.log('=' .repeat(60));

    const dbPrices = {
      interior: 276.50,
      oceanview: 396.00,
      balcony: 428.50,
      suite: 2054.29
    };

    console.log('\nCategory    | Database    | FTP cheapestX | Match?');
    console.log('-'.repeat(60));

    const formatPrice = (price) => price ? `$${price}`.padEnd(11) : 'null'.padEnd(11);

    console.log(`Interior    | ${formatPrice(dbPrices.interior)} | ${formatPrice(ftpData.cheapestinterior)} | ${dbPrices.interior == ftpData.cheapestinterior ? '✅' : '❌ WRONG'}`);
    console.log(`Oceanview   | ${formatPrice(dbPrices.oceanview)} | ${formatPrice(ftpData.cheapestoutside)} | ${dbPrices.oceanview == ftpData.cheapestoutside ? '✅' : '❌ WRONG'}`);
    console.log(`Balcony     | ${formatPrice(dbPrices.balcony)} | ${formatPrice(ftpData.cheapestbalcony)} | ${dbPrices.balcony == ftpData.cheapestbalcony ? '✅' : '❌ WRONG'}`);
    console.log(`Suite       | ${formatPrice(dbPrices.suite)} | ${formatPrice(ftpData.cheapestsuite)} | ${dbPrices.suite == ftpData.cheapestsuite ? '✅' : '❌ WRONG'}`);

    // ROOT CAUSE ANALYSIS
    console.log('\n' + '=' .repeat(60));
    console.log('ROOT CAUSE ANALYSIS');
    console.log('=' .repeat(60));

    // Check if database matches pricing array instead
    if (ftpData.pricing && Array.isArray(ftpData.pricing)) {
      const extractedPrices = {};
      const byCategory = {};

      ftpData.pricing.forEach(p => {
        const cat = p.cabin_category?.toLowerCase();
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(parseFloat(p.price));
      });

      for (const [cat, prices] of Object.entries(byCategory)) {
        if (prices.length > 0) {
          extractedPrices[cat] = Math.min(...prices);
        }
      }

      console.log('\nDoes DB match pricing array instead of cheapestX?');
      const arrayMatches = {
        interior: extractedPrices.interior == dbPrices.interior,
        oceanview: extractedPrices.oceanview == dbPrices.oceanview,
        balcony: extractedPrices.balcony == dbPrices.balcony,
        suite: extractedPrices.suite == dbPrices.suite
      };

      console.log('  Interior:', arrayMatches.interior ? `✅ YES (${extractedPrices.interior})` : '❌ NO');
      console.log('  Oceanview:', arrayMatches.oceanview ? `✅ YES (${extractedPrices.oceanview})` : '❌ NO');
      console.log('  Balcony:', arrayMatches.balcony ? `✅ YES (${extractedPrices.balcony})` : '❌ NO');
      console.log('  Suite:', arrayMatches.suite ? `✅ YES (${extractedPrices.suite})` : '❌ NO');

      const allArrayMatch = Object.values(arrayMatches).every(v => v);

      if (allArrayMatch) {
        console.log('\n' + '🔍'.repeat(20));
        console.log('PROBLEM CONFIRMED!');
        console.log('🔍'.repeat(20));
        console.log('\nThe webhook processor is incorrectly extracting prices from');
        console.log('the "pricing" array instead of using the pre-calculated');
        console.log('"cheapestX" fields that FTP provides.');
        console.log('\nThis is why all prices match the array but NOT the FTP cheapest fields!');
      }
    }

    // SOLUTION
    console.log('\n' + '=' .repeat(60));
    console.log('SOLUTION');
    console.log('=' .repeat(60));
    console.log('\n1. IMMEDIATE FIX:');
    console.log('   Update webhook processor to directly use:');
    console.log('   - ftpData.cheapestinterior (NOT extract from pricing array)');
    console.log('   - ftpData.cheapestoutside (NOT extract from pricing array)');
    console.log('   - ftpData.cheapestbalcony (NOT extract from pricing array)');
    console.log('   - ftpData.cheapestsuite (NOT extract from pricing array)');
    console.log('\n2. BATCH FIX:');
    console.log('   Run script to update all existing cruises with correct prices');
    console.log('   from FTP cheapestX fields');
    console.log('\n3. VALIDATION:');
    console.log('   Add checks to ensure DB prices match FTP cheapestX after sync');

    await ftpClient.close();

  } catch (error) {
    console.error('Error:', error.message);
  }
}

fetchFTP();
