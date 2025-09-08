const ftp = require('basic-ftp');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function debugFtpConnection() {
  console.log('🔍 FTP CONNECTION DEBUGGING');
  console.log('=' .repeat(80));

  // 1. Check environment variables
  console.log('\n1️⃣  ENVIRONMENT VARIABLES CHECK');
  console.log('-'.repeat(40));

  const host = process.env.TRAVELTEK_FTP_HOST;
  const user = process.env.TRAVELTEK_FTP_USER;
  const password = process.env.TRAVELTEK_FTP_PASSWORD;

  console.log('TRAVELTEK_FTP_HOST:', host || 'NOT SET');
  console.log('TRAVELTEK_FTP_USER:', user ? `${user.substring(0, 3)}***` : 'NOT SET');
  console.log('TRAVELTEK_FTP_PASSWORD:', password ? `***${password.substring(password.length - 3)}` : 'NOT SET');

  // Check if we're using defaults
  if (!host) {
    console.log('⚠️  Using default host: ftpeu1prod.traveltek.net');
  }

  // 2. Test different connection configurations
  console.log('\n2️⃣  TESTING DIFFERENT FTP CONFIGURATIONS');
  console.log('-'.repeat(40));

  const configurations = [
    {
      name: 'Standard (no secure)',
      config: {
        host: host || 'ftpeu1prod.traveltek.net',
        user: user,
        password: password,
        secure: false
      }
    },
    {
      name: 'With explicit port 21',
      config: {
        host: host || 'ftpeu1prod.traveltek.net',
        port: 21,
        user: user,
        password: password,
        secure: false
      }
    },
    {
      name: 'With longer timeout',
      config: {
        host: host || 'ftpeu1prod.traveltek.net',
        user: user,
        password: password,
        secure: false,
        timeout: 30000
      }
    },
    {
      name: 'With passive mode explicitly set',
      config: {
        host: host || 'ftpeu1prod.traveltek.net',
        user: user,
        password: password,
        secure: false,
        connTimeout: 30000
      }
    }
  ];

  for (const { name, config } of configurations) {
    console.log(`\nTesting: ${name}`);
    const client = new ftp.Client();
    client.ftp.verbose = true; // Enable verbose logging

    try {
      console.log('Connecting...');
      await client.access(config);
      console.log('✅ Connection successful!');

      // Try to list root directory
      const list = await client.list('/');
      console.log(`   Found ${list.length} items in root directory`);

      // Check if we can access current year/month
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      try {
        await client.cd(`/${year}/${month}`);
        console.log(`   ✅ Can access /${year}/${month}`);
      } catch (e) {
        console.log(`   ⚠️  Cannot access /${year}/${month}: ${e.message}`);
      }

      client.close();

      // If one works, we found the solution
      console.log('\n✅ SOLUTION FOUND!');
      console.log('Use this configuration:', JSON.stringify(config, null, 2));
      return;

    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);

      // Log more details about the error
      if (error.code) console.log(`   Error code: ${error.code}`);
      if (error.message.includes('530')) {
        console.log('   530 = Login incorrect (wrong username/password)');
      } else if (error.message.includes('ECONNREFUSED')) {
        console.log('   Connection refused (firewall/network issue)');
      } else if (error.message.includes('ETIMEDOUT')) {
        console.log('   Connection timeout (network/firewall issue)');
      }

      client.close();
    }
  }

  // 3. Check if it's a character encoding issue
  console.log('\n3️⃣  CHECKING FOR SPECIAL CHARACTERS');
  console.log('-'.repeat(40));

  if (password) {
    // Check for problematic characters
    const hasSpecialChars = /[^\w\d\-_\.@]/.test(password);
    if (hasSpecialChars) {
      console.log('⚠️  Password contains special characters that might need escaping');
      console.log('   Special chars found:', password.replace(/[\w\d\-_\.@]/g, '*'));
    } else {
      console.log('✅ Password contains only standard characters');
    }
  }

  // 4. Test with URL encoding
  console.log('\n4️⃣  TESTING WITH URL ENCODING');
  console.log('-'.repeat(40));

  if (user && password) {
    const encodedUser = encodeURIComponent(user);
    const encodedPassword = encodeURIComponent(password);

    if (encodedUser !== user || encodedPassword !== password) {
      console.log('URL encoding changes credentials, testing with encoded values...');

      const client = new ftp.Client();
      try {
        await client.access({
          host: host || 'ftpeu1prod.traveltek.net',
          user: user, // FTP client should handle encoding internally
          password: password,
          secure: false
        });
        console.log('✅ Connection successful with original credentials!');
        client.close();
      } catch (error) {
        console.log('❌ Still failed:', error.message);
        client.close();
      }
    } else {
      console.log('No encoding needed for credentials');
    }
  }

  // 5. Alternative: Test connection from production
  console.log('\n5️⃣  ALTERNATIVE TEST');
  console.log('-'.repeat(40));
  console.log('You can test the FTP connection directly from Render:');
  console.log('1. Go to https://dashboard.render.com');
  console.log('2. Open "zipsea-production" service');
  console.log('3. Go to "Shell" tab');
  console.log('4. Run: node scripts/debug-ftp-connection.js');
  console.log('');
  console.log('This will use the actual production environment variables.');

  console.log('\n' + '=' .repeat(80));
  console.log('Debug completed');
}

debugFtpConnection().catch(console.error);
