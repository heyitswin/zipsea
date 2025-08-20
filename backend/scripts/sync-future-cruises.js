#!/usr/bin/env node

/**
 * Sync future cruises starting from September 2025
 * These should have pricing since they're in the future
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

// Statistics
let stats = {
  totalFiles: 0,
  withPricing: 0,
  withoutPricing: 0,
  samples: []
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

async function processDirectory(client, dirPath, limit = 5) {
  return new Promise((resolve) => {
    client.list(dirPath, async (err, list) => {
      if (err) {
        resolve();
        return;
      }
      
      const jsonFiles = list.filter(item => item.name.endsWith('.json')).slice(0, limit);
      
      for (const file of jsonFiles) {
        const filePath = `${dirPath}/${file.name}`;
        try {
          const data = await downloadFile(client, filePath);
          stats.totalFiles++;
          
          // Check pricing
          const hasPricing = data.prices && Object.keys(data.prices).length > 0;
          
          if (hasPricing) {
            stats.withPricing++;
            console.log(`✅ HAS PRICING: ${filePath}`);
            console.log(`   Cruise: ${data.cruiseid} - ${data.name || 'unnamed'}`);
            console.log(`   Sail Date: ${data.saildate}`);
            console.log(`   Rate Codes: ${Object.keys(data.prices).length}`);
            
            // Sample the pricing structure
            if (stats.samples.length < 3) {
              const firstRate = Object.keys(data.prices)[0];
              const firstCabin = Object.keys(data.prices[firstRate] || {})[0];
              const firstOcc = Object.keys(data.prices[firstRate]?.[firstCabin] || {})[0];
              const samplePrice = data.prices[firstRate]?.[firstCabin]?.[firstOcc];
              
              stats.samples.push({
                cruiseId: data.cruiseid,
                filePath: filePath,
                rateCodes: Object.keys(data.prices).slice(0, 3),
                samplePrice: samplePrice
              });
              
              console.log(`   Sample Price Structure:`);
              console.log(`   ${JSON.stringify(samplePrice, null, 2).split('\n').map(l => '   ' + l).join('\n')}`);
            }
          } else {
            stats.withoutPricing++;
            console.log(`❌ NO PRICING: ${filePath} - Cruise ${data.cruiseid} (${data.saildate})`);
          }
          
          console.log();
        } catch (error) {
          console.log(`⚠️ Error processing ${filePath}: ${error.message}`);
        }
      }
      
      resolve();
    });
  });
}

async function syncFutureCruises() {
  const client = new FTP();
  
  return new Promise((resolve, reject) => {
    client.on('ready', async () => {
      console.log('✅ Connected to FTP server\n');
      console.log('🔍 Searching for future cruises (Sept 2025 onwards)...\n');
      
      // Check September, October, November, December 2025
      const months = ['09', '10', '11', '12'];
      
      for (const month of months) {
        console.log(`\n📅 Checking 2025/${month}...`);
        console.log('=' .repeat(60));
        
        const monthPath = `/2025/${month}`;
        
        await new Promise((monthResolve) => {
          client.list(monthPath, async (err, lineList) => {
            if (err) {
              console.log(`   No data for ${monthPath}`);
              monthResolve();
              return;
            }
            
            const lineDirs = lineList.filter(item => item.type === 'd').slice(0, 3); // Check first 3 cruise lines
            console.log(`   Found ${lineList.filter(item => item.type === 'd').length} cruise lines`);
            console.log(`   Checking first ${lineDirs.length} lines...\n`);
            
            for (const lineDir of lineDirs) {
              const linePath = `${monthPath}/${lineDir.name}`;
              
              await new Promise((lineResolve) => {
                client.list(linePath, async (err, shipList) => {
                  if (err) {
                    lineResolve();
                    return;
                  }
                  
                  const shipDirs = shipList.filter(item => item.type === 'd').slice(0, 2); // Check first 2 ships
                  
                  for (const shipDir of shipDirs) {
                    const shipPath = `${linePath}/${shipDir.name}`;
                    console.log(`   📁 Checking ${shipPath}...`);
                    await processDirectory(client, shipPath, 3); // Check up to 3 files per ship
                  }
                  
                  lineResolve();
                });
              });
            }
            
            monthResolve();
          });
        });
      }
      
      // Also check 2026 for good measure
      console.log(`\n📅 Checking 2026/01...`);
      console.log('=' .repeat(60));
      
      await new Promise((yearResolve) => {
        client.list('/2026/01', async (err, lineList) => {
          if (err) {
            console.log(`   No data for 2026/01`);
            yearResolve();
            return;
          }
          
          const lineDirs = lineList.filter(item => item.type === 'd').slice(0, 2);
          console.log(`   Found ${lineList.filter(item => item.type === 'd').length} cruise lines`);
          
          for (const lineDir of lineDirs) {
            const linePath = `/2026/01/${lineDir.name}`;
            
            await new Promise((lineResolve) => {
              client.list(linePath, async (err, shipList) => {
                if (err) {
                  lineResolve();
                  return;
                }
                
                const shipDirs = shipList.filter(item => item.type === 'd').slice(0, 1);
                
                for (const shipDir of shipDirs) {
                  const shipPath = `${linePath}/${shipDir.name}`;
                  console.log(`   📁 Checking ${shipPath}...`);
                  await processDirectory(client, shipPath, 3);
                }
                
                lineResolve();
              });
            });
          }
          
          yearResolve();
        });
      });
      
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

// Run sync
syncFutureCruises()
  .then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('📊 FUTURE CRUISES PRICING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total files checked: ${stats.totalFiles}`);
    console.log(`WITH pricing data: ${stats.withPricing} (${Math.round(stats.withPricing/stats.totalFiles*100)}%)`);
    console.log(`WITHOUT pricing: ${stats.withoutPricing} (${Math.round(stats.withoutPricing/stats.totalFiles*100)}%)`);
    
    if (stats.samples.length > 0) {
      console.log('\n✅ CRUISES WITH PRICING TO SYNC:');
      stats.samples.forEach((s, i) => {
        console.log(`\n${i + 1}. ${s.filePath}`);
        console.log(`   Cruise ID: ${s.cruiseId}`);
        console.log(`   Rate Codes: ${s.rateCodes.join(', ')}`);
        if (s.samplePrice) {
          console.log(`   Sample Price: $${s.samplePrice.price || s.samplePrice.total || 'N/A'}`);
        }
      });
      
      console.log('\n📌 To sync these cruises with pricing, run:');
      console.log('   FORCE_UPDATE=true SYNC_YEARS=2025,2026 node scripts/sync-drizzle-correct.js');
    }
    
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  });