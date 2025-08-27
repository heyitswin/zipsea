#!/usr/bin/env node

/**
 * Direct database check for pending cruises
 */

require('dotenv').config();
const { Pool } = require('pg');

async function checkPending() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    console.log('🔍 Direct Database Check for Pending Cruises');
    console.log('=' .repeat(60));
    console.log('');
    
    // Query 1: Same as pending-syncs endpoint
    const pendingSyncs = await pool.query(`
      SELECT 
        COUNT(*) as total_pending,
        COUNT(DISTINCT cruise_line_id) as unique_lines
      FROM cruises 
      WHERE needs_price_update = true
    `);
    
    console.log('📊 Query 1 (pending-syncs style):');
    console.log('Total pending:', pendingSyncs.rows[0].total_pending);
    console.log('Unique lines:', pendingSyncs.rows[0].unique_lines);
    console.log('');
    
    // Query 2: Check line 17 specifically
    const line17 = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE needs_price_update = true) as pending,
        MIN(price_update_requested_at) as oldest,
        MAX(price_update_requested_at) as newest
      FROM cruises 
      WHERE cruise_line_id = 17
        AND sailing_date >= CURRENT_DATE
    `);
    
    console.log('📊 Query 2 (Line 17 - Norwegian):');
    console.log('Total cruises:', line17.rows[0].total);
    console.log('Pending updates:', line17.rows[0].pending);
    console.log('Oldest request:', line17.rows[0].oldest);
    console.log('Newest request:', line17.rows[0].newest);
    console.log('');
    
    // Query 3: Sample pending cruises
    const samples = await pool.query(`
      SELECT id, cruise_id, name, needs_price_update, price_update_requested_at
      FROM cruises
      WHERE cruise_line_id = 17
        AND needs_price_update = true
      LIMIT 5
    `);
    
    console.log('📊 Query 3 (Sample Line 17 pending):');
    samples.rows.forEach(cruise => {
      console.log(`  - ${cruise.name}: ${cruise.needs_price_update} (${cruise.price_update_requested_at})`);
    });
    
    if (samples.rows.length === 0) {
      console.log('  No pending cruises found for line 17');
    }
    console.log('');
    
    // Query 4: Check all lines with pending
    const allLines = await pool.query(`
      SELECT cruise_line_id, COUNT(*) as count
      FROM cruises
      WHERE needs_price_update = true
      GROUP BY cruise_line_id
      ORDER BY count DESC
    `);
    
    console.log('📊 Query 4 (All lines with pending):');
    if (allLines.rows.length > 0) {
      allLines.rows.forEach(line => {
        console.log(`  - Line ${line.cruise_line_id}: ${line.count} cruises`);
      });
    } else {
      console.log('  No lines have pending updates');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkPending();