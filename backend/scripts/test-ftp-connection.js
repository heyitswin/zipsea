#!/usr/bin/env node

/**
 * Test FTP Connection to Traveltek
 * Run this in Render shell to diagnose FTP issues
 */

const FTP = require('ftp');

// Manual configuration for testing
const ftpConfig = {
  host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
  user: process.env.TRAVELTEK_FTP_USER,
  password: process.env.TRAVELTEK_FTP_PASSWORD,
  port: 21,
  secure: false, // Try without TLS first
  secureOptions: { rejectUnauthorized: false },
  connTimeout: 30000,
  pasvTimeout: 30000,
  keepalive: 10000,
  debug: function(msg) {
    console.log('[FTP DEBUG]', msg);
  }
};

console.log('🔌 Testing Traveltek FTP Connection');
console.log('===================================');
console.log(`Host: ${ftpConfig.host}`);
console.log(`User: ${ftpConfig.user ? ftpConfig.user.substring(0, 3) + '***' : 'NOT SET'}`);
console.log(`Password: ${ftpConfig.password ? '***SET***' : 'NOT SET'}`);
console.log(`Port: ${ftpConfig.port}`);
console.log(`Secure: ${ftpConfig.secure}`);
console.log('');

if (!ftpConfig.user || !ftpConfig.password) {
  console.error('❌ FTP credentials not found in environment variables');
  console.error('');
  console.error('Environment variables present:');
  Object.keys(process.env).filter(k => k.includes('TRAVELTEK')).forEach(key => {
    console.error(`  ${key}: ${process.env[key] ? 'SET' : 'NOT SET'}`);
  });
  process.exit(1);
}

const client = new FTP();

// Set timeout for the entire operation
const timeout = setTimeout(() => {
  console.error('❌ Connection timeout after 30 seconds');
  client.end();
  process.exit(1);
}, 30000);

// Handle connection events
client.on('ready', () => {
  clearTimeout(timeout);
  console.log('✅ Successfully connected to Traveltek FTP server!');
  console.log('');
  
  // Try to list root directory
  console.log('📁 Attempting to list root directory...');
  client.list('/', (err, list) => {
    if (err) {
      console.error('❌ Error listing root directory:', err.message);
      console.error('Full error:', err);
    } else {
      console.log(`✅ Successfully listed root directory!`);
      console.log(`Found ${list.length} items:`);
      list.slice(0, 5).forEach(item => {
        const type = item.type === 'd' ? '📁' : '📄';
        console.log(`  ${type} ${item.name}`);
      });
      if (list.length > 5) {
        console.log(`  ... and ${list.length - 5} more`);
      }
    }
    
    console.log('');
    console.log('✅ FTP connection test completed successfully!');
    console.log('The FTP credentials are working correctly.');
    client.end();
    process.exit(0);
  });
});

client.on('error', (err) => {
  clearTimeout(timeout);
  console.error('❌ FTP Connection Error:', err.message);
  console.error('');
  
  if (err.message.includes('530')) {
    console.error('🔐 Authentication failed. Please check:');
    console.error('1. Username is correct');
    console.error('2. Password is correct');
    console.error('3. Account is active with Traveltek');
  } else if (err.message.includes('ECONNREFUSED')) {
    console.error('🔌 Connection refused. Possible causes:');
    console.error('1. FTP server is down');
    console.error('2. Firewall blocking connection');
    console.error('3. IP needs to be whitelisted');
  } else if (err.message.includes('ETIMEDOUT')) {
    console.error('⏱️ Connection timeout. Possible causes:');
    console.error('1. Network issues');
    console.error('2. FTP server not responding');
    console.error('3. Port 21 blocked');
  } else {
    console.error('Full error details:', err);
  }
  
  client.end();
  process.exit(1);
});

client.on('close', () => {
  clearTimeout(timeout);
  console.log('Connection closed');
});

// Attempt connection
console.log('🔄 Attempting to connect...');
console.log('');

try {
  client.connect(ftpConfig);
} catch (error) {
  console.error('❌ Failed to initiate connection:', error.message);
  process.exit(1);
}