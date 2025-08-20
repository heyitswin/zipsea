#!/usr/bin/env node

/**
 * Direct sync script - bypasses discovery and syncs specific files
 * Run this in Render shell to populate the database
 */

require('dotenv').config();
const FTP = require('ftp');

console.log('🚀 Direct FTP Sync - Bypassing Discovery');
console.log('=========================================\n');

// Check environment
console.log('📋 Environment Check:');
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
console.log(`REDIS_URL: ${process.env.REDIS_URL ? 'SET' : 'NOT SET'}`);
console.log(`TRAVELTEK_FTP_HOST: ${process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net'}`);
console.log(`TRAVELTEK_FTP_USER: ${process.env.TRAVELTEK_FTP_USER ? 'SET' : 'NOT SET'}`);
console.log(`TRAVELTEK_FTP_PASSWORD: ${process.env.TRAVELTEK_FTP_PASSWORD ? 'SET' : 'NOT SET'}`);
console.log('');

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

// Helper to list directory
async function listDirectory(client, dirPath) {
  return new Promise((resolve, reject) => {
    client.list(dirPath, (err, list) => {
      if (err) {
        reject(err);
      } else {
        resolve(list || []);
      }
    });
  });
}

async function syncDirectFiles() {
  const client = new FTP();
  
  return new Promise(async (resolve, reject) => {
    client.on('ready', async () => {
      console.log('✅ Connected to FTP\n');
      
      try {
        // We know from the test that 2025/12/1/180 has files
        // Let's sync a few files from there as a start
        const testPaths = [
          '2025/12/1/180',
          '2025/12/1/2649',
          '2025/12/1/3'
        ];
        
        const allFiles = [];
        
        for (const path of testPaths) {
          console.log(`📁 Checking ${path}...`);
          try {
            const files = await listDirectory(client, path);
            const jsonFiles = files.filter(f => f.type === '-' && f.name.endsWith('.json'));
            
            console.log(`   Found ${jsonFiles.length} JSON files`);
            
            // Take first 2 files from each directory
            for (const file of jsonFiles.slice(0, 2)) {
              allFiles.push({
                path: `${path}/${file.name}`,
                size: file.size,
                // Parse metadata from path
                year: '2025',
                month: '12',
                lineid: '1',
                shipid: path.split('/')[3],
                codetocruiseid: file.name.replace('.json', '')
              });
            }
          } catch (err) {
            console.log(`   Error listing ${path}: ${err.message}`);
          }
        }
        
        console.log(`\n📥 Total files to sync: ${allFiles.length}\n`);
        
        if (allFiles.length === 0) {
          console.log('❌ No files found to sync');
          client.end();
          return resolve();
        }
        
        // Download and sync each file
        const { dataSyncService } = require('../dist/services/data-sync.service');
        
        let successful = 0;
        let failed = 0;
        
        for (const fileInfo of allFiles) {
          console.log(`\n📄 Processing ${fileInfo.path}...`);
          
          try {
            // Download file
            const jsonContent = await downloadFile(client, fileInfo.path);
            const cruiseData = JSON.parse(jsonContent);
            
            console.log(`   Cruise: ${cruiseData.name || 'Unknown'}`);
            console.log(`   ID: ${cruiseData.cruiseid}`);
            console.log(`   Nights: ${cruiseData.nights}`);
            console.log(`   Sail Date: ${cruiseData.saildate}`);
            
            // Create file object expected by sync service
            const fileObj = {
              year: fileInfo.year,
              month: fileInfo.month,
              lineid: fileInfo.lineid,
              shipid: fileInfo.shipid,
              codetocruiseid: fileInfo.codetocruiseid,
              filePath: fileInfo.path
            };
            
            // Sync to database
            await dataSyncService.syncCruiseDataFile(fileObj, cruiseData);
            console.log(`   ✅ Synced successfully`);
            successful++;
            
          } catch (error) {
            console.error(`   ❌ Failed: ${error.message}`);
            failed++;
          }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('📊 SYNC SUMMARY');
        console.log('='.repeat(50));
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📁 Total: ${allFiles.length}`);
        
        // Verify in database
        if (successful > 0) {
          console.log('\n🔍 Verifying in database...');
          const { db } = require('../dist/db/connection');
          const { cruises, cruiseLines, ships } = require('../dist/db/schema');
          
          const cruiseCount = await db.select().from(cruises);
          const lineCount = await db.select().from(cruiseLines);
          const shipCount = await db.select().from(ships);
          
          console.log(`\n📊 Database Status:`);
          console.log(`   Cruises: ${cruiseCount.length}`);
          console.log(`   Cruise Lines: ${lineCount.length}`);
          console.log(`   Ships: ${shipCount.length}`);
        }
        
        client.end();
        resolve();
        
      } catch (error) {
        console.error('❌ Sync error:', error);
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

// Run the sync
syncDirectFiles()
  .then(() => {
    console.log('\n✨ Direct sync completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });