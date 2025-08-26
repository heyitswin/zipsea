#!/usr/bin/env node

/**
 * Debug script to test FTP and batch sync
 */

require('dotenv').config();

async function debugSync() {
  console.log('=== FTP SYNC DEBUG ===\n');
  
  // Check environment variables
  console.log('1. Environment Variables:');
  console.log('   FTP_HOST:', process.env.TRAVELTEK_FTP_HOST ? '✅ SET' : '❌ NOT SET');
  console.log('   FTP_USER:', process.env.TRAVELTEK_FTP_USER ? '✅ SET' : '❌ NOT SET');
  console.log('   FTP_PASSWORD:', process.env.TRAVELTEK_FTP_PASSWORD ? '✅ SET' : '❌ NOT SET');
  console.log('   DATABASE_URL:', process.env.DATABASE_URL ? '✅ SET' : '❌ NOT SET');
  console.log('   REDIS_URL:', process.env.REDIS_URL ? '✅ SET' : '❌ NOT SET');
  console.log('   SLACK_WEBHOOK_URL:', process.env.SLACK_WEBHOOK_URL ? '✅ SET' : '❌ NOT SET');
  console.log('');
  
  // Test FTP connection
  console.log('2. Testing FTP Connection:');
  const ftp = require('basic-ftp');
  const client = new ftp.Client();
  
  try {
    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST,
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false
    });
    console.log('   ✅ FTP connection successful!');
    
    // List root directory
    const list = await client.list('/');
    console.log(`   Found ${list.length} items in root directory`);
    console.log('   Root contents:');
    list.forEach(item => {
      console.log(`     ${item.type === 2 ? '[DIR]' : '[FILE]'} ${item.name}`);
    });
    
    // Check for isell_json directory - it might be without leading slash
    try {
      const isellList = await client.list('isell_json');
      console.log(`   Found ${isellList.length} items in isell_json`);
      
      // Show subdirectories
      const dirs = isellList.filter(item => item.type === 2).slice(0, 5);
      console.log('   Year directories in isell_json:');
      dirs.forEach(dir => console.log(`     - ${dir.name}`));
    } catch (err) {
      console.log('   Note: isell_json path might be different:', err.message);
    }
    
    client.close();
  } catch (error) {
    console.log('   ❌ FTP connection failed:', error.message);
  }
  console.log('');
  
  // Check database for pending syncs
  console.log('3. Checking Database:');
  try {
    const { db } = require('../dist/db/connection');
    const { sql } = require('drizzle-orm');
    
    const pendingResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT cruise_line_id) as lines,
        MIN(price_update_requested_at) as oldest,
        MAX(price_update_requested_at) as newest
      FROM cruises 
      WHERE needs_price_update = true
    `);
    
    if (pendingResult && pendingResult.rows && pendingResult.rows.length > 0) {
      const row = pendingResult.rows[0];
      console.log(`   Pending cruises: ${row.total}`);
      console.log(`   Unique lines: ${row.lines}`);
      console.log(`   Oldest request: ${row.oldest || 'N/A'}`);
      console.log(`   Newest request: ${row.newest || 'N/A'}`);
    } else {
      console.log('   No pending cruises found');
    }
    
    // Get sample cruise IDs
    const sampleCruises = await db.execute(sql`
      SELECT cruise_id, cruise_line_id, ship_id, sailing_date
      FROM cruises 
      WHERE needs_price_update = true
      LIMIT 3
    `);
    
    if (sampleCruises && sampleCruises.rows && sampleCruises.rows.length > 0) {
      console.log('\n   Sample pending cruises:');
      sampleCruises.rows.forEach(c => {
        console.log(`   - ${c.cruise_id} (Line: ${c.cruise_line_id}, Ship: ${c.ship_id})`);
      });
    }
    
  } catch (error) {
    console.log('   ❌ Database query failed:', error.message);
  }
  console.log('');
  
  // Test file search
  console.log('4. Testing File Search:');
  try {
    const { ftpFileSearchService } = require('../dist/services/ftp-file-search.service');
    
    // Get a sample cruise from DB
    const { db } = require('../dist/db/connection');
    const { sql } = require('drizzle-orm');
    
    const sampleCruise = await db.execute(sql`
      SELECT cruise_id, cruise_line_id, ship_id
      FROM cruises 
      WHERE needs_price_update = true
      LIMIT 1
    `);
    
    if (sampleCruise && sampleCruise.rows && sampleCruise.rows.length > 0) {
      const cruise = sampleCruise.rows[0];
      console.log(`   Searching for cruise ${cruise.cruise_id}...`);
      
      const path = await ftpFileSearchService.findCruiseFile(
        cruise.cruise_id,
        cruise.cruise_line_id,
        cruise.ship_id
      );
      
      if (path) {
        console.log(`   ✅ Found at: ${path}`);
      } else {
        console.log(`   ❌ File not found`);
      }
    }
  } catch (error) {
    console.log('   ❌ File search failed:', error.message);
  }
  
  console.log('\n=== END DEBUG ===');
  process.exit(0);
}

debugSync().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});