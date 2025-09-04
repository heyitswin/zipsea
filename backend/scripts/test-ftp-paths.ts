#!/usr/bin/env ts-node

/**
 * Test script to verify FTP path construction
 * This script tests the fixed FTP path structure: /YYYY/MM/LINEID/SHIPID/CRUISEID.json
 */

import { logger } from '../src/config/logger';
import { bulkFtpDownloader } from '../src/services/bulk-ftp-downloader.service';
import { getWebhookLineId } from '../src/config/cruise-line-mapping';

async function testFtpPathStructure() {
  logger.info('🧪 Testing FTP path structure fixes');
  
  try {
    // Test with a small sample from different cruise lines
    const testLineIds = [3, 15, 22]; // Celebrity, Holland America, Royal Caribbean
    
    for (const lineId of testLineIds) {
      logger.info(`\n🔬 Testing line ${lineId}`);
      
      // Get cruise info for this line (limited to 5 for testing)
      const cruiseInfos = await bulkFtpDownloader.getCruiseInfoForLine(lineId, 5);
      
      if (cruiseInfos.length === 0) {
        logger.warn(`⚠️ No cruises found for line ${lineId}`);
        continue;
      }
      
      const webhookLineId = getWebhookLineId(lineId);
      
      logger.info(`📊 Line ${lineId} test data:`, {
        databaseLineId: lineId,
        webhookLineId,
        cruiseCount: cruiseInfos.length,
        sampleCruises: cruiseInfos.slice(0, 2).map(c => {
          const sailingYear = c.sailingDate.getFullYear();
          const sailingMonth = String(c.sailingDate.getMonth() + 1).padStart(2, '0');
          
          // Show what the new path structure looks like
          const expectedPath = `/${sailingYear}/${sailingMonth}/${webhookLineId}/${c.shipId || 'MISSING_SHIP_ID'}/${c.id}.json`;
          
          return {
            cruiseId: c.id,
            cruiseCode: c.cruiseCode,
            shipId: c.shipId,
            shipName: c.shipName,
            sailingDate: c.sailingDate.toISOString().split('T')[0],
            expectedFtpPath: expectedPath,
            hasShipId: !!c.shipId
          };
        })
      });
      
      // Test bulk download with the fixed path structure
      logger.info(`🚀 Testing bulk download for line ${lineId} with 2 cruises`);
      
      const testCruises = cruiseInfos.slice(0, 2); // Test with just 2 cruises
      const result = await bulkFtpDownloader.downloadLineUpdates(lineId, testCruises);
      
      logger.info(`📈 Line ${lineId} test results:`, {
        totalFiles: result.totalFiles,
        successfulDownloads: result.successfulDownloads,
        failedDownloads: result.failedDownloads,
        successRate: result.totalFiles > 0 ? Math.round((result.successfulDownloads / result.totalFiles) * 100) + '%' : '0%',
        connectionFailures: result.connectionFailures,
        fileNotFoundErrors: result.fileNotFoundErrors,
        parseErrors: result.parseErrors,
        downloadedDataSize: result.downloadedData.size,
        sampleErrors: result.errors.slice(0, 3),
        duration: `${(result.duration / 1000).toFixed(2)}s`
      });
      
      // Show paths that were actually attempted for failed downloads
      if (result.failedDownloads > 0) {
        logger.info(`🔍 Path analysis for line ${lineId}:`, {
          note: 'Check logs above for exact paths attempted per cruise',
          expectedPathStructure: '/YYYY/MM/LINEID/SHIPID/CRUISEID.json',
          commonIssues: [
            'Missing shipId in database',
            'Wrong webhook line ID mapping',
            'Incorrect sailing date year/month',
            'Files not present in FTP server'
          ]
        });
      }
      
      // Small delay between lines
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    logger.info('✅ FTP path structure test completed');
    
  } catch (error) {
    logger.error('❌ FTP path structure test failed:', error);
  }
}

// Run the test
testFtpPathStructure()
  .then(() => {
    logger.info('🏁 Test script finished');
    process.exit(0);
  })
  .catch(error => {
    logger.error('💥 Test script crashed:', error);
    process.exit(1);
  });