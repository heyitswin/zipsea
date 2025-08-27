#!/usr/bin/env node

const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { sql } = require('drizzle-orm');
require('dotenv').config();

async function testIdTypeFix() {
  console.log('Testing codetocruiseid type fix...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  const db = drizzle(pool);
  
  try {
    // Test with string ID (how it should work)
    const testId = '2218838';
    console.log(`Looking for cruise with id = '${testId}' (as STRING)...`);
    
    const result = await db.execute(sql`
      SELECT id, cruise_id, name, sailing_date, needs_price_update
      FROM cruises
      WHERE id = ${testId}
      LIMIT 1
    `);
    
    if (result.length > 0) {
      console.log('✅ Found cruise with string ID match!');
      console.table(result);
    } else {
      console.log('❌ No cruise found with string ID');
      
      // Try to find any cruise with a similar ID pattern
      console.log('\nLooking for any cruises with IDs starting with "22"...');
      const sampleResult = await db.execute(sql`
        SELECT id, cruise_id, name, sailing_date
        FROM cruises
        WHERE id LIKE '22%'
        ORDER BY id
        LIMIT 5
      `);
      
      if (sampleResult.length > 0) {
        console.log('Sample cruises with similar ID pattern:');
        console.table(sampleResult);
      }
    }
    
    // Check data type of the id column
    console.log('\n📊 Checking data type of id column:');
    const typeResult = await db.execute(sql`
      SELECT 
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'cruises'
      AND column_name = 'id'
    `);
    
    console.table(typeResult);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testIdTypeFix().catch(console.error);