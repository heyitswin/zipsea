#!/usr/bin/env tsx

import { bulkFtpDownloader } from '../src/services/bulk-ftp-downloader.service';
import { logger } from '../src/config/logger';

async function diagnoseFtpBulkIssues() {
  try {
    console.log('🔍 Diagnosing FTP bulk processing issues...\n');
    
    const testLines = [
      { id: 22, name: 'Royal Caribbean' },
      { id: 63, name: 'AmaWaterways' }
    ];
    
    for (const line of testLines) {
      console.log(`\n📊 Testing ${line.name} (Line ID ${line.id})`);
      console.log('='.repeat(60));
      
      // Step 1: Get cruise info from database
      console.log(`\n1️⃣ Getting cruise info for ${line.name}...`);
      let cruiseInfos;
      try {
        cruiseInfos = await bulkFtpDownloader.getCruiseInfoForLine(line.id, 10); // Limit to 10 for testing
        console.log(`✅ Found ${cruiseInfos.length} cruises for ${line.name}`);
        
        if (cruiseInfos.length > 0) {
          console.log('📋 Sample cruises:');
          cruiseInfos.slice(0, 5).forEach((cruise, i) => {
            console.log(`   ${i+1}. ${cruise.id} - ${cruise.shipName} (Ship ID: ${cruise.shipId}) - ${cruise.sailingDate.toISOString().split('T')[0]}`);
          });
        } else {
          console.log('❌ No cruises found - this explains 0% success rate!');
          continue;
        }
      } catch (error) {
        console.error(`❌ Database query failed for ${line.name}:`, error instanceof Error ? error.message : error);
        continue;
      }
      
      // Step 2: Test FTP download with limited cruises
      console.log(`\n2️⃣ Testing bulk FTP download for ${line.name}...`);
      
      const startTime = Date.now();
      try {
        const result = await bulkFtpDownloader.downloadLineUpdates(line.id, cruiseInfos.slice(0, 3)); // Just test 3 cruises
        const duration = Date.now() - startTime;
        
        console.log(`📥 Download completed in ${(duration / 1000).toFixed(2)}s`);
        console.log(`📊 Results:`);
        console.log(`   - Total files: ${result.totalFiles}`);
        console.log(`   - Successful downloads: ${result.successfulDownloads}`);
        console.log(`   - Failed downloads: ${result.failedDownloads}`);
        console.log(`   - Connection failures: ${result.connectionFailures}`);
        console.log(`   - File not found errors: ${result.fileNotFoundErrors}`);
        console.log(`   - Parse errors: ${result.parseErrors}`);
        console.log(`   - Downloaded data size: ${result.downloadedData.size}`);
        console.log(`   - Success rate: ${Math.round((result.successfulDownloads / result.totalFiles) * 100)}%`);
        
        if (result.errors.length > 0) {
          console.log(`🚨 Errors (first 5):`);
          result.errors.slice(0, 5).forEach((error, i) => {
            console.log(`   ${i+1}. ${error}`);
          });
        }
        
        if (result.downloadedData.size > 0) {
          console.log(`📋 Downloaded data samples:`);
          let count = 0;
          for (const [cruiseId, data] of result.downloadedData) {
            if (count >= 2) break;
            console.log(`   - ${cruiseId}: ${Object.keys(data).slice(0, 3).join(', ')}...`);
            count++;
          }
        } else {
          console.log('❌ No data was downloaded - this is the core issue!');
        }
        
      } catch (error) {
        console.error(`❌ Bulk download failed for ${line.name}:`, error instanceof Error ? error.message : error);
      }
    }
    
    // Step 3: Show FTP connection stats
    console.log(`\n3️⃣ FTP Service Stats:`);
    console.log('='.repeat(40));
    const stats = bulkFtpDownloader.getStats();
    console.log(`📊 Connection pool size: ${stats.connectionPoolSize}/${stats.maxConnections}`);
    console.log(`🔄 Circuit breaker open: ${stats.circuitBreakerState.isOpen}`);
    console.log(`⚠️  Circuit breaker failures: ${stats.circuitBreakerState.failureCount}`);
    console.log(`⏰ Last failure: ${stats.circuitBreakerState.lastFailureTime}`);
    console.log(`📦 Chunk size: ${stats.chunkSize}`);
    
  } catch (error) {
    logger.error('💥 Diagnosis failed:', error);
  } finally {
    process.exit(0);
  }
}

diagnoseFtpBulkIssues();