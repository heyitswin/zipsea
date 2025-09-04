#!/usr/bin/env ts-node

/**
 * Test the improved bulk FTP downloader with detailed logging
 * This script tests the fixes for the 0% success rate issue
 */

import { bulkFtpDownloader } from '../src/services/bulk-ftp-downloader.service';
import { logger } from '../src/config/logger';
import { env } from '../src/config/environment';

// Test configuration
const TEST_LINES = [
  { id: 22, name: 'Royal Caribbean', expectedCruises: 500 },
  { id: 48, name: 'Oceania Cruises', expectedCruises: 400 },
  { id: 3, name: 'Celebrity Cruises', expectedCruises: 300 },
];

async function testBulkFtpDownloader() {
  console.log('🚀 Testing Improved Bulk FTP Downloader');
  console.log('=====================================');
  console.log('');
  
  // Check environment first
  console.log('📋 Environment Check:');
  console.log(`NODE_ENV: ${env.NODE_ENV}`);
  console.log(`FTP Host: ${env.TRAVELTEK_FTP_HOST ? env.TRAVELTEK_FTP_HOST.substring(0, 10) + '***' : 'MISSING'}`);
  console.log(`FTP User: ${env.TRAVELTEK_FTP_USER ? env.TRAVELTEK_FTP_USER.substring(0, 3) + '***' : 'MISSING'}`);
  console.log(`FTP Pass: ${env.TRAVELTEK_FTP_PASSWORD ? '***' : 'MISSING'}`);
  console.log('');

  if (!env.TRAVELTEK_FTP_HOST || !env.TRAVELTEK_FTP_USER || !env.TRAVELTEK_FTP_PASSWORD) {
    console.log('❌ CRITICAL: FTP credentials are missing!');
    console.log('   This explains the 0% success rate in production.');
    console.log('   Add these environment variables to Render:');
    console.log('   - TRAVELTEK_FTP_HOST');
    console.log('   - TRAVELTEK_FTP_USER');
    console.log('   - TRAVELTEK_FTP_PASSWORD');
    console.log('');
    return;
  }

  console.log('✅ FTP credentials are present');
  console.log('');

  // Test each cruise line
  for (const testLine of TEST_LINES) {
    console.log(`🚢 Testing ${testLine.name} (Line ${testLine.id})`);
    console.log('─'.repeat(60));
    
    try {
      // Step 1: Get cruise information
      console.log('📊 Step 1: Getting cruise information...');
      const startTime = Date.now();
      
      const cruiseInfos = await bulkFtpDownloader.getCruiseInfoForLine(testLine.id, 10); // Test with just 10 cruises
      const cruiseInfoTime = Date.now() - startTime;
      
      console.log(`✅ Found ${cruiseInfos.length} cruises in ${cruiseInfoTime}ms`);
      
      if (cruiseInfos.length === 0) {
        console.log(`⚠️  No active cruises found for ${testLine.name}`);
        console.log('');
        continue;
      }

      // Show sample cruise data
      console.log('📋 Sample cruises:');
      cruiseInfos.slice(0, 3).forEach((cruise, index) => {
        console.log(`   ${index + 1}. ${cruise.id} - ${cruise.shipName} (Ship ID: ${cruise.shipId || 'N/A'})`);
        console.log(`      Sailing: ${cruise.sailingDate.toISOString().split('T')[0]}`);
      });
      console.log('');

      // Step 2: Test bulk download
      console.log('📦 Step 2: Testing bulk download...');
      const downloadStartTime = Date.now();
      
      const downloadResult = await bulkFtpDownloader.downloadLineUpdates(testLine.id, cruiseInfos);
      const downloadTime = Date.now() - downloadStartTime;
      
      console.log(`✅ Bulk download completed in ${downloadTime}ms`);
      console.log('');

      // Show detailed results
      console.log('📊 Download Results:');
      console.log(`   Total Files: ${downloadResult.totalFiles}`);
      console.log(`   Successful: ${downloadResult.successfulDownloads}`);
      console.log(`   Failed: ${downloadResult.failedDownloads}`);
      console.log(`   Success Rate: ${Math.round((downloadResult.successfulDownloads / downloadResult.totalFiles) * 100)}%`);
      console.log(`   Connection Failures: ${downloadResult.connectionFailures}`);
      console.log(`   File Not Found: ${downloadResult.fileNotFoundErrors}`);
      console.log(`   Parse Errors: ${downloadResult.parseErrors}`);
      console.log(`   Downloaded Data Size: ${downloadResult.downloadedData.size}`);
      console.log('');

      if (downloadResult.errors.length > 0) {
        console.log('⚠️  Error Summary:');
        const errorTypes = new Set(downloadResult.errors.map(e => {
          if (e.includes('connection') || e.includes('timeout')) return 'Connection Issues';
          if (e.includes('not found') || e.includes('404')) return 'File Not Found';
          if (e.includes('JSON') || e.includes('parse')) return 'Parse Errors';
          return 'Other Errors';
        }));
        
        errorTypes.forEach(errorType => {
          const count = downloadResult.errors.filter(e => {
            if (errorType === 'Connection Issues') return e.includes('connection') || e.includes('timeout');
            if (errorType === 'File Not Found') return e.includes('not found') || e.includes('404');
            if (errorType === 'Parse Errors') return e.includes('JSON') || e.includes('parse');
            return true;
          }).length;
          console.log(`   ${errorType}: ${count}`);
        });
        
        console.log('');
        console.log('📝 Sample Errors:');
        downloadResult.errors.slice(0, 5).forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`);
        });
        console.log('');
      }

      // Step 3: Test database processing
      if (downloadResult.downloadedData.size > 0) {
        console.log('💾 Step 3: Testing database processing...');
        const processStartTime = Date.now();
        
        const processResult = await bulkFtpDownloader.processCruiseUpdates(testLine.id, downloadResult);
        const processTime = Date.now() - processStartTime;
        
        console.log(`✅ Database processing completed in ${processTime}ms`);
        console.log('');
        
        console.log('📊 Processing Results:');
        console.log(`   Database Updates: ${processResult.actuallyUpdated}`);
        console.log(`   Processing Successful: ${processResult.successful}`);
        console.log(`   Processing Failed: ${processResult.failed}`);
        console.log(`   Processing Errors: ${processResult.errors.length}`);
        console.log('');
        
        if (processResult.errors.length > 0) {
          console.log('📝 Processing Error Sample:');
          processResult.errors.slice(0, 3).forEach((error, index) => {
            console.log(`   ${index + 1}. ${error}`);
          });
          console.log('');
        }
      }

      // Overall assessment
      const overallSuccessRate = Math.round((downloadResult.successfulDownloads / downloadResult.totalFiles) * 100);
      
      if (overallSuccessRate >= 80) {
        console.log('🟢 ASSESSMENT: EXCELLENT - Bulk FTP downloader is working correctly');
      } else if (overallSuccessRate >= 50) {
        console.log('🟡 ASSESSMENT: GOOD - Some issues but generally working');
      } else if (overallSuccessRate > 0) {
        console.log('🟠 ASSESSMENT: POOR - Significant issues detected');
      } else {
        console.log('🔴 ASSESSMENT: FAILED - Complete failure, likely FTP connection issues');
      }
      
      console.log('');
      
    } catch (error) {
      console.error(`❌ Test failed for ${testLine.name}:`, error instanceof Error ? error.message : 'Unknown error');
      console.log('');
    }
  }

  // Show service statistics
  console.log('📊 Service Statistics:');
  console.log('─'.repeat(40));
  const stats = bulkFtpDownloader.getStats();
  console.log(`Connection Pool: ${stats.connectionPoolSize}/${stats.maxConnections}`);
  console.log(`Circuit Breaker Open: ${stats.circuitBreakerState.isOpen}`);
  console.log(`Failure Count: ${stats.circuitBreakerState.failureCount}`);
  console.log(`Last Failure: ${stats.circuitBreakerState.lastFailureTime || 'Never'}`);
  console.log(`Chunk Size: ${stats.chunkSize}`);
  console.log('');

  console.log('🎯 TEST COMPLETE');
  console.log('================');
  console.log('Next steps:');
  console.log('1. If success rates are good (>80%), deploy to production');
  console.log('2. If success rates are poor, investigate FTP path/credentials');
  console.log('3. Monitor production webhook processing for improvements');
}

// Run the test
testBulkFtpDownloader()
  .then(() => {
    console.log('✨ Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });