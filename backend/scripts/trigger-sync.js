#!/usr/bin/env node

/**
 * Trigger FTP sync manually and watch the process
 * Run this in Render shell to debug sync issues
 */

require('dotenv').config();
const { traveltekFTPService } = require('../dist/services/traveltek-ftp.service');
const { dataSyncService } = require('../dist/services/data-sync.service');

console.log('🔄 Manual FTP Sync Trigger');
console.log('===========================\n');

// Check environment
console.log('📋 Environment Check:');
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
console.log(`REDIS_URL: ${process.env.REDIS_URL ? 'SET' : 'NOT SET'}`);
console.log(`TRAVELTEK_FTP_HOST: ${process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net'}`);
console.log(`TRAVELTEK_FTP_USER: ${process.env.TRAVELTEK_FTP_USER ? 'SET' : 'NOT SET'}`);
console.log(`TRAVELTEK_FTP_PASSWORD: ${process.env.TRAVELTEK_FTP_PASSWORD ? 'SET' : 'NOT SET'}`);
console.log('');

async function testSync() {
  try {
    // Step 1: Test FTP connection
    console.log('🔌 Step 1: Testing FTP connection...');
    const healthCheck = await traveltekFTPService.healthCheck();
    
    if (!healthCheck.connected) {
      console.error('❌ FTP connection failed:', healthCheck.error);
      return;
    }
    console.log('✅ FTP connection successful\n');
    
    // Step 2: Discover available files
    console.log('🔍 Step 2: Discovering available cruise files...');
    console.log('(Looking for files from current year/month)');
    
    const currentYear = new Date().getFullYear().toString();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    
    console.log(`Year: ${currentYear}, Month: ${currentMonth}`);
    
    // Try to discover files with a timeout
    const discoverPromise = traveltekFTPService.discoverCruiseFiles(
      currentYear,
      currentMonth
    );
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Discovery timeout after 30 seconds')), 30000)
    );
    
    const files = await Promise.race([discoverPromise, timeoutPromise]);
    
    console.log(`✅ Found ${files.length} cruise files\n`);
    
    if (files.length === 0) {
      console.log('⚠️  No files found for current month');
      console.log('Trying to get available years...');
      
      const years = await traveltekFTPService.getAvailableYears();
      console.log('Available years:', years);
      
      if (years.length > 0) {
        const year = years[years.length - 1];
        const months = await traveltekFTPService.getAvailableMonths(year);
        console.log(`Available months in ${year}:`, months);
        
        if (months.length > 0) {
          const month = months[months.length - 1];
          console.log(`\nRetrying with ${year}/${month}...`);
          const retryFiles = await traveltekFTPService.discoverCruiseFiles(year, month);
          console.log(`Found ${retryFiles.length} files in ${year}/${month}`);
          
          if (retryFiles.length > 0) {
            files.push(...retryFiles.slice(0, 1)); // Just take one file for testing
          }
        }
      }
    }
    
    if (files.length === 0) {
      console.log('❌ No cruise files available to sync');
      return;
    }
    
    // Step 3: Download and sync a single file as a test
    console.log('📥 Step 3: Downloading and syncing first file as test...');
    const testFile = files[0];
    console.log(`Test file: ${testFile.filePath}`);
    console.log(`Line ID: ${testFile.lineid}, Ship ID: ${testFile.shipid}`);
    console.log(`Cruise ID: ${testFile.codetocruiseid}`);
    
    try {
      const cruiseData = await traveltekFTPService.getCruiseDataFile(testFile.filePath);
      console.log('✅ File downloaded successfully');
      console.log(`   Cruise: ${cruiseData.name || 'Unknown'}`);
      console.log(`   Nights: ${cruiseData.nights || 'Unknown'}`);
      console.log(`   Sail Date: ${cruiseData.saildate || 'Unknown'}`);
      
      // Step 4: Sync to database
      console.log('\n💾 Step 4: Syncing to database...');
      await dataSyncService.syncCruiseDataFile(testFile, cruiseData);
      console.log('✅ Successfully synced to database!');
      
      // Step 5: Verify in database
      console.log('\n🔍 Step 5: Verifying in database...');
      const { db } = require('../dist/db/connection');
      const { cruises } = require('../dist/db/schema');
      const { eq } = require('drizzle-orm');
      
      const savedCruise = await db.select().from(cruises)
        .where(eq(cruises.id, cruiseData.cruiseid))
        .limit(1);
      
      if (savedCruise.length > 0) {
        console.log('✅ Cruise found in database!');
        console.log(`   ID: ${savedCruise[0].id}`);
        console.log(`   Name: ${savedCruise[0].name}`);
        console.log(`   Status: ${savedCruise[0].isActive ? 'Active' : 'Inactive'}`);
      } else {
        console.log('⚠️  Cruise not found in database after sync');
      }
      
    } catch (syncError) {
      console.error('❌ Sync error:', syncError.message);
      console.error('Full error:', syncError);
    }
    
    // Step 6: Test batch sync
    console.log('\n📦 Step 6: Testing batch sync (first 5 files)...');
    const batchFiles = files.slice(0, 5);
    
    try {
      const fileDataPairs = await traveltekFTPService.batchDownloadCruiseData(batchFiles, 5);
      console.log(`✅ Downloaded ${fileDataPairs.length} files`);
      
      const syncResult = await dataSyncService.batchSyncCruiseData(fileDataPairs);
      console.log(`✅ Sync results: ${syncResult.successful} successful, ${syncResult.failed} failed`);
      
      if (syncResult.errors.length > 0) {
        console.log('Errors:');
        syncResult.errors.forEach(err => {
          console.log(`   - ${err.file}: ${err.error}`);
        });
      }
    } catch (batchError) {
      console.error('❌ Batch sync error:', batchError.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    // Disconnect from FTP
    console.log('\n🔌 Disconnecting from FTP...');
    await traveltekFTPService.disconnect();
    console.log('✅ Disconnected');
    
    // Close database connection
    process.exit(0);
  }
}

// Run the test
testSync().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});