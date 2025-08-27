#!/usr/bin/env node

const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { sql } = require('drizzle-orm');
require('dotenv').config();

async function checkCruiseIds() {
  console.log('Checking cruise IDs in database...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  const db = drizzle(pool);
  
  try {
    // Check sample cruise IDs for lines 1, 10, 13
    console.log('📊 Sample cruise IDs for lines 1, 10, 13:');
    const samples = await db.execute(sql`
      SELECT 
        id,
        cruise_id,
        cruise_line_id,
        name,
        sailing_date,
        needs_price_update
      FROM cruises
      WHERE cruise_line_id IN (1, 10, 13)
      AND sailing_date >= CURRENT_DATE
      ORDER BY cruise_line_id, id
      LIMIT 15
    `);
    
    console.table(samples);
    
    // Check specific IDs that we're trying to update
    console.log('\n🔍 Checking specific IDs from FTP files:');
    const testIds = ['2218838', '2143102', '2174874', '2129894'];
    
    for (const testId of testIds) {
      const exists = await db.execute(sql`
        SELECT id, cruise_id, name, sailing_date
        FROM cruises
        WHERE id = ${testId}
        LIMIT 1
      `);
      
      if (exists.length > 0) {
        console.log(`✅ Found cruise ${testId}:`, exists[0]);
      } else {
        console.log(`❌ No cruise found with id='${testId}'`);
      }
    }
    
    // Check ID patterns
    console.log('\n📊 ID value patterns:');
    const patterns = await db.execute(sql`
      SELECT 
        LENGTH(id) as id_length,
        COUNT(*) as count,
        MIN(id) as sample_min,
        MAX(id) as sample_max
      FROM cruises
      WHERE cruise_line_id IN (1, 10, 13)
      GROUP BY LENGTH(id)
      ORDER BY id_length
    `);
    
    console.table(patterns);
    
    // Check if needs_price_update is set
    console.log('\n📊 Cruises needing price update:');
    const needsUpdate = await db.execute(sql`
      SELECT 
        cruise_line_id,
        COUNT(*) as total,
        COUNT(CASE WHEN needs_price_update = true THEN 1 END) as needs_update
      FROM cruises
      WHERE cruise_line_id IN (1, 10, 13, 21)
      GROUP BY cruise_line_id
      ORDER BY cruise_line_id
    `);
    
    console.table(needsUpdate);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkCruiseIds().catch(console.error);