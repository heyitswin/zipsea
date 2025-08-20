#!/usr/bin/env node

/**
 * Debug script to examine the structure of Traveltek JSON files
 */

require('dotenv').config();
const FTP = require('ftp');
const fs = require('fs');

const ftpConfig = {
  host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
  user: process.env.TRAVELTEK_FTP_USER,
  password: process.env.TRAVELTEK_FTP_PASSWORD,
  port: 21,
  secure: false,
  connTimeout: 30000,
  pasvTimeout: 30000
};

// Download and examine a single file
async function downloadAndExamine() {
  const client = new FTP();
  
  return new Promise((resolve, reject) => {
    client.on('ready', async () => {
      console.log('✅ Connected to FTP server\n');
      
      const testFile = '/2025/01/10/54/2092628.json'; // Cruise 345235
      
      console.log(`📥 Downloading: ${testFile}`);
      
      client.get(testFile, (err, stream) => {
        if (err) {
          console.error('❌ Download failed:', err);
          client.end();
          reject(err);
          return;
        }
        
        let data = '';
        stream.on('data', chunk => data += chunk);
        stream.on('end', () => {
          try {
            const json = JSON.parse(data);
            
            console.log('\n📋 JSON STRUCTURE ANALYSIS:');
            console.log('================================\n');
            
            // Basic cruise info
            console.log('1️⃣ BASIC INFO:');
            console.log(`   • Cruise ID: ${json.cruiseid}`);
            console.log(`   • Name: ${json.cruisename}`);
            console.log(`   • Sail Date: ${json.saildate}`);
            console.log(`   • Nights: ${json.nights}`);
            
            // Check pricing structure
            console.log('\n2️⃣ PRICING STRUCTURE:');
            if (json.prices) {
              const rateCodes = Object.keys(json.prices);
              console.log(`   • Rate Codes: ${rateCodes.length} found`);
              console.log(`   • First 3 Rate Codes: ${rateCodes.slice(0, 3).join(', ')}`);
              
              // Check first rate code structure
              if (rateCodes.length > 0) {
                const firstRate = json.prices[rateCodes[0]];
                const cabinCodes = Object.keys(firstRate || {});
                console.log(`   • Cabin Codes in ${rateCodes[0]}: ${cabinCodes.length} found`);
                console.log(`   • First 3 Cabin Codes: ${cabinCodes.slice(0, 3).join(', ')}`);
                
                // Check occupancy structure
                if (cabinCodes.length > 0) {
                  const firstCabin = firstRate[cabinCodes[0]];
                  const occupancyCodes = Object.keys(firstCabin || {});
                  console.log(`   • Occupancy Codes in ${cabinCodes[0]}: ${occupancyCodes.length} found`);
                  console.log(`   • First 3 Occupancy Codes: ${occupancyCodes.slice(0, 3).join(', ')}`);
                  
                  // Show sample price data
                  if (occupancyCodes.length > 0) {
                    const samplePrice = firstCabin[occupancyCodes[0]];
                    console.log('\n   📦 Sample Price Object:');
                    console.log(`      ${JSON.stringify(samplePrice, null, 2).split('\\n').join('\\n      ')}`);
                  }
                }
              }
            } else {
              console.log('   ❌ No prices field found');
            }
            
            // Check itinerary structure
            console.log('\n3️⃣ ITINERARY STRUCTURE:');
            if (json.itinerary) {
              console.log(`   • Days: ${json.itinerary.length}`);
              if (json.itinerary.length > 0) {
                console.log('\n   📦 Sample Day 1:');
                console.log(`      ${JSON.stringify(json.itinerary[0], null, 2).split('\\n').join('\\n      ')}`);
                
                console.log('\n   📦 Sample Day 2:');
                console.log(`      ${JSON.stringify(json.itinerary[1], null, 2).split('\\n').join('\\n      ')}`);
              }
            } else {
              console.log('   ❌ No itinerary field found');
            }
            
            // Check port and region data
            console.log('\n4️⃣ PORTS AND REGIONS:');
            console.log(`   • Port IDs: ${json.portids}`);
            console.log(`   • Ports: ${json.ports ? json.ports.slice(0, 5).join(', ') : 'Not found'}`);
            console.log(`   • Region IDs: ${json.regionids}`);
            console.log(`   • Regions: ${json.regions ? json.regions.join(', ') : 'Not found'}`);
            
            // Check ship content
            console.log('\n5️⃣ SHIP CONTENT:');
            if (json.shipcontent) {
              console.log('   • Ship content exists');
              console.log(`   • Ship Class: ${json.shipcontent.shipclass || 'N/A'}`);
              console.log(`   • Tonnage: ${json.shipcontent.tonnage || 'N/A'}`);
              console.log(`   • Total Cabins: ${json.shipcontent.totalcabins || 'N/A'}`);
              console.log(`   • Images: ${json.shipcontent.shipimages ? json.shipcontent.shipimages.length : 0}`);
            } else {
              console.log('   ❌ No shipcontent field found');
            }
            
            // Save sample to file for detailed inspection
            fs.writeFileSync('sample-cruise-data.json', JSON.stringify(json, null, 2));
            console.log('\n✅ Full JSON saved to sample-cruise-data.json for inspection');
            
            client.end();
            resolve();
          } catch (parseErr) {
            console.error('❌ Parse failed:', parseErr);
            client.end();
            reject(parseErr);
          }
        });
        
        stream.on('error', err => {
          console.error('❌ Stream error:', err);
          client.end();
          reject(err);
        });
      });
    });
    
    client.on('error', (err) => {
      console.error('❌ FTP Error:', err.message);
      reject(err);
    });
    
    console.log('🔄 Connecting to FTP server...');
    client.connect(ftpConfig);
  });
}

// Run debug
downloadAndExamine()
  .then(() => {
    console.log('\n✅ Debug complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  });