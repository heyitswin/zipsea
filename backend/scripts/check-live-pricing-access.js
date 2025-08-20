#!/usr/bin/env node

/**
 * Check if we actually have access to live pricing
 * Live pricing typically requires cruise line API credentials
 */

require('dotenv').config();
const FTP = require('ftp');
const fs = require('fs');

console.log('🔍 Checking Live Pricing Access');
console.log('=' .repeat(80));

// 1. Check environment for API credentials
console.log('\n1️⃣ CHECKING CONFIGURED CREDENTIALS:\n');

const ftpCreds = {
  host: process.env.TRAVELTEK_FTP_HOST,
  user: process.env.TRAVELTEK_FTP_USER,
  password: process.env.TRAVELTEK_FTP_PASSWORD ? '***configured***' : 'NOT SET'
};

console.log('FTP Access:');
console.log(`  Host: ${ftpCreds.host || 'NOT SET'}`);
console.log(`  User: ${ftpCreds.user || 'NOT SET'}`);
console.log(`  Password: ${ftpCreds.password}`);

// Check for any API credentials
console.log('\nAPI Credentials:');
const apiKeys = [
  'TRAVELTEK_API_KEY',
  'TRAVELTEK_API_SECRET',
  'TRAVELTEK_LIVE_API_KEY',
  'CRUISE_LINE_API_KEY',
  'LIVE_PRICING_API_KEY',
  'ROYAL_CARIBBEAN_API_KEY',
  'CARNIVAL_API_KEY',
  'NCL_API_KEY'
];

let hasApiCreds = false;
apiKeys.forEach(key => {
  const value = process.env[key];
  console.log(`  ${key}: ${value ? '***configured***' : 'NOT SET'}`);
  if (value) hasApiCreds = true;
});

if (!hasApiCreds) {
  console.log('\n⚠️  No API credentials found - only FTP access available');
}

// 2. Check FTP for cachedprices data
console.log('\n2️⃣ CHECKING FTP DATA FOR CACHED/LIVE PRICING:\n');

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

