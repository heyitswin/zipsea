#!/usr/bin/env node

/**
 * Test script to verify pricing is being captured correctly after fixes
 */

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

async function downloadFile(client, filePath) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Download timeout')), 20000);
    
    client.get(filePath, (err, stream) => {
      if (err) {
        clearTimeout(timeout);
        reject(err);
        return;
      }
      
      let data = '';
      stream.on('data', chunk => data += chunk);
      stream.on('end', () => {
        clearTimeout(timeout);
        try {
          resolve(JSON.parse(data));
        } catch (parseErr) {
          reject(parseErr);
        }
      });
      stream.on('error', err => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  });
}

async function testPricingStructure() {
  const client = new FTP();
  
  return new Promise((resolve, reject) => {
    client.on('ready', async () => {
      console.log('✅ Connected to FTP server\n');
      console.log('Testing pricing structure on various cruises...\n');
      console.log('=' .repeat(80));
      
      // Test files from different months and lines
      const testFiles = [
        '/2025/09/15/3496/sample.json',  // September 2025
        '/2025/10/10/54/sample.json',    // October 2025
        '/2025/11/118/4731/sample.json', // November 2025
        '/2026/01/16/185/sample.json',   // January 2026
      ];
      
      // First, find actual files in these directories
      for (const pattern of testFiles) {
        const dir = pattern.substring(0, pattern.lastIndexOf('/'));
        
        await new Promise((dirResolve) => {
          client.list(dir, async (err, list) => {
            if (err) {
              console.log(`\n❌ Directory not found: ${dir}`);
              dirResolve();
              return;
            }
            
            const jsonFiles = list.filter(item => item.name.endsWith('.json')).slice(0, 1);
            if (jsonFiles.length === 0) {
              console.log(`\n❌ No JSON files in: ${dir}`);
              dirResolve();
              return;
            }
            
            const filePath = `${dir}/${jsonFiles[0].name}`;
            console.log(`\n📋 Testing: ${filePath}`);
            console.log('-' .repeat(60));
            
            try {
              const data = await downloadFile(client, filePath);
              
              console.log(`Cruise ID: ${data.cruiseid}`);
              console.log(`Name: ${data.name || 'N/A'}`);
              console.log(`Sail Date: ${data.saildate}`);
              
              // Analyze pricing structure
              console.log('\n🔍 PRICING STRUCTURE ANALYSIS:');
              
              // 1. Static Prices
              if (data.prices && typeof data.prices === 'object') {
                const rateCodes = Object.keys(data.prices);
                console.log(`\n1. Static Prices (data.prices):`);
                console.log(`   Rate Codes: ${rateCodes.length}`);
                
                if (rateCodes.length > 0) {
                  const firstRate = rateCodes[0];
                  const cabinIds = Object.keys(data.prices[firstRate] || {});
                  console.log(`   First Rate: ${firstRate}`);
                  console.log(`   Cabin IDs: ${cabinIds.slice(0, 5).join(', ')}`);
                  
                  if (cabinIds.length > 0) {
                    const firstCabin = cabinIds[0];
                    const priceObj = data.prices[firstRate][firstCabin];
                    
                    console.log(`\n   Sample: prices.${firstRate}.${firstCabin}:`);
                    console.log(`   Type: ${typeof priceObj}`);
                    
                    if (typeof priceObj === 'object') {
                      // Check if it's 2-level (price object) or 3-level (another level)
                      const keys = Object.keys(priceObj);
                      if (keys.includes('price') || keys.includes('total')) {
                        console.log('   ✅ CORRECT: 2-level structure (rate -> cabin -> price)');
                        console.log(`   Price: ${priceObj.price || priceObj.total || 'N/A'}`);
                        console.log(`   Fields: ${keys.slice(0, 10).join(', ')}`);
                      } else {
                        console.log('   ⚠️  UNEXPECTED: 3-level structure detected');
                        console.log(`   Next level keys: ${keys.join(', ')}`);
                      }
                    }
                  }
                }
              } else {
                console.log('\n1. Static Prices: ❌ Not found or empty');
              }
              
              // 2. Cached Prices
              if (data.cachedprices && typeof data.cachedprices === 'object') {
                const rateCodes = Object.keys(data.cachedprices);
                console.log(`\n2. Cached Prices (data.cachedprices):`);
                console.log(`   Rate Codes: ${rateCodes.length}`);
                
                if (rateCodes.length > 0) {
                  const firstRate = rateCodes[0];
                  const cabinIds = Object.keys(data.cachedprices[firstRate] || {});
                  console.log(`   Sample cabin IDs: ${cabinIds.slice(0, 3).join(', ')}`);
                }
              } else {
                console.log('\n2. Cached Prices: ❌ Not found or empty');
              }
              
              // 3. Combined Cheapest
              if (data.cheapest?.combined) {
                console.log(`\n3. Combined Cheapest (data.cheapest.combined):`);
                console.log(`   Inside: ${data.cheapest.combined.inside || 'null'}`);
                console.log(`   Outside: ${data.cheapest.combined.outside || 'null'}`);
                console.log(`   Balcony: ${data.cheapest.combined.balcony || 'null'}`);
                console.log(`   Suite: ${data.cheapest.combined.suite || 'null'}`);
              } else {
                console.log('\n3. Combined Cheapest: ❌ Not found');
              }
              
              // 4. Alternative pricing locations
              console.log(`\n4. Other Pricing Fields:`);
              console.log(`   cheapest.prices: ${data.cheapest?.prices ? 'Present' : 'Not found'}`);
              console.log(`   cheapest.cachedprices: ${data.cheapest?.cachedprices ? 'Present' : 'Not found'}`);
              console.log(`   altsailings: ${data.altsailings ? 'Present' : 'Not found'}`);
              
            } catch (error) {
              console.log(`❌ Error processing: ${error.message}`);
            }
            
            dirResolve();
          });
        });
      }
      
      client.end();
      resolve();
    });
    
    client.on('error', (err) => {
      console.error('❌ FTP Error:', err.message);
      reject(err);
    });
    
    console.log('🔄 Connecting to FTP server...');
    client.connect(ftpConfig);
  });
}

// Run test
testPricingStructure()
  .then(() => {
    console.log('\n' + '=' .repeat(80));
    console.log('✅ Pricing structure test complete!');
    console.log('\nNext steps:');
    console.log('1. If 2-level structure confirmed, run: FORCE_UPDATE=true SYNC_YEARS=2025,2026 node scripts/sync-drizzle-correct.js');
    console.log('2. Then verify with: node scripts/verify-sync-data.js');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });