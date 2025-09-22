/**
 * Simple FTP fetch to see raw data structure
 */

const ftp = require('basic-ftp');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function fetchRawFTP() {
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

    // Try both date paths
    const paths = [
      '/2025/10/06/22/5457/2144014.json',
      '/2025/10/05/22/5457/2144014.json'
    ];

    for (const ftpPath of paths) {
      console.log(`\nTrying: ${ftpPath}`);

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
        const ftpData = JSON.parse(ftpContent);

        console.log('✅ File found!');

        // Save raw data to file for inspection
        fs.writeFileSync('cruise-2144014-raw.json', JSON.stringify(ftpData, null, 2));
        console.log('Saved to cruise-2144014-raw.json');

        // Show key fields
        console.log('\nKey pricing fields:');
        console.log('cheapestinterior:', ftpData.cheapestinterior);
        console.log('cheapestoutside:', ftpData.cheapestoutside);
        console.log('cheapestbalcony:', ftpData.cheapestbalcony);
        console.log('cheapestsuite:', ftpData.cheapestsuite);

        // Check if these are objects
        console.log('\nTypes:');
        console.log('cheapestinterior type:', typeof ftpData.cheapestinterior);
        console.log('cheapestoutside type:', typeof ftpData.cheapestoutside);
        console.log('cheapestbalcony type:', typeof ftpData.cheapestbalcony);
        console.log('cheapestsuite type:', typeof ftpData.cheapestsuite);

        // If they're objects, show their structure
        if (typeof ftpData.cheapestinterior === 'object' && ftpData.cheapestinterior) {
          console.log('\ncheapestinterior object keys:', Object.keys(ftpData.cheapestinterior));
          console.log('cheapestinterior.price:', ftpData.cheapestinterior.price);
        }

        // Check cheapest field structure
        if (ftpData.cheapest) {
          console.log('\n"cheapest" field found!');
          console.log('cheapest keys:', Object.keys(ftpData.cheapest));

          if (ftpData.cheapest.combined) {
            console.log('cheapest.combined:', ftpData.cheapest.combined);
          }
          if (ftpData.cheapest.prices) {
            console.log('cheapest.prices:', ftpData.cheapest.prices);
          }
        }

        // Check pricing array
        if (ftpData.pricing && Array.isArray(ftpData.pricing)) {
          console.log('\n"pricing" array found with', ftpData.pricing.length, 'items');

          // Group by cabin category
          const byCategory = {};
          ftpData.pricing.forEach(p => {
            const cat = p.cabin_category?.toLowerCase();
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(parseFloat(p.price));
          });

          console.log('\nLowest prices from pricing array:');
          for (const [cat, prices] of Object.entries(byCategory)) {
            console.log(`  ${cat}: $${Math.min(...prices)}`);
          }
        }

        break;
      } catch (e) {
        console.log('❌ Not found');
      }
    }

    await ftpClient.close();

  } catch (error) {
    console.error('Error:', error);
  }
}

fetchRawFTP();
