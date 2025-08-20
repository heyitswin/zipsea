#!/usr/bin/env node

/**
 * Test database insert to debug SQL syntax error
 */

require('dotenv').config();

console.log('🔍 Database Insert Test');
console.log('========================\n');

async function testDatabaseInsert() {
  try {
    const { db } = require('../dist/db/connection');
    const { cruiseLines, ships, cruises } = require('../dist/db/schema');
    const { sql } = require('drizzle-orm');
    
    console.log('📋 Testing database operations...\n');
    
    // Test 1: Simple select
    console.log('Test 1: Simple SELECT');
    try {
      const result = await db.select().from(cruiseLines).limit(1);
      console.log(`✅ SELECT works. Found ${result.length} cruise lines\n`);
    } catch (error) {
      console.error(`❌ SELECT failed: ${error.message}\n`);
    }
    
    // Test 2: Insert cruise line
    console.log('Test 2: Insert Cruise Line');
    try {
      const testCruiseLine = {
        id: 99999,
        name: 'Test Cruise Line',
        code: 'TCL',
        description: 'Test description',
        isActive: true
      };
      
      // Try with raw SQL first
      await db.execute(sql`
        INSERT INTO cruise_lines (id, name, code, description, is_active)
        VALUES (${testCruiseLine.id}, ${testCruiseLine.name}, ${testCruiseLine.code}, ${testCruiseLine.description}, ${testCruiseLine.isActive})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          updated_at = NOW()
      `);
      
      console.log('✅ Raw SQL insert works\n');
      
      // Clean up
      await db.execute(sql`DELETE FROM cruise_lines WHERE id = ${testCruiseLine.id}`);
      
    } catch (error) {
      console.error(`❌ Insert failed: ${error.message}`);
      console.error(`   Full error: ${error.stack}\n`);
    }
    
    // Test 3: Try Drizzle insert syntax
    console.log('Test 3: Drizzle ORM Insert');
    try {
      const testCruiseLine = {
        id: 99999,
        name: 'Test Cruise Line 2',
        code: 'TCL2',
        description: 'Test description 2',
        isActive: true
      };
      
      // Try regular insert first
      await db.insert(cruiseLines).values(testCruiseLine);
      console.log('✅ Basic insert works');
      
      // Try upsert
      await db.insert(cruiseLines).values({
        ...testCruiseLine,
        name: 'Updated Test Cruise Line'
      }).onConflictDoUpdate({
        target: cruiseLines.id,
        set: {
          name: 'Updated Test Cruise Line',
          updatedAt: new Date()
        }
      });
      console.log('✅ Upsert works\n');
      
      // Clean up
      await db.execute(sql`DELETE FROM cruise_lines WHERE id = ${testCruiseLine.id}`);
      
    } catch (error) {
      console.error(`❌ Drizzle insert failed: ${error.message}`);
      console.error(`   Stack: ${error.stack}\n`);
      
      // Try to clean up anyway
      try {
        await db.execute(sql`DELETE FROM cruise_lines WHERE id = 99999`);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
    
    // Test 4: Test transaction
    console.log('Test 4: Transaction Test');
    try {
      await db.transaction(async (tx) => {
        // Insert cruise line
        await tx.insert(cruiseLines).values({
          id: 88888,
          name: 'Transaction Test Line',
          code: 'TTL',
          description: 'Testing transactions',
          isActive: true
        });
        
        // Insert ship
        await tx.insert(ships).values({
          id: 88888,
          cruiseLineId: 88888,
          name: 'Transaction Test Ship',
          code: 'TTS',
          isActive: true
        });
        
        console.log('✅ Transaction operations work');
        
        // Rollback by throwing
        throw new Error('Intentional rollback');
      });
    } catch (error) {
      if (error.message === 'Intentional rollback') {
        console.log('✅ Transaction rollback works\n');
      } else {
        console.error(`❌ Transaction failed: ${error.message}\n`);
      }
    }
    
    // Test 5: Check if the issue is with the date fields
    console.log('Test 5: Date Field Test');
    try {
      const testDate = '2025-12-03';
      const testCruise = {
        id: 77777,
        codeToCruiseId: 'TEST77777',
        cruiseLineId: 1,
        shipId: 180,
        name: 'Test Cruise',
        sailingDate: testDate,
        returnDate: '2025-12-17',
        nights: 14,
        showCruise: true,
        isActive: true,
        currency: 'USD'
      };
      
      // First ensure cruise line and ship exist
      await db.insert(cruiseLines).values({
        id: 1,
        name: 'Test Line for Cruise',
        code: 'TL1',
        isActive: true
      }).onConflictDoNothing();
      
      await db.insert(ships).values({
        id: 180,
        cruiseLineId: 1,
        name: 'Test Ship for Cruise',
        code: 'TS180',
        isActive: true
      }).onConflictDoNothing();
      
      // Now try cruise insert
      await db.insert(cruises).values(testCruise);
      console.log('✅ Cruise insert with dates works');
      
      // Clean up
      await db.execute(sql`DELETE FROM cruises WHERE id = ${testCruise.id}`);
      
    } catch (error) {
      console.error(`❌ Date field test failed: ${error.message}`);
      console.error(`   Stack: ${error.stack}\n`);
    }
    
    console.log('\n📊 Test Summary:');
    console.log('If all tests passed, the database is working correctly.');
    console.log('If some failed, check the error messages above.');
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Run the test
testDatabaseInsert()
  .then(() => {
    console.log('\n✨ Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });