#!/usr/bin/env node

/**
 * Fixed recent sync - optimized discovery that won't timeout
 * Syncs recent cruise data efficiently
 */

require('dotenv').config();

console.log('🔄 Optimized Recent Sync');
console.log('========================\n');

async function syncRecentOptimized() {
  const { traveltekFTPService } = require('../dist/services/traveltek-ftp.service');
  const { dataSyncService } = require('../dist/services/data-sync.service');
  
  try {
    // Connect to FTP
    console.log('🔌 Connecting to FTP...');
    await traveltekFTPService.connect();
    console.log('✅ Connected\n');
    
    // Get current and next month
    const now = new Date();
    const currentYear = now.getFullYear().toString();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const nextMonth = String((now.getMonth() + 2) % 12 || 12).padStart(2, '0');
    const nextYear = now.getMonth() === 11 ? String(now.getFullYear() + 1) : currentYear;
    
    console.log(`📅 Syncing data for:`);
    console.log(`   Current: ${currentYear}/${currentMonth}`);
    console.log(`   Next: ${nextYear}/${nextMonth}\n`);
    
    const allFiles = [];
    
    // Process current month
    console.log(`🔍 Discovering files for ${currentYear}/${currentMonth}...`);
    try {
      const monthPath = `${currentYear}/${currentMonth}`;
      const lineIds = await traveltekFTPService.listFiles(monthPath);
      
      // Only process first few cruise lines to avoid timeout
      const linesToProcess = lineIds
        .filter(item => item.type === 'd')
        .slice(0, 5) // Limit to 5 cruise lines
        .map(item => item.name);
      
      console.log(`   Found ${lineIds.filter(i => i.type === 'd').length} cruise lines, processing first 5`);
      
      for (const lineId of linesToProcess) {
        const linePath = `${monthPath}/${lineId}`;
        const ships = await traveltekFTPService.listFiles(linePath);
        
        // Only process first few ships
        const shipsToProcess = ships
          .filter(item => item.type === 'd')
          .slice(0, 2) // Limit to 2 ships per line
          .map(item => item.name);
        
        for (const shipId of shipsToProcess) {
          const shipPath = `${linePath}/${shipId}`;
          const files = await traveltekFTPService.listFiles(shipPath);
          
          // Get JSON files
          const jsonFiles = files
            .filter(f => f.type === '-' && f.name.endsWith('.json'))
            .slice(0, 2); // Limit to 2 files per ship
          
          for (const file of jsonFiles) {
            allFiles.push({
              year: currentYear,
              month: currentMonth,
              lineid: lineId,
              shipid: shipId,
              codetocruiseid: file.name.replace('.json', ''),
              filePath: `${shipPath}/${file.name}`,
              size: file.size,
              lastModified: file.date
            });
          }
        }
      }
      
      console.log(`   Collected ${allFiles.length} files from current month`);
      
    } catch (error) {
      console.error(`   Error processing ${currentYear}/${currentMonth}: ${error.message}`);
    }
    
    // Process next month (lighter scan)
    if (nextMonth !== currentMonth) {
      console.log(`\n🔍 Discovering files for ${nextYear}/${nextMonth}...`);
      try {
        const monthPath = `${nextYear}/${nextMonth}`;
        const lineIds = await traveltekFTPService.listFiles(monthPath);
        
        // Even more limited for next month
        const linesToProcess = lineIds
          .filter(item => item.type === 'd')
          .slice(0, 2) // Only 2 cruise lines
          .map(item => item.name);
        
        console.log(`   Found ${lineIds.filter(i => i.type === 'd').length} cruise lines, processing first 2`);
        
        let nextMonthFiles = 0;
        for (const lineId of linesToProcess) {
          const linePath = `${monthPath}/${lineId}`;
          const ships = await traveltekFTPService.listFiles(linePath);
          
          const shipsToProcess = ships
            .filter(item => item.type === 'd')
            .slice(0, 1) // Only 1 ship per line
            .map(item => item.name);
          
          for (const shipId of shipsToProcess) {
            const shipPath = `${linePath}/${shipId}`;
            const files = await traveltekFTPService.listFiles(shipPath);
            
            const jsonFiles = files
              .filter(f => f.type === '-' && f.name.endsWith('.json'))
              .slice(0, 1); // Only 1 file per ship
            
            for (const file of jsonFiles) {
              allFiles.push({
                year: nextYear,
                month: nextMonth,
                lineid: lineId,
                shipid: shipId,
                codetocruiseid: file.name.replace('.json', ''),
                filePath: `${shipPath}/${file.name}`,
                size: file.size,
                lastModified: file.date
              });
              nextMonthFiles++;
            }
          }
        }
        
        console.log(`   Collected ${nextMonthFiles} files from next month`);
        
      } catch (error) {
        console.error(`   Error processing ${nextYear}/${nextMonth}: ${error.message}`);
      }
    }
    
    console.log(`\n📊 Total files to sync: ${allFiles.length}\n`);
    
    if (allFiles.length === 0) {
      console.log('⚠️  No files found to sync');
      await traveltekFTPService.disconnect();
      return;
    }
    
    // Download and sync files
    console.log('📥 Downloading and syncing files...\n');
    
    const results = await traveltekFTPService.batchDownloadCruiseData(allFiles, 5);
    console.log(`✅ Downloaded ${results.length} files\n`);
    
    const syncResult = await dataSyncService.batchSyncCruiseData(results);
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 SYNC RESULTS');
    console.log('='.repeat(50));
    console.log(`✅ Successful: ${syncResult.successful}`);
    console.log(`❌ Failed: ${syncResult.failed}`);
    
    if (syncResult.errors.length > 0) {
      console.log('\n❌ Errors:');
      syncResult.errors.slice(0, 5).forEach(err => {
        console.log(`   ${err.file}: ${err.error}`);
      });
    }
    
    // Verify database
    console.log('\n🔍 Verifying database...');
    const { db } = require('../dist/db/connection');
    const { cruises, pricing, cheapestPricing } = require('../dist/db/schema');
    
    const stats = await Promise.all([
      db.select().from(cruises).then(r => r.length),
      db.select().from(pricing).then(r => r.length),
      db.select().from(cheapestPricing).then(r => r.length)
    ]);
    
    console.log('\n📊 Database Status:');
    console.log(`   Total Cruises: ${stats[0]}`);
    console.log(`   Pricing Records: ${stats[1]}`);
    console.log(`   Cheapest Pricing: ${stats[2]}`);
    
    // Disconnect
    await traveltekFTPService.disconnect();
    console.log('\n✅ Sync completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    throw error;
  }
}

// Run the sync
syncRecentOptimized()
  .then(() => {
    console.log('\n✨ Done');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });