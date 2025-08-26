#!/usr/bin/env node

/**
 * Test script to manually trigger batch sync and see results
 */

require('dotenv').config();

async function testBatchSync() {
  console.log('Testing batch price sync...\n');
  
  try {
    // Import after dotenv loads
    const { priceSyncBatchService } = require('../dist/services/price-sync-batch.service');
    
    console.log('Starting sync of pending price updates...');
    const startTime = Date.now();
    
    const result = await priceSyncBatchService.syncPendingPriceUpdates();
    
    const duration = Date.now() - startTime;
    
    console.log('\n' + '='.repeat(50));
    console.log('SYNC RESULTS');
    console.log('='.repeat(50));
    console.log(`Created: ${result.created}`);
    console.log(`Updated: ${result.updated}`);
    console.log(`Failed: ${result.failed}`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    
    if (result.errors.length > 0) {
      console.log('\nFailed cruise IDs (first 10):');
      result.errors.slice(0, 10).forEach(id => console.log(`  - ${id}`));
      
      if (result.errors.length > 10) {
        console.log(`  ... and ${result.errors.length - 10} more`);
      }
    }
    
    // Check database for remaining pending cruises
    const { db } = require('../dist/db/connection');
    const { sql } = require('drizzle-orm');
    
    const pendingResult = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM cruises 
      WHERE needs_price_update = true
    `);
    
    console.log(`\nRemaining pending cruises: ${pendingResult.rows[0].count}`);
    
    process.exit(result.failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testBatchSync();