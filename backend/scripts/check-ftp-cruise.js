#!/usr/bin/env node

const ftp = require('basic-ftp');
require('dotenv').config();

async function checkFTPCruise() {
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

    // Check for cruise 2143102 (Symphony of the Seas, Oct 5, 2025)
    const cruiseId = '2143102';
    const lineId = '22';  // Royal Caribbean
    const shipId = '4439'; // Symphony of the Seas

    // The cruise sails Oct 5, 2025, so should be in 2025/10 directory
    const expectedPath = `/2025/10/${lineId}/${shipId}`;

    console.log(`🔍 Checking for cruise ${cruiseId} at path: ${expectedPath}\n`);

    try {
      // List files in the ship directory
      const files = await client.list(expectedPath);

      console.log(`Files in ${expectedPath}:`);
      console.log('=' .repeat(50));

      let foundCruise = false;
      for (const file of files) {
        if (file.name === `${cruiseId}.json`) {
          foundCruise = true;
          const sizeKB = (file.size / 1024).toFixed(2);
          const modDate = new Date(file.modifiedAt || file.date);

          console.log(`\n✅ FOUND: ${file.name}`);
          console.log(`  Size: ${sizeKB} KB (${file.size} bytes)`);
          console.log(`  Modified: ${modDate.toISOString()}`);
          console.log(`  Full path: ${expectedPath}/${file.name}`);

          // Download and check the content
          console.log('\n📥 Downloading file to check pricing...');

          const buffer = await client.downloadTo(Buffer.alloc(0), `${expectedPath}/${file.name}`);
          const content = JSON.parse(buffer.toString());

          console.log('\n💰 PRICING DATA IN FILE:');
          console.log('========================');

          // Check various pricing fields
          if (content.cheapest) {
            console.log('\nFound "cheapest" object:');
            if (content.cheapest.combined) {
              console.log('  Has combined pricing');
            }
          }

          if (content.cheapestinside) {
            console.log(`\nCheapest Inside: $${content.cheapestinside.price || 'N/A'}`);
            console.log(`  Code: ${content.cheapestinside.pricecode || 'N/A'}`);
          }

          if (content.cheapestoutside) {
            console.log(`\nCheapest Outside: $${content.cheapestoutside.price || 'N/A'}`);
            console.log(`  Code: ${content.cheapestoutside.pricecode || 'N/A'}`);
          }

          if (content.cheapestbalcony) {
            console.log(`\nCheapest Balcony: $${content.cheapestbalcony.price || 'N/A'}`);
            console.log(`  Code: ${content.cheapestbalcony.pricecode || 'N/A'}`);
          }

          if (content.cheapestsuite) {
            console.log(`\nCheapest Suite: $${content.cheapestsuite.price || 'N/A'}`);
            console.log(`  Code: ${content.cheapestsuite.pricecode || 'N/A'}`);
          }

          // Check if prices have changed from what's in DB
          console.log('\n\n📊 COMPARISON WITH DATABASE:');
          console.log('============================');
          console.log('Database (from Sep 11):');
          console.log('  Interior: $424');
          console.log('  Ocean View: $764');
          console.log('  Balcony: $934');
          console.log('  Suite: N/A');

          console.log('\nFTP File (current):');
          console.log(`  Interior: $${content.cheapestinside?.price || 'N/A'}`);
          console.log(`  Outside: $${content.cheapestoutside?.price || 'N/A'}`);
          console.log(`  Balcony: $${content.cheapestbalcony?.price || 'N/A'}`);
          console.log(`  Suite: $${content.cheapestsuite?.price || 'N/A'}`);

          break;
        }
      }

      if (!foundCruise) {
        console.log(`\n❌ File ${cruiseId}.json NOT FOUND in ${expectedPath}`);
        console.log('\nOther files in directory:');
        files.forEach(f => {
          if (f.name.endsWith('.json')) {
            console.log(`  - ${f.name} (${(f.size/1024).toFixed(2)} KB)`);
          }
        });
      }

    } catch (error) {
      console.error(`\n❌ Error accessing path ${expectedPath}:`, error.message);

      // Try September path as fallback
      const septPath = `/2025/09/${lineId}/${shipId}`;
      console.log(`\nTrying September path: ${septPath}`);

      try {
        const septFiles = await client.list(septPath);
        const cruiseFile = septFiles.find(f => f.name === `${cruiseId}.json`);

        if (cruiseFile) {
          console.log(`\n⚠️  Found in SEPTEMBER directory instead!`);
          console.log(`  This explains why it hasn't been updated - wrong month directory`);
          console.log(`  Path: ${septPath}/${cruiseFile.name}`);
          console.log(`  Size: ${(cruiseFile.size/1024).toFixed(2)} KB`);
        }
      } catch (septError) {
        console.log('Not in September directory either');
      }
    }

  } catch (error) {
    console.error('FTP Error:', error.message);
  } finally {
    client.close();
  }
}

checkFTPCruise();
