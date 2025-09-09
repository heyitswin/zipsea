#!/usr/bin/env node

/**
 * Direct test of comprehensive webhook service
 * This bypasses the HTTP layer to test the service directly
 */

const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testComprehensiveService() {
  console.log('🧪 DIRECT COMPREHENSIVE SERVICE TEST');
  console.log('=====================================\n');

  // Check environment
  console.log('Environment Check:');
  console.log(`  DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
  console.log(`  REDIS_URL: ${process.env.REDIS_URL ? 'SET' : 'NOT SET'}`);
  console.log(`  FTP_USER: ${process.env.TRAVELTEK_FTP_USER ? 'SET' : 'NOT SET'}`);
  console.log(`  FTP_PASSWORD: ${process.env.TRAVELTEK_FTP_PASSWORD ? 'SET' : 'NOT SET'}`);
  console.log();

  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL not set. This test requires database access.');
    console.log('   Run on Render shell or set DATABASE_URL environment variable.');
    return;
  }

  try {
    // Import the service
    console.log('1️⃣ Loading comprehensive webhook service...');
    const { ComprehensiveWebhookService } = require('../src/services/webhook-comprehensive.service');
    const service = new ComprehensiveWebhookService();
    console.log('✅ Service loaded\n');

    // Test with Crystal Cruises (line 21, only 5 cruises)
    const lineId = 21;
    console.log(`2️⃣ Testing with line ${lineId} (Crystal Cruises - ~5 cruises)...`);
    console.log('   This should complete quickly if working properly.\n');

    const startTime = Date.now();

    // Add timeout wrapper
    const timeoutPromise = new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error('Timeout after 30 seconds')), 30000);
    });

    const processPromise = service.processWebhook(lineId);

    try {
      const result = await Promise.race([processPromise, timeoutPromise]);

      const duration = Date.now() - startTime;
      console.log(`✅ Processing completed in ${Math.round(duration / 1000)}s\n`);

      console.log('📊 Results:');
      console.log(`  Line ID: ${result.lineId}`);
      console.log(`  Total Cruises: ${result.totalCruises}`);
      console.log(`  Processed: ${result.processedCruises}`);
      console.log(`  Successful: ${result.successfulUpdates}`);
      console.log(`  Failed: ${result.failedUpdates}`);
      console.log(`  Skipped: ${result.skippedFiles}`);
      console.log(`  Corrupted: ${result.corruptedFiles}`);

      if (result.errors && result.errors.length > 0) {
        console.log('\n⚠️ Errors:');
        result.errors.slice(0, 5).forEach(err => console.log(`  - ${err}`));
      }

      const successRate = result.processedCruises > 0
        ? Math.round((result.successfulUpdates / result.processedCruises) * 100)
        : 0;

      console.log(`\n📈 Success Rate: ${successRate}%`);

      if (successRate > 50) {
        console.log('✅ Webhook processing is working!');
      } else if (result.processedCruises > 0) {
        console.log('⚠️ Webhook processing has issues - low success rate');
      } else {
        console.log('❌ Webhook processing failed - no cruises processed');
      }

    } catch (timeoutError) {
      const duration = Date.now() - startTime;
      console.log(`❌ Processing timed out after ${Math.round(duration / 1000)}s`);
      console.log('   This indicates the service is stuck, likely at:');
      console.log('   - Database query (connection issue)');
      console.log('   - Redis lock acquisition');
      console.log('   - FTP connection initialization');
      console.log('\n   Check Render logs for detailed error messages.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  }

  // Exit after test
  console.log('\n=====================================');
  console.log('Test complete. Exiting...');
  process.exit(0);
}

// Run the test
console.log('Starting test...\n');
testComprehensiveService().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
