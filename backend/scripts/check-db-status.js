#!/usr/bin/env node

/**
 * Simple database status check
 */

require('dotenv').config();

async function checkDB() {
  const { Pool } = require('pg');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('Checking database connection...\n');
    
    // Test basic connection
    const testResult = await pool.query('SELECT NOW()');
    console.log('✅ Database connected at:', testResult.rows[0].now);
    
    // Count total cruises
    const countResult = await pool.query('SELECT COUNT(*) FROM cruises');
    console.log(`\nTotal cruises in database: ${countResult.rows[0].count}`);
    
    // Count by line
    const lineResult = await pool.query(`
      SELECT cruise_line_id, COUNT(*) as count 
      FROM cruises 
      GROUP BY cruise_line_id 
      ORDER BY cruise_line_id
      LIMIT 10
    `);
    
    if (lineResult.rows.length > 0) {
      console.log('\nCruises by line:');
      lineResult.rows.forEach(row => {
        console.log(`  Line ${row.cruise_line_id}: ${row.count} cruises`);
      });
    }
    
    // Check pending syncs
    const pendingResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM cruises 
      WHERE needs_price_update = true
    `);
    console.log(`\nPending syncs: ${pendingResult.rows[0].count}`);
    
    // Check recently updated
    const recentResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM cruises 
      WHERE updated_at > NOW() - INTERVAL '1 hour'
    `);
    console.log(`Recently updated (last hour): ${recentResult.rows[0].count}`);
    
    // Sample cruise
    const sampleResult = await pool.query(`
      SELECT cruise_id, cruise_line_id, ship_id, sailing_date, needs_price_update
      FROM cruises 
      LIMIT 1
    `);
    
    if (sampleResult.rows.length > 0) {
      console.log('\nSample cruise:');
      console.log(sampleResult.rows[0]);
    }
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await pool.end();
  }
}

checkDB();