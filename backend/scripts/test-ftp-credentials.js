#!/usr/bin/env node

require('dotenv').config();
const ftp = require('basic-ftp');

async function testFTPConnection() {
  console.log('=== Testing FTP Connection ===');
  console.log('Environment variables check:');
  console.log('TRAVELTEK_FTP_HOST:', process.env.TRAVELTEK_FTP_HOST || 'Not set (using default)');
  console.log('TRAVELTEK_FTP_USER:', process.env.TRAVELTEK_FTP_USER || 'Not set');
  console.log('FTP_USER (fallback):', process.env.FTP_USER || 'Not set');
  console.log('TRAVELTEK_FTP_PASSWORD:', process.env.TRAVELTEK_FTP_PASSWORD ? `Set (${process.env.TRAVELTEK_FTP_PASSWORD.length} chars)` : 'Not set');
  console.log('FTP_PASSWORD (fallback):', process.env.FTP_PASSWORD ? `Set (${process.env.FTP_PASSWORD.length} chars)` : 'Not set');

  const ftpConfig = {
    host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
    user: process.env.TRAVELTEK_FTP_USER || process.env.FTP_USER,
    password: process.env.TRAVELTEK_FTP_PASSWORD || process.env.FTP_PASSWORD,
    secure: false,
    timeout: 30000,
    verbose: true, // Enable verbose for debugging
  };

  console.log('\nUsing FTP config:');
  console.log('Host:', ftpConfig.host);
  console.log('User:', ftpConfig.user || 'MISSING!');
  console.log('Password:', ftpConfig.password ? 'Set' : 'MISSING!');
  console.log('Secure:', ftpConfig.secure);

  if (!ftpConfig.user || !ftpConfig.password) {
    console.error('\n❌ ERROR: FTP credentials are missing!');
    console.error('Please set TRAVELTEK_FTP_USER and TRAVELTEK_FTP_PASSWORD environment variables');
    process.exit(1);
  }

  const client = new ftp.Client();
  client.ftp.verbose = true;

  try {
    console.log('\nConnecting to FTP server...');
    await client.access(ftpConfig);
    console.log('✅ Successfully connected to FTP server!');

    // List root directory
    const list = await client.list('/');
    console.log(`\nFound ${list.length} items in root directory`);

    // Show first few items
    list.slice(0, 5).forEach(item => {
      console.log(`  - ${item.name} (${item.type})`);
    });

    await client.close();
    console.log('\n✅ Connection test successful!');

  } catch (error) {
    console.error('\n❌ FTP connection failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testFTPConnection().catch(console.error);
