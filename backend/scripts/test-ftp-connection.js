#!/usr/bin/env node

/**
 * Test FTP Connection Script
 */

const ftp = require('basic-ftp');
require('dotenv').config({ path: '../.env' });

async function testConnection() {
  const credentials = [
    {
      name: 'From ENV',
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
    },
    {
      name: 'Zipzea_staging',
      host: 'ftpeu1prod.traveltek.net',
      user: 'Zipzea_staging',
      password: 'PaSw!21#2024',
    },
    {
      name: 'zipsea_staging',
      host: 'ftpeu1prod.traveltek.net',
      user: 'zipsea_staging',
      password: 'PaSw!21#2024',
    },
  ];

  for (const cred of credentials) {
    if (!cred.user || !cred.password) {
      console.log(`❌ ${cred.name}: Missing credentials`);
      continue;
    }

    const client = new ftp.Client();
    client.ftp.verbose = false;

    try {
      console.log(`\n🔌 Testing: ${cred.name}`);
      console.log(`   Host: ${cred.host}`);
      console.log(`   User: ${cred.user}`);

      await client.access({
        host: cred.host,
        user: cred.user,
        password: cred.password,
        secure: false,
        timeout: 10000,
      });

      console.log(`   ✅ Connection successful!`);

      // Try to list root directory
      const list = await client.list('/');
      console.log(`   📁 Found ${list.length} items in root`);

      // List first few directories
      const dirs = list.filter(item => item.isDirectory).slice(0, 5);
      dirs.forEach(dir => {
        console.log(`      - ${dir.name}`);
      });

      client.close();

      // Found working credentials, save them
      console.log('\n✅ WORKING CREDENTIALS FOUND!');
      console.log('Add these to your .env file:');
      console.log(`TRAVELTEK_FTP_HOST=${cred.host}`);
      console.log(`TRAVELTEK_FTP_USER=${cred.user}`);
      console.log(`TRAVELTEK_FTP_PASSWORD=${cred.password}`);

      return true;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      client.close();
    }
  }

  console.log('\n❌ No working credentials found');
  return false;
}

// Run the test
testConnection().catch(console.error);
