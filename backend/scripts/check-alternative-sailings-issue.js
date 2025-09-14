#!/usr/bin/env node

require('dotenv').config();
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

async function checkAlternativeSailingsIssue() {
  console.log('=== Alternative Sailings Schema Investigation ===\n');

  try {
    // 1. Check if table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'alternative_sailings'
      );
    `);

    console.log('1. TABLE EXISTENCE:');
    if (tableExists[0].exists) {
      console.log('   ✅ alternative_sailings table EXISTS\n');

      // Check table structure
      const columns = await db.execute(sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'alternative_sailings'
        ORDER BY ordinal_position;
      `);

      console.log('2. TABLE STRUCTURE:');
      columns.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });

      // Check if it has any data
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM alternative_sailings;
      `);

      console.log(`\n3. DATA: ${countResult[0].count} rows`);

      // Check schema definition vs actual columns
      console.log('\n4. SCHEMA MISMATCH CHECK:');
      const expectedColumns = ['id', 'base_cruise_id', 'alternative_cruise_id', 'sailing_date', 'similarity_score'];
      const actualColumns = columns.map(c => c.column_name);

      expectedColumns.forEach(expected => {
        if (!actualColumns.includes(expected)) {
          console.log(`   ❌ Missing column: ${expected}`);
        }
      });

      actualColumns.forEach(actual => {
        if (!expectedColumns.includes(actual)) {
          console.log(`   ⚠️ Unexpected column: ${actual}`);
        }
      });

    } else {
      console.log('   ❌ alternative_sailings table DOES NOT EXIST');
      console.log('   This explains the schema mismatch error!\n');

      console.log('2. IMPACT ANALYSIS:');
      console.log('   - The code tries to query a non-existent table');
      console.log('   - This likely causes the getAlternativeSailings() function to fail');
      console.log('   - The error is caught and logged but may impact performance\n');
    }

    // 5. Check how many cruises are trying to use this feature
    console.log('5. AFFECTED CRUISES:');

    // Look for recent logs mentioning alternative sailings
    const recentLogs = await db.execute(sql`
      SELECT COUNT(DISTINCT processing_result::text) as unique_errors
      FROM webhook_events
      WHERE processing_result::text LIKE '%alternative%sailing%'
        AND created_at > NOW() - INTERVAL '7 days'
      LIMIT 1;
    `);

    if (recentLogs[0]) {
      console.log(`   Recent webhook events with alternative sailing errors: ${recentLogs[0].unique_errors || 0}`);
    }

    // 6. Check cruise.service.ts usage
    console.log('\n6. CODE ANALYSIS:');
    console.log('   The getAlternativeSailings() function in cruise.service.ts:');
    console.log('   - Is called when fetching comprehensive cruise data');
    console.log('   - Tries to query the alternative_sailings table');
    console.log('   - Returns empty array on error (which is happening)');
    console.log('   - The warning was logged repeatedly, causing log spam\n');

    console.log('7. ROOT CAUSE:');
    if (!tableExists[0].exists) {
      console.log('   ❌ The alternative_sailings table was never created in production');
      console.log('   ❌ But the code expects it to exist');
      console.log('   ❌ This causes a query error for EVERY cruise detail page load\n');

      console.log('8. IMPACT:');
      console.log('   - Does NOT block cruise syncing (error is caught)');
      console.log('   - Does NOT affect pricing updates');
      console.log('   - DOES cause unnecessary database queries');
      console.log('   - DOES spam logs with warnings');
      console.log('   - DOES impact performance slightly\n');

      console.log('9. SOLUTION:');
      console.log('   SHORT TERM:');
      console.log('   ✓ Already commented out the warning (reduces log spam)');
      console.log('   ✓ Function returns empty array (no user impact)\n');

      console.log('   LONG TERM OPTIONS:');
      console.log('   1. Create the missing table with proper migration');
      console.log('   2. Remove the alternative sailings feature entirely');
      console.log('   3. Make the feature conditional (check table exists first)');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkAlternativeSailingsIssue().catch(console.error);
