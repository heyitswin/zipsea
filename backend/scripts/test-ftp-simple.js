#!/usr/bin/env node

require('dotenv').config();
const FTP = require('ftp');

const ftpConfig = {
  host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
  user: process.env.TRAVELTEK_FTP_USER,
  password: process.env.TRAVELTEK_FTP_PASSWORD,
  port: 21,
  secure: false,
  connTimeout: 30000,
  pasvTimeout: 30000
};

console.log('Testing FTP connection...');
console.log('Host:', ftpConfig.host);
console.log('User:', ftpConfig.user ? ftpConfig.user.substring(0, 3) + '***' : 'NOT SET');

const client = new FTP();

client.on('ready', () => {
  console.log('\n✅ Connected successfully!\n');
  
  // List root directory
  client.list('/', (err, list) => {
    if (err) {
      console.error('Error listing root:', err.message);
    } else {
      console.log('📁 Root directory contents:');
      list.forEach(item => {
        console.log(`   ${item.type === 'd' ? '📂' : '📄'} ${item.name}`);
      });
    }
    
    // Try to list a specific year
    console.log('\n📅 Checking 2025 directory...');
    client.list('/2025', (err, list) => {
      if (err) {
        console.error('Error listing 2025:', err.message);
        
        // Try without leading slash
        client.list('2025', (err2, list2) => {
          if (err2) {
            console.error('Error listing 2025 (no slash):', err2.message);
          } else {
            console.log('✅ Found 2025 (no slash):');
            list2.slice(0, 5).forEach(item => {
              console.log(`   ${item.type === 'd' ? '📂' : '📄'} ${item.name}`);
            });
          }
          client.end();
        });
      } else {
        console.log('✅ Found /2025:');
        list.slice(0, 5).forEach(item => {
          console.log(`   ${item.type === 'd' ? '📂' : '📄'} ${item.name}`);
        });
        client.end();
      }
    });
  });
});

client.on('error', (err) => {
  console.error('❌ FTP Error:', err.message);
  process.exit(1);
});

client.connect(ftpConfig);
