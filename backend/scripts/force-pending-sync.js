#!/usr/bin/env node

/**
 * Force set cruises to pending sync status
 */

require('dotenv').config();

async function forcePendingSync() {
  const { db } = require('../dist/db/connection');
  const { sql } = require('drizzle-orm');
  
  console.log('Checking database status...\n');
  
  try {
    // First, check what cruise lines we actually have
    const { cruises } = require('../dist/db/schema');
    const linesResult = await db
      .select({
        cruise_line_id: cruises.cruiseLineId,
        count: sql<number>`COUNT(*)::int`
      })
      .from(cruises)
      .groupBy(cruises.cruiseLineId)
      .orderBy(cruises.cruiseLineId)
      .limit(20);
    
    if (!linesResult || linesResult.length === 0) {
      console.log('❌ No cruises found in database!');
      console.log('Trying raw SQL query...');
      
      // Try raw SQL as fallback
      const rawResult = await db.execute(sql`SELECT COUNT(*) as count FROM cruises`);
      console.log('Raw query result:', rawResult);
      
      if (rawResult?.rows?.[0]?.count > 0) {
        console.log(`Found ${rawResult.rows[0].count} cruises via raw SQL`);
      }
      return;
    }
    
    console.log('Cruise lines in database:');
    linesResult.forEach(row => {
      console.log(`  Line ${row.cruise_line_id}: ${row.count} cruises`);
    });
    
    // Get first 100 cruises from any line and mark them for sync
    console.log('\nMarking first 100 cruises as pending sync for testing...');
    
    const updateResult = await db.execute(sql`
      UPDATE cruises
      SET 
        needs_price_update = true,
        price_update_requested_at = CURRENT_TIMESTAMP
      WHERE id IN (
        SELECT id FROM cruises 
        ORDER BY id 
        LIMIT 100
      )
    `);
    
    console.log(`✅ Marked ${updateResult?.rowCount || 0} cruises for sync`);
    
    // Show what's pending now
    const pendingResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT cruise_line_id) as lines
      FROM cruises
      WHERE needs_price_update = true
    `);
    
    if (pendingResult?.rows?.[0]) {
      console.log(`\nTotal pending: ${pendingResult.rows[0].total} cruises from ${pendingResult.rows[0].lines} lines`);
    }
    
    // Show sample pending cruises
    const sampleResult = await db.execute(sql`
      SELECT 
        cruise_id,
        cruise_line_id,
        ship_id,
        sailing_date
      FROM cruises
      WHERE needs_price_update = true
      LIMIT 5
    `);
    
    if (sampleResult?.rows && sampleResult.rows.length > 0) {
      console.log('\nSample pending cruises:');
      sampleResult.rows.forEach(cruise => {
        console.log(`  - ${cruise.cruise_id} (Line: ${cruise.cruise_line_id}, Ship: ${cruise.ship_id || 'N/A'}, Sailing: ${cruise.sailing_date || 'N/A'})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

forcePendingSync();