#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

async function checkCruiseIdMismatch() {
  console.log('🔍 Checking cruise ID patterns to understand mismatch...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // Check sample of cruise IDs
    console.log('\n📊 Sample cruise IDs from database:');
    const sampleIds = await pool.query(`
      SELECT 
        id,
        cruise_id,
        cruise_line_id,
        ship_id,
        sailing_date,
        name
      FROM cruises
      WHERE sailing_date >= CURRENT_DATE
      AND needs_price_update = true
      ORDER BY id
      LIMIT 10
    `);
    
    console.table(sampleIds.rows);
    
    // Check ID ranges
    console.log('\n📊 ID ranges in database:');
    const idRanges = await pool.query(`
      SELECT 
        MIN(id) as min_id,
        MAX(id) as max_id,
        COUNT(*) as total_cruises,
        COUNT(DISTINCT cruise_line_id) as cruise_lines
      FROM cruises
      WHERE sailing_date >= CURRENT_DATE
    `);
    
    console.table(idRanges.rows);
    
    // Check if there are any cruises with IDs that could match FTP files
    console.log('\n📊 Checking for specific ID patterns (like 2143102):');
    const specificCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM cruises
      WHERE id > 2000000
      AND sailing_date >= CURRENT_DATE
    `);
    
    console.log(`Cruises with ID > 2000000: ${specificCheck.rows[0].count}`);
    
    // Check cruise_id field pattern
    console.log('\n📊 Sample cruise_id field values:');
    const cruiseIdSamples = await pool.query(`
      SELECT DISTINCT
        cruise_id,
        COUNT(*) as count
      FROM cruises
      WHERE sailing_date >= CURRENT_DATE
      AND cruise_id IS NOT NULL
      GROUP BY cruise_id
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `);
    
    console.table(cruiseIdSamples.rows);
    
    // Check for a specific cruise that should exist
    console.log('\n🔍 Looking for specific cruise IDs from FTP files:');
    const testIds = [2143102, 2174874, 2218838, 2129894]; // IDs we know from FTP
    
    for (const testId of testIds) {
      const exists = await pool.query(`
        SELECT id, cruise_id, name, sailing_date
        FROM cruises
        WHERE id = $1 OR cruise_id = $2
      `, [testId, String(testId)]);
      
      if (exists.rows.length > 0) {
        console.log(`✅ Found cruise ${testId}:`, exists.rows[0]);
      } else {
        console.log(`❌ No cruise found with id=${testId} or cruise_id='${testId}'`);
      }
    }
    
    // Check if IDs are strings vs numbers issue
    console.log('\n📊 Checking data types:');
    const typeCheck = await pool.query(`
      SELECT 
        data_type,
        column_name
      FROM information_schema.columns
      WHERE table_name = 'cruises'
      AND column_name IN ('id', 'cruise_id')
      ORDER BY column_name
    `);
    
    console.table(typeCheck.rows);
    
    console.log('\n💡 Analysis complete!');
    console.log('The mismatch is likely because:');
    console.log('1. The FTP filename uses a different ID (codetocruiseid) than our database ID');
    console.log('2. We may need to match on cruise_id + sailing_date instead');
    console.log('3. Or we need to store the codetocruiseid during initial import');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkCruiseIdMismatch().catch(console.error);