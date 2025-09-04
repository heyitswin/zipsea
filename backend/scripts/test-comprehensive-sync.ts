#!/usr/bin/env ts-node

import { ftpComprehensiveSyncService } from '../src/services/ftp-comprehensive-sync.service';
import { logger } from '../src/config/logger';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Test comprehensive FTP sync for a cruise line
 */
async function testComprehensiveSync() {
  // Test with line 21 (Royal Caribbean) which just had a webhook
  const lineId = parseInt(process.argv[2] || '21');
  
  logger.info(`🧪 Testing comprehensive FTP sync for cruise line ${lineId}`);
  logger.info('This will download ALL cruise data for the next 2 years');
  logger.info('Press Ctrl+C to cancel...\n');
  
  // Wait 3 seconds to allow cancellation
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    const result = await ftpComprehensiveSyncService.syncCruiseLine(lineId);
    
    console.log('\n📊 Sync Results:');
    console.log('================');
    console.log(`Line ID: ${result.lineId}`);
    console.log(`Files Found: ${result.filesFound}`);
    console.log(`Files Processed: ${result.filesProcessed}`);
    console.log(`Cruises Created: ${result.cruisesCreated}`);
    console.log(`Cruises Updated: ${result.cruisesUpdated}`);
    console.log(`Prices Updated: ${result.pricesUpdated}`);
    console.log(`Errors: ${result.errors}`);
    console.log(`Duration: ${Math.round(result.duration / 1000)} seconds`);
    console.log(`Months Processed: ${result.monthsProcessed.join(', ')}`);
    
    if (result.errors > 0) {
      console.log('\n⚠️ There were some errors during sync. Check logs for details.');
    } else {
      console.log('\n✅ Sync completed successfully!');
    }
    
  } catch (error) {
    logger.error('❌ Sync failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

testComprehensiveSync().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});