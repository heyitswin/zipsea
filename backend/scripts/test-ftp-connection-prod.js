#!/usr/bin/env node

const net = require('net');
const ftp = require('basic-ftp');
const dns = require('dns').promises;

async function testFtpConnection() {
  console.log('🔍 FTP Connection Diagnostic Tool');
  console.log('=================================\n');

  const ftpHost = process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net';
  const ftpUser = process.env.TRAVELTEK_FTP_USER || process.env.FTP_USER;
  const ftpPassword = process.env.TRAVELTEK_FTP_PASSWORD || process.env.FTP_PASSWORD;

  console.log('📋 Configuration:');
  console.log(`  Host: ${ftpHost}`);
  console.log(`  User: ${ftpUser ? '✅ Set' : '❌ Missing'}`);
  console.log(`  Password: ${ftpPassword ? '✅ Set' : '❌ Missing'}`);
  console.log();

  // Test DNS resolution
  console.log('🌐 Testing DNS Resolution...');
  try {
    const addresses = await dns.resolve4(ftpHost);
    console.log(`  ✅ Resolved to: ${addresses.join(', ')}`);
  } catch (error) {
    console.log(`  ❌ DNS resolution failed: ${error.message}`);
    return;
  }
  console.log();

  // Test raw TCP connection
  console.log('🔌 Testing TCP Connection to port 21...');
  const testTcp = () => new Promise((resolve) => {
    const client = new net.Socket();
    const timeout = setTimeout(() => {
      client.destroy();
      resolve({ success: false, error: 'Connection timeout (10s)' });
    }, 10000);

    client.connect(21, ftpHost, () => {
      clearTimeout(timeout);
      client.end();
      resolve({ success: true });
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ success: false, error: err.message });
    });
  });

  const tcpResult = await testTcp();
  if (tcpResult.success) {
    console.log('  ✅ TCP connection successful');
  } else {
    console.log(`  ❌ TCP connection failed: ${tcpResult.error}`);
    console.log('\n⚠️  This appears to be a network connectivity issue.');
    console.log('  Possible causes:');
    console.log('  1. FTP server is blocking Render\'s IP addresses');
    console.log('  2. Firewall rules have changed');
    console.log('  3. FTP server is down or relocated');
    console.log('\n📞 Action Required:');
    console.log('  Contact Traveltek support to whitelist Render\'s IP addresses');
    console.log('  Render\'s Oregon region IPs: https://render.com/docs/static-outbound-ip-addresses');
    return;
  }
  console.log();

  // Test FTP connection if TCP works
  if (!ftpUser || !ftpPassword) {
    console.log('⚠️  Cannot test FTP authentication - credentials missing');
    return;
  }

  console.log('🔐 Testing FTP Authentication...');
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: ftpHost,
      user: ftpUser,
      password: ftpPassword,
      port: 21,
      secure: false,
      secureOptions: { rejectUnauthorized: false }
    });

    console.log('  ✅ FTP authentication successful');

    // Try to list root directory
    console.log('\n📁 Testing FTP Operations...');
    const list = await client.list('/');
    console.log(`  ✅ Successfully listed root directory (${list.length} items)`);

    // Check for expected directories
    const expectedDirs = ['2025', '2024'];
    const foundDirs = list.filter(item => expectedDirs.includes(item.name));
    if (foundDirs.length > 0) {
      console.log(`  ✅ Found expected directories: ${foundDirs.map(d => d.name).join(', ')}`);
    }

    await client.close();
    console.log('\n✅ All FTP tests passed successfully!');

  } catch (error) {
    console.log(`  ❌ FTP error: ${error.message}`);

    if (error.code === 'ECONNREFUSED') {
      console.log('\n⚠️  FTP server is actively refusing connections');
      console.log('  This likely means Render\'s IPs are blocked');
    } else if (error.code === '530') {
      console.log('\n⚠️  Authentication failed');
      console.log('  Check FTP credentials');
    }
  }
}

testFtpConnection().catch(console.error);
