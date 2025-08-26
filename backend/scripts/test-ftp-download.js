#!/usr/bin/env node

/**
 * Test script to debug FTP download issues
 */

require('dotenv').config();
const ftp = require('basic-ftp');

async function testFTPConnection() {
  const client = new ftp.Client();
  
  try {
    console.log('Testing FTP connection...');
    console.log('Host:', process.env.TRAVELTEK_FTP_HOST);
    console.log('User:', process.env.TRAVELTEK_FTP_USER);
    console.log('Password:', process.env.TRAVELTEK_FTP_PASSWORD ? '[SET]' : '[NOT SET]');
    
    // Connect with verbose logging
    client.ftp.verbose = true;
    
    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST,
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false
    });
    
    console.log('\n✅ Connected successfully!');
    
    // List root directory
    console.log('\nListing root directory:');
    const list = await client.list('/');
    console.log(list.slice(0, 5).map(item => `${item.type === 1 ? 'FILE' : 'DIR'}: ${item.name}`));
    
    // Try to navigate to isell_json directory
    console.log('\nChecking isell_json directory:');
    const isellList = await client.list('/isell_json');
    console.log('Found', isellList.length, 'items in /isell_json');
    
    // Try to list 2025 directory
    console.log('\nChecking /isell_json/2025:');
    const yearList = await client.list('/isell_json/2025');
    console.log('Found', yearList.length, 'months in 2025');
    console.log(yearList.map(item => item.name));
    
    // Try to download a sample file
    // Let's use one of the cruise IDs from the failed batch
    const testCruiseId = '333739';
    const testPaths = [
      '/isell_json/2025/01/2/333739.json',
      '/isell_json/2025/01/2/6/333739.json',
      '/isell_json/2025/02/2/333739.json',
      '/isell_json/2025/02/2/6/333739.json',
    ];
    
    console.log('\nTrying to find cruise', testCruiseId);
    for (const path of testPaths) {
      try {
        console.log(`Checking ${path}...`);
        const buffer = await client.downloadTo(Buffer.alloc(0), path);
        console.log(`✅ Found at ${path}`);
        break;
      } catch (err) {
        console.log(`❌ Not found at ${path}`);
      }
    }
    
  } catch (error) {
    console.error('❌ FTP Error:', error.message);
    console.error('Full error:', error);
  } finally {
    client.close();
  }
}

// Run the test
testFTPConnection().catch(console.error);