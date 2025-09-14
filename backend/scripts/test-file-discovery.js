#!/usr/bin/env node

require('dotenv').config();
const ftp = require('basic-ftp');

async function testFileDiscovery() {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    console.log('Connecting to FTP server...');
    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false,
    });

    console.log('Connected successfully');

    // Test specific path for cruise 2143102
    const cruisePath = '/2025/10/22/4439/2143102.json';
    console.log(`\nChecking if cruise file exists at: ${cruisePath}`);

    try {
      const fileInfo = await client.size(cruisePath);
      console.log(`✅ File EXISTS - Size: ${fileInfo} bytes`);
    } catch (err) {
      console.log(`❌ File NOT FOUND: ${err.message}`);
    }

    // Now test the discovery logic that the webhook processor uses
    console.log('\n=== Testing Discovery Logic ===');
    const lineId = 22; // Royal Caribbean
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    console.log(`Current date: ${now.toISOString()}`);
    console.log(`Current year: ${currentYear}, Current month: ${currentMonth}`);

    // Scan October 2025 specifically
    const year = 2025;
    const month = 10;
    const monthStr = month.toString().padStart(2, '0');
    const linePath = `/${year}/${monthStr}/${lineId}`;

    console.log(`\nScanning path: ${linePath}`);

    const files = [];
    try {
      const shipDirs = await client.list(linePath);
      console.log(`Found ${shipDirs.length} ship directories`);

      for (const shipDir of shipDirs) {
        if (shipDir.type === 2) {
          // Directory
          console.log(`  Ship directory: ${shipDir.name}`);

          if (shipDir.name === '4439') {
            console.log(`    ✅ Found ship 4439 (Symphony of the Seas)`);

            const shipPath = `${linePath}/${shipDir.name}`;
            const cruiseFiles = await client.list(shipPath);
            console.log(`    Found ${cruiseFiles.length} cruise files in ship 4439`);

            for (const file of cruiseFiles) {
              if (file.type === 1 && file.name.endsWith('.json')) {
                const cruiseId = file.name.replace('.json', '');
                if (cruiseId === '2143102') {
                  console.log(`      ✅ FOUND CRUISE 2143102! Size: ${file.size} bytes`);
                  files.push({
                    path: `${shipPath}/${file.name}`,
                    name: file.name,
                    lineId: lineId,
                    shipId: parseInt(shipDir.name) || 0,
                    cruiseId: cruiseId,
                    size: file.size,
                    year: year,
                    month: month,
                  });
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning ${linePath}:`, error.message);
    }

    if (files.length > 0) {
      console.log('\n✅ CRUISE 2143102 WOULD BE DISCOVERED BY WEBHOOK PROCESSOR');
      console.log('File details:', JSON.stringify(files[0], null, 2));
    } else {
      console.log('\n❌ CRUISE 2143102 NOT FOUND IN DISCOVERY');
    }

    // Check if the processor would scan October when running in September
    console.log('\n=== Month Range Check ===');
    const startMonth = year === currentYear ? currentMonth : 1;
    const endMonth = 12;
    console.log(`For year ${year}: scanning months ${startMonth} to ${endMonth}`);

    if (month >= startMonth && month <= endMonth) {
      console.log(`✅ Month ${month} (October) is within scan range`);
    } else {
      console.log(`❌ Month ${month} (October) is OUTSIDE scan range`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
  }
}

testFileDiscovery().catch(console.error);
