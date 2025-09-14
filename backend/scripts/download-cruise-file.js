#!/usr/bin/env node

const ftp = require('basic-ftp');
const fs = require('fs');
require('dotenv').config();

async function downloadCruiseFile() {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    console.log('Connecting to FTP server...\n');

    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST || 'ftp.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false,
    });

    console.log('✅ Connected to FTP\n');

    const filePath = '/2025/10/22/4439/2143102.json';
    const localPath = '/tmp/2143102.json';

    console.log(`Downloading ${filePath}...`);
    await client.downloadTo(localPath, filePath);

    console.log('✅ Downloaded successfully\n');

    // Read and parse the file
    const content = JSON.parse(fs.readFileSync(localPath, 'utf8'));

    console.log('📊 CRUISE INFORMATION:');
    console.log('=====================');
    console.log(`ID: ${content.codetocruiseid}`);
    console.log(`Name: ${content.name}`);
    console.log(`Ship: ${content.shipname} (ID: ${content.shipid})`);
    console.log(`Sailing Date: ${content.startdate}`);
    console.log(`Voyage Code: ${content.voyagecode}`);

    console.log('\n💰 CURRENT PRICING IN FTP FILE:');
    console.log('================================');

    if (content.cheapestinside) {
      console.log(`\nInside/Interior:`);
      console.log(`  Price: $${content.cheapestinside.price}`);
      console.log(`  Code: ${content.cheapestinside.pricecode}`);
      console.log(`  Cabin: ${content.cheapestinside.cabincode}`);
    }

    if (content.cheapestoutside) {
      console.log(`\nOutside/Ocean View:`);
      console.log(`  Price: $${content.cheapestoutside.price}`);
      console.log(`  Code: ${content.cheapestoutside.pricecode}`);
      console.log(`  Cabin: ${content.cheapestoutside.cabincode}`);
    }

    if (content.cheapestbalcony) {
      console.log(`\nBalcony:`);
      console.log(`  Price: $${content.cheapestbalcony.price}`);
      console.log(`  Code: ${content.cheapestbalcony.pricecode}`);
      console.log(`  Cabin: ${content.cheapestbalcony.cabincode}`);
    }

    if (content.cheapestsuite) {
      console.log(`\nSuite:`);
      console.log(`  Price: $${content.cheapestsuite.price}`);
      console.log(`  Code: ${content.cheapestsuite.pricecode}`);
      console.log(`  Cabin: ${content.cheapestsuite.cabincode}`);
    }

    console.log('\n\n📈 PRICE COMPARISON:');
    console.log('====================');
    console.log('\nDatabase (Sep 11, 2025):');
    console.log('  Interior:    $424');
    console.log('  Ocean View:  $764');
    console.log('  Balcony:    $934');
    console.log('  Suite:       N/A');

    console.log('\nFTP File (Current):');
    console.log(`  Interior:    $${content.cheapestinside?.price || 'N/A'}`);
    console.log(`  Ocean View:  $${content.cheapestoutside?.price || 'N/A'}`);
    console.log(`  Balcony:    $${content.cheapestbalcony?.price || 'N/A'}`);
    console.log(`  Suite:       $${content.cheapestsuite?.price || 'N/A'}`);

    // Check if prices have changed
    const dbPrices = { interior: 424, oceanview: 764, balcony: 934 };
    const ftpPrices = {
      interior: content.cheapestinside?.price || 0,
      oceanview: content.cheapestoutside?.price || 0,
      balcony: content.cheapestbalcony?.price || 0,
    };

    const hasChanges =
      dbPrices.interior !== ftpPrices.interior ||
      dbPrices.oceanview !== ftpPrices.oceanview ||
      dbPrices.balcony !== ftpPrices.balcony;

    if (hasChanges) {
      console.log('\n⚠️  PRICES HAVE CHANGED! Database needs update.');
    } else {
      console.log('\n✅ Prices match database.');
    }

    // Check file metadata
    console.log('\n\n📁 FILE METADATA:');
    console.log('================');
    console.log(`Last Cached: ${content.lastcached ? new Date(content.lastcached * 1000).toISOString() : 'N/A'}`);
    console.log(`Cached Date: ${content.cacheddate || 'N/A'}`);

    // Clean up
    fs.unlinkSync(localPath);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.close();
  }
}

downloadCruiseFile();