async function checkCachedPricing() {
  const client = new FTP();
  
  return new Promise((resolve, reject) => {
    client.on('ready', async () => {
      console.log('Connected to FTP server\n');
      
      // Sample various files to check for cached pricing
      const testFiles = [
        '/2025/01/10/54/2092628.json',     // Crystal
        '/2025/09/15/3496/sample.json',    // Holland America
        '/2025/10/10/54/sample.json',      // Crystal future
        '/2026/01/16/185/sample.json',     // Oceania future
        '/2025/03/15/399/sample.json',     // Another line
      ];
      
      let filesWithCached = 0;
      let filesWithPrices = 0;
      let totalFiles = 0;
      const cachedPricingSamples = [];
      
      for (const pattern of testFiles) {
        const dir = pattern.substring(0, pattern.lastIndexOf('/'));
        const fileName = pattern.substring(pattern.lastIndexOf('/') + 1);
        
        await new Promise((fileResolve) => {
          client.list(dir, async (err, list) => {
            if (err) {
              fileResolve();
              return;
            }
            
            // Get first JSON file if 'sample.json' doesn't exist
            let targetFile = fileName;
            if (fileName === 'sample.json') {
              const jsonFiles = list.filter(item => item.name.endsWith('.json'));
              if (jsonFiles.length > 0) {
                targetFile = jsonFiles[0].name;
              } else {
                fileResolve();
                return;
              }
            }
            
            const filePath = `${dir}/${targetFile}`;
            
            try {
              const data = await downloadFile(client, filePath);
              totalFiles++;
              
              // Check for cached pricing
              const hasCached = data.cachedprices && 
                            typeof data.cachedprices === 'object' && 
                            Object.keys(data.cachedprices).length > 0;
              
              const hasPrices = data.prices && 
                              typeof data.prices === 'object' && 
                              Object.keys(data.prices).length > 0;
              
              if (hasCached) {
                filesWithCached++;
                cachedPricingSamples.push({
                  file: filePath,
                  cruiseId: data.cruiseid,
                  rateCodes: Object.keys(data.cachedprices).slice(0, 3)
                });
              }
              
              if (hasPrices) filesWithPrices++;
              
              console.log(`File: ${filePath}`);
              console.log(`  Cruise: ${data.cruiseid} - ${data.name || 'unnamed'}`);
              console.log(`  Static Pricing (prices): ${hasPrices ? '✅ YES' : '❌ NO'}`);
              console.log(`  Cached Pricing (cachedprices): ${hasCached ? '✅ YES' : '❌ NO'}`);
              console.log();
              
            } catch (error) {
              console.log(`Error checking ${filePath}: ${error.message}\n`);
            }
            
            fileResolve();
          });
        });
      }
      
      console.log('=' .repeat(80));
      console.log('📊 SUMMARY:\n');
      console.log(`Files checked: ${totalFiles}`);
      console.log(`Files with static pricing: ${filesWithPrices} (${Math.round(filesWithPrices/totalFiles*100)}%)`);
      console.log(`Files with cached pricing: ${filesWithCached} (${Math.round(filesWithCached/totalFiles*100)}%)`);
      
      if (cachedPricingSamples.length > 0) {
        console.log('\n✅ CACHED PRICING FOUND IN:');
        cachedPricingSamples.forEach(s => {
          console.log(`  ${s.file}`);
          console.log(`    Rate codes: ${s.rateCodes.join(', ')}`);
        });
      } else {
        console.log('\n❌ NO CACHED PRICING FOUND IN ANY FILES');
      }
      
      client.end();
      resolve({ filesWithCached, filesWithPrices, totalFiles });
    });
    
    client.on('error', (err) => {
      console.error('FTP Error:', err.message);
      reject(err);
    });
    
    if (process.env.TRAVELTEK_FTP_USER) {
      console.log('Connecting to FTP server...');
      client.connect(ftpConfig);
    } else {
      console.log('❌ No FTP credentials configured');
      resolve({ filesWithCached: 0, filesWithPrices: 0, totalFiles: 0 });
    }
  });
}

// 3. Check database for any live pricing
async function checkDatabaseForLivePricing() {
  console.log('\n3️⃣ CHECKING DATABASE FOR LIVE PRICING:\n');
  
  try {
    const { drizzle } = require('drizzle-orm/postgres-js');
    const postgres = require('postgres');
    const { eq } = require('drizzle-orm');
    const schema = require('../dist/db/schema');
    
    const dbSql = postgres(process.env.DATABASE_URL, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    
    const db = drizzle(dbSql, { schema });
    
    // Check for any live pricing records
    const livePricingCount = await db.select({ count: require('drizzle-orm').sql`count(*)::int` })
      .from(schema.pricing)
      .where(eq(schema.pricing.priceType, 'live'));
    
    console.log(`Live pricing records in database: ${livePricingCount[0].count}`);
    
    await dbSql.end();
  } catch (error) {
    console.log('Could not check database:', error.message);
  }
}

// Run checks
async function main() {
  await checkCachedPricing();
  await checkDatabaseForLivePricing();
  
  console.log('\n' + '=' .repeat(80));
  console.log('🔍 ANALYSIS:\n');
  
  console.log('Based on the checks above:');
  console.log('\n1. We only have FTP access configured (no API credentials)');
  console.log('2. The "cachedprices" field in FTP files is likely:');
  console.log('   - Pre-calculated/cached data from Traveltek');
  console.log('   - NOT real-time live pricing from cruise lines');
  console.log('   - May be stale or limited in availability');
  console.log('\n3. True live pricing would require:');
  console.log('   - Direct API credentials for each cruise line');
  console.log('   - Real-time API calls (not FTP files)');
  console.log('   - Additional integration work');
  console.log('\n📌 CONCLUSION: We likely DO NOT have access to true live pricing.');
  console.log('   We only have static pricing and pre-cached pricing from FTP files.');
}

main().catch(console.error);