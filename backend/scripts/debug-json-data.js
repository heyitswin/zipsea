#!/usr/bin/env node

/**
 * Debug JSON data to see what's causing the integer conversion error
 */

require('dotenv').config();
const FTP = require('ftp');

console.log('🔍 JSON Data Debugger');
console.log('=====================\n');

const ftpConfig = {
  host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
  user: process.env.TRAVELTEK_FTP_USER,
  password: process.env.TRAVELTEK_FTP_PASSWORD,
  port: 21,
  secure: false,
  connTimeout: 30000,
  pasvTimeout: 30000
};

if (!ftpConfig.user || !ftpConfig.password) {
  console.error('❌ FTP credentials not found');
  process.exit(1);
}

// Helper to download file
async function downloadFile(client, filePath) {
  return new Promise((resolve, reject) => {
    client.get(filePath, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }
      
      let data = '';
      stream.on('data', (chunk) => {
        data += chunk.toString();
      });
      
      stream.on('end', () => {
        resolve(data);
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
    });
  });
}

async function debugJsonData() {
  const client = new FTP();
  
  return new Promise(async (resolve, reject) => {
    client.on('ready', async () => {
      console.log('✅ Connected to FTP\n');
      
      try {
        // Download one test file
        const testFile = '2025/12/1/180/2089722.json';
        console.log(`📥 Downloading ${testFile}...\n`);
        
        const jsonContent = await downloadFile(client, testFile);
        const cruiseData = JSON.parse(jsonContent);
        
        console.log('📊 Analyzing cruise data structure:\n');
        
        // Check critical integer fields
        const integerFields = [
          'cruiseid',
          'lineid', 
          'shipid',
          'nights',
          'sailnights',
          'seadays',
          'startportid',
          'endportid',
          'marketid',
          'ownerid'
        ];
        
        console.log('Integer Fields Check:');
        console.log('---------------------');
        for (const field of integerFields) {
          const value = cruiseData[field];
          const type = typeof value;
          console.log(`${field.padEnd(15)}: ${JSON.stringify(value).padEnd(20)} (type: ${type})`);
          
          // Check if it's a string that should be a number
          if (type === 'string' && value !== null && value !== undefined) {
            if (value === 'system' || isNaN(Number(value))) {
              console.log(`   ⚠️  WARNING: Non-numeric value "${value}" in integer field!`);
            }
          }
        }
        
        console.log('\n');
        console.log('Array Fields Check:');
        console.log('-------------------');
        const arrayFields = ['regionids', 'portids'];
        for (const field of arrayFields) {
          const value = cruiseData[field];
          console.log(`${field}:`);
          if (Array.isArray(value)) {
            console.log(`   Type: Array with ${value.length} items`);
            console.log(`   Sample: ${JSON.stringify(value.slice(0, 3))}`);
            // Check if array contains non-integers
            const hasNonIntegers = value.some(v => typeof v === 'string' && isNaN(Number(v)));
            if (hasNonIntegers) {
              console.log(`   ⚠️  WARNING: Array contains non-integer values!`);
              console.log(`   Values: ${JSON.stringify(value)}`);
            }
          } else {
            console.log(`   Type: ${typeof value}`);
            console.log(`   Value: ${JSON.stringify(value)}`);
          }
        }
        
        console.log('\n');
        console.log('Date Fields Check:');
        console.log('------------------');
        const dateFields = ['saildate', 'startdate', 'lastcached', 'cacheddate'];
        for (const field of dateFields) {
          const value = cruiseData[field];
          if (value) {
            console.log(`${field.padEnd(15)}: ${value}`);
          }
        }
        
        console.log('\n');
        console.log('Sample Pricing Data:');
        console.log('--------------------');
        if (cruiseData.cheapest) {
          console.log('cheapest:', JSON.stringify(cruiseData.cheapest, null, 2).split('\n').slice(0, 5).join('\n'));
        }
        
        console.log('\n');
        console.log('Full Data Keys:');
        console.log('---------------');
        const keys = Object.keys(cruiseData);
        console.log(`Total keys: ${keys.length}`);
        console.log(`Keys: ${keys.slice(0, 20).join(', ')}${keys.length > 20 ? '...' : ''}`);
        
        // Check for specific problem fields
        console.log('\n');
        console.log('🔍 Investigating "system" value:');
        console.log('---------------------------------');
        let foundSystem = false;
        for (const [key, value] of Object.entries(cruiseData)) {
          if (value === 'system' || (typeof value === 'string' && value.includes('system'))) {
            console.log(`Found "system" in field "${key}": ${JSON.stringify(value)}`);
            foundSystem = true;
          }
          if (Array.isArray(value) && value.includes('system')) {
            console.log(`Found "system" in array field "${key}": ${JSON.stringify(value)}`);
            foundSystem = true;
          }
        }
        if (!foundSystem) {
          console.log('No "system" value found in top-level fields');
          
          // Check nested objects
          console.log('\nChecking nested objects...');
          if (cruiseData.shipcontent) {
            for (const [key, value] of Object.entries(cruiseData.shipcontent)) {
              if (value === 'system' || (typeof value === 'string' && value.includes('system'))) {
                console.log(`Found "system" in shipcontent.${key}: ${JSON.stringify(value)}`);
                foundSystem = true;
              }
            }
          }
        }
        
        // Save a sample for manual inspection
        console.log('\n');
        console.log('💾 Saving sample data to debug-cruise-data.json...');
        const fs = require('fs');
        fs.writeFileSync('debug-cruise-data.json', JSON.stringify(cruiseData, null, 2));
        console.log('✅ Sample data saved for inspection');
        
        client.end();
        resolve();
        
      } catch (error) {
        console.error('❌ Debug error:', error);
        client.end();
        reject(error);
      }
    });
    
    client.on('error', (err) => {
      console.error('❌ FTP error:', err.message);
      reject(err);
    });
    
    client.connect(ftpConfig);
  });
}

// Run the debugger
debugJsonData()
  .then(() => {
    console.log('\n✨ Debug completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });