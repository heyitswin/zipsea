#!/usr/bin/env node

/**
 * Test database connection and query structure
 */

require('dotenv').config();
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

console.log('🔍 Testing Database Connection and Queries');
console.log('==========================================\n');

async function testDatabase() {
  try {
    // 1. Test basic SELECT
    console.log('1️⃣ Testing basic SELECT:');
    try {
      const result = await db.execute(sql`SELECT 1 as test`);
      console.log('   Result structure:', Object.keys(result));
      console.log('   Result:', JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('   ❌ Failed:', e.message);
    }
    
    // 2. Test COUNT query
    console.log('\n2️⃣ Testing COUNT query:');
    try {
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM cruises`);
      console.log('   Result structure:', Object.keys(result));
      console.log('   Result:', JSON.stringify(result, null, 2));
      console.log('   Accessing count:', result.rows?.[0]?.count || 'undefined');
    } catch (e) {
      console.log('   ❌ Failed:', e.message);
    }
    
    // 3. Test SELECT with WHERE
    console.log('\n3️⃣ Testing SELECT with WHERE:');
    try {
      const testId = 12345;
      const result = await db.execute(sql`SELECT id FROM cruises WHERE id = ${testId} LIMIT 1`);
      console.log('   Result structure:', Object.keys(result));
      console.log('   Result:', JSON.stringify(result, null, 2));
      console.log('   Is empty?:', (!result.rows || result.rows.length === 0));
    } catch (e) {
      console.log('   ❌ Failed:', e.message);
    }
    
    // 4. Test INSERT (without actually inserting)
    console.log('\n4️⃣ Testing INSERT structure:');
    try {
      // First create a test cruise line
      await db.execute(sql`
        INSERT INTO cruise_lines (id, name, code, is_active)
        VALUES (99999, 'Test Line', 'TEST', true)
        ON CONFLICT (id) DO NOTHING
      `);
      console.log('   ✅ Cruise line insert works');
      
      // Clean up
      await db.execute(sql`DELETE FROM cruise_lines WHERE id = 99999`);
      console.log('   ✅ Cleanup successful');
    } catch (e) {
      console.log('   ❌ Failed:', e.message);
    }
    
    // 5. Check what the sync script might be seeing
    console.log('\n5️⃣ Simulating sync script check:');
    const cruiseId = 2092628; // One from your FTP data
    try {
      const existingResult = await db.execute(sql`
        SELECT id FROM cruises WHERE id = ${cruiseId} LIMIT 1
      `);
      
      console.log('   Raw result:', existingResult);
      console.log('   Has rows property?:', 'rows' in existingResult);
      console.log('   Rows value:', existingResult.rows);
      console.log('   Rows is array?:', Array.isArray(existingResult.rows));
      console.log('   Rows length:', existingResult.rows?.length);
      
      // Test different ways to check existence
      const exists1 = existingResult.rows && existingResult.rows.length > 0;
      const exists2 = existingResult.rows?.length > 0;
      const exists3 = Array.isArray(existingResult.rows) && existingResult.rows.length > 0;
      
      console.log('   Check method 1 (rows && rows.length > 0):', exists1);
      console.log('   Check method 2 (rows?.length > 0):', exists2);
      console.log('   Check method 3 (Array.isArray && length > 0):', exists3);
      
    } catch (e) {
      console.log('   ❌ Query failed:', e.message);
    }
    
    // 6. Check Drizzle ORM version/behavior
    console.log('\n6️⃣ Database client info:');
    console.log('   DB object type:', typeof db);
    console.log('   DB methods:', Object.keys(db).slice(0, 10));
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Run tests
testDatabase()
  .then(() => {
    console.log('\n✨ Tests complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal:', error.message);
    process.exit(1);
  });