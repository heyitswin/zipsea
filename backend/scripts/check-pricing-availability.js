#!/usr/bin/env node

/**
 * Quick check to find cruises with actual pricing data
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

async function checkPricing() {
  const client = new FTP();
  let totalChecked = 0;
  let withPricing = 0;
  let withCachedPricing = 0;
  let withCheapestPricing = 0;
  const samplesWithPricing = [];
  
  return new Promise((resolve, reject) => {
    client.on('ready', async () => {
      console.log('✅ Connected to FTP server\n');
      console.log('Checking random sample of cruises for pricing data...\n');
      
      // Sample different cruise lines
      const sampleFiles = [
        '/2025/02/10/54/2092640.json',   // Crystal
        '/2025/02/15/3496/2052740.json', // Holland America
        '/2025/03/118/4731/2184380.json', // Aurora
        '/2025/02/16/185/2112780.json',  // Another line
        '/2025/03/15/399/2052000.json',  // Another line
      ];
      
      for (const filePath of sampleFiles) {
        await new Promise((fileResolve) => {
          client.get(filePath, (err, stream) => {
            if (err) {
              console.log(`❌ Could not check ${filePath}`);
              fileResolve();
              return;
            }
            
            let data = '';
            stream.on('data', chunk => data += chunk);
            stream.on('end', () => {
              try {
                const json = JSON.parse(data);
                totalChecked++;
                
                // Check different pricing fields
                const hasPrices = json.prices && Object.keys(json.prices).length > 0;
                const hasCachedPrices = json.cachedprices && Object.keys(json.cachedprices).length > 0;
                const hasCheapest = json.cheapest && (
                  json.cheapest.prices.inside || 
                  json.cheapest.prices.outside ||
                  json.cheapest.prices.balcony ||
                  json.cheapest.prices.suite
                );
                
                if (hasPrices) withPricing++;
                if (hasCachedPrices) withCachedPricing++;
                if (hasCheapest) withCheapestPricing++;
                
                console.log(`📋 Cruise ${json.cruiseid} (${json.name || 'unnamed'}):`);
                console.log(`   • prices: ${hasPrices ? `YES (${Object.keys(json.prices).length} rate codes)` : 'empty'}`);
                console.log(`   • cachedprices: ${hasCachedPrices ? 'YES' : 'empty'}`);
                console.log(`   • cheapest: ${hasCheapest ? 'YES' : 'null'}`);
                
                if (hasPrices) {
                  // Sample the structure
                  const firstRateCode = Object.keys(json.prices)[0];
                  const firstCabin = Object.keys(json.prices[firstRateCode] || {})[0];
                  const firstOcc = Object.keys(json.prices[firstRateCode]?.[firstCabin] || {})[0];
                  
                  console.log(`   • Sample: prices.${firstRateCode}.${firstCabin}.${firstOcc}`);
                  console.log(`     ${JSON.stringify(json.prices[firstRateCode]?.[firstCabin]?.[firstOcc], null, 2)}`);
                  
                  samplesWithPricing.push({
                    cruiseId: json.cruiseid,
                    filePath: filePath,
                    rateCodes: Object.keys(json.prices)
                  });
                }
                
                console.log();
                fileResolve();
              } catch (parseErr) {
                console.log(`❌ Parse error: ${filePath}`);
                fileResolve();
              }
            });
            
            stream.on('error', err => {
              console.log(`❌ Stream error: ${filePath}`);
              fileResolve();
            });
          });
        });
      }
      
      console.log('\n' + '='.repeat(60));
      console.log('📊 PRICING AVAILABILITY SUMMARY:');
      console.log('='.repeat(60));
      console.log(`Total files checked: ${totalChecked}`);
      console.log(`With 'prices' data: ${withPricing} (${Math.round(withPricing/totalChecked*100)}%)`);
      console.log(`With 'cachedprices': ${withCachedPricing} (${Math.round(withCachedPricing/totalChecked*100)}%)`);
      console.log(`With 'cheapest': ${withCheapestPricing} (${Math.round(withCheapestPricing/totalChecked*100)}%)`);
      
      if (samplesWithPricing.length > 0) {
        console.log('\n✅ Files with pricing to test with:');
        samplesWithPricing.forEach(s => {
          console.log(`   ${s.filePath} - Cruise ${s.cruiseId}`);
          console.log(`   Rate codes: ${s.rateCodes.slice(0, 3).join(', ')}`);
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

// Run check
checkPricing()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });