#!/usr/bin/env node

/**
 * Test FTP Connection to Traveltek
 * Verifies FTP credentials and lists available files
 */

const FTP = require('ftp');
require('dotenv').config();

const ftpConfig = {
  host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
  user: process.env.TRAVELTEK_FTP_USER,
  password: process.env.TRAVELTEK_FTP_PASSWORD,
  port: 21,
  secure: false, // Try without TLS first
  secureOptions: { rejectUnauthorized: false },
  connTimeout: 30000,
  keepalive: 10000,
  debug: console.log // Enable debug output
};

if (!ftpConfig.user || !ftpConfig.password) {
  console.error('❌ FTP credentials not found in environment variables');
  console.error('Please set TRAVELTEK_FTP_USER and TRAVELTEK_FTP_PASSWORD');
  process.exit(1);
}

console.log('🔌 Testing Traveltek FTP Connection');
console.log('===================================');
console.log(`Host: ${ftpConfig.host}`);
console.log(`User: ${ftpConfig.user}`);
console.log(`Port: ${ftpConfig.port}`);
console.log('');

const client = new FTP();

// Handle connection errors
client.on('error', (err) => {
  console.error('❌ FTP Error:', err.message);
  client.end();
  process.exit(1);
});

// Handle successful connection
client.on('ready', async () => {
  console.log('✅ Connected to Traveltek FTP server');
  console.log('');
  
  try {
    // List root directory
    console.log('📁 Listing root directory...');
    client.list('/', (err, list) => {
      if (err) {
        console.error('❌ Error listing root:', err.message);
      } else {
        console.log(`Found ${list.length} items in root:`);
        list.forEach(item => {
          const type = item.type === 'd' ? '📁' : '📄';
          console.log(`  ${type} ${item.name}`);
        });
      }
      
      // Try to navigate to current year
      const currentYear = new Date().getFullYear().toString();
      console.log(`\n📁 Checking ${currentYear} directory...`);
      
      client.list(`/${currentYear}`, (err, yearList) => {
        if (err) {
          console.error(`❌ Error accessing ${currentYear}:`, err.message);
          client.end();
        } else {
          console.log(`Found ${yearList.length} months in ${currentYear}:`);
          yearList.forEach(item => {
            if (item.type === 'd') {
              console.log(`  📁 ${item.name}`);
            }
          });
          
          // Check current month
          const currentMonth = (new Date().getMonth() + 1).toString();
          console.log(`\n📁 Checking ${currentYear}/${currentMonth} directory...`);
          
          client.list(`/${currentYear}/${currentMonth}`, (err, monthList) => {
            if (err) {
              console.error(`❌ Error accessing ${currentYear}/${currentMonth}:`, err.message);
            } else {
              console.log(`Found ${monthList.length} cruise lines in ${currentYear}/${currentMonth}:`);
              monthList.slice(0, 5).forEach(item => {
                if (item.type === 'd') {
                  console.log(`  📁 Line ID: ${item.name}`);
                }
              });
              
              if (monthList.length > 5) {
                console.log(`  ... and ${monthList.length - 5} more`);
              }
              
              // Try to find a sample JSON file
              if (monthList.length > 0 && monthList[0].type === 'd') {
                const sampleLineId = monthList[0].name;
                console.log(`\n📁 Checking cruise line ${sampleLineId}...`);
                
                client.list(`/${currentYear}/${currentMonth}/${sampleLineId}`, (err, lineList) => {
                  if (err) {
                    console.error('❌ Error accessing cruise line:', err.message);
                    client.end();
                  } else {
                    console.log(`Found ${lineList.length} ships:`);
                    lineList.slice(0, 3).forEach(item => {
                      if (item.type === 'd') {
                        console.log(`  📁 Ship ID: ${item.name}`);
                      }
                    });
                    
                    // Check for JSON files in first ship
                    if (lineList.length > 0 && lineList[0].type === 'd') {
                      const sampleShipId = lineList[0].name;
                      const path = `/${currentYear}/${currentMonth}/${sampleLineId}/${sampleShipId}`;
                      
                      console.log(`\n📁 Checking for cruise files in ${path}...`);
                      client.list(path, (err, fileList) => {
                        if (err) {
                          console.error('❌ Error accessing ship directory:', err.message);
                        } else {
                          const jsonFiles = fileList.filter(f => f.name.endsWith('.json'));
                          console.log(`Found ${jsonFiles.length} JSON files`);
                          
                          jsonFiles.slice(0, 5).forEach(file => {
                            console.log(`  📄 ${file.name} (${Math.round(file.size / 1024)}KB)`);
                          });
                          
                          if (jsonFiles.length > 5) {
                            console.log(`  ... and ${jsonFiles.length - 5} more files`);
                          }
                        }
                        
                        console.log('\n===================================');
                        console.log('✅ FTP connection test completed');
                        console.log('\nSummary:');
                        console.log(`• Connection: Successful`);
                        console.log(`• Data available: ${monthList.length > 0 ? 'Yes' : 'No'}`);
                        console.log(`• Path structure: /${currentYear}/${currentMonth}/[lineid]/[shipid]/[cruiseid].json`);
                        
                        client.end();
                      });
                    } else {
                      client.end();
                    }
                  }
                });
              } else {
                console.log('\n⚠️  No cruise line directories found');
                client.end();
              }
            }
          });
        }
      });
    });
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    client.end();
    process.exit(1);
  }
});

// Connect to FTP
console.log('🔄 Connecting...');
client.connect(ftpConfig);