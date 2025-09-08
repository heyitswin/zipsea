#!/usr/bin/env node

// Simple FTP test that should work from Render
const ftp = require('basic-ftp');

async function testFtp() {
  console.log('🔍 Testing FTP from Render Environment');
  console.log('=' .repeat(60));

  // These will be loaded from Render's environment variables
  const host = process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net';
  const user = process.env.TRAVELTEK_FTP_USER;
  const password = process.env.TRAVELTEK_FTP_PASSWORD;

  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Host:', host);
  console.log('User:', user ? `${user.substring(0, 3)}***` : 'NOT SET');
  console.log('Password:', password ? 'SET' : 'NOT SET');
  console.log('');

  if (!user || !password) {
    console.log('❌ FTP credentials not found in environment variables');
    return;
  }

  const client = new ftp.Client();
  client.ftp.verbose = true;

  try {
    console.log('Connecting to FTP...');
    await client.access({
      host: host,
      user: user,
      password: password,
      secure: false,
      connTimeout: 10000
    });

    console.log('✅ FTP CONNECTION SUCCESSFUL!');

    // List root directory
    const list = await client.list('/');
    console.log(`\nRoot directory contains ${list.length} items`);

    // Try to access current month
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    await client.cd(`/${year}/${month}`);
    const monthList = await client.list();
    console.log(`\n/${year}/${month} contains ${monthList.length} cruise lines`);

    // Show first 5 cruise lines
    console.log('\nFirst 5 cruise lines:');
    monthList.slice(0, 5).forEach(item => {
      if (item.isDirectory) {
        console.log(`  - ${item.name}`);
      }
    });

    console.log('\n✅ FTP is working correctly from this environment!');

  } catch (error) {
    console.log('\n❌ FTP CONNECTION FAILED');
    console.log('Error:', error.message);

    if (error.code === 530) {
      console.log('\nPossible issues:');
      console.log('1. Password has changed on Traveltek side');
      console.log('2. IP address not whitelisted (if connecting locally)');
      console.log('3. Account locked or expired');
      console.log('\nSolutions:');
      console.log('1. Contact Traveltek to verify credentials');
      console.log('2. Test from Render shell (has correct IP)');
      console.log('3. Check if password needs to be reset');
    }
  } finally {
    client.close();
  }

  console.log('\n' + '=' .repeat(60));
}

testFtp().catch(console.error);
