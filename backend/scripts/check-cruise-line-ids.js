#!/usr/bin/env node

/**
 * Check what cruise line IDs we have in the database
 * and verify they match what Traveltek expects
 */

require('dotenv').config();
const { Pool } = require('pg');

async function checkCruiseLineIds() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL_PRODUCTION ? { rejectUnauthorized: false } : false
  });
  
  try {
    console.log('🔍 Checking cruise line IDs in database...\n');
    
    // Check what cruise lines we have
    const linesResult = await pool.query(`
      SELECT DISTINCT cl.id, cl.name, cl.code, COUNT(c.id) as cruise_count
      FROM cruise_lines cl
      LEFT JOIN cruises c ON c.cruise_line_id = cl.id
      GROUP BY cl.id, cl.name, cl.code
      ORDER BY cl.id
    `);
    
    console.log('📋 Cruise Lines in Database:');
    console.log('ID | Name | Code | Cruise Count');
    console.log('-'.repeat(60));
    
    linesResult.rows.forEach(line => {
      console.log(`${line.id} | ${line.name} | ${line.code} | ${line.cruise_count}`);
    });
    
    console.log('\n');
    
    // Check specific cruise lines we know about
    const knownLines = [
      { id: 3, name: 'Royal Caribbean' },
      { id: 21, name: 'Virgin Voyages' },
      { id: 1, name: 'P&O Cruises' }
    ];
    
    console.log('🔍 Checking Known Lines:');
    for (const known of knownLines) {
      const result = await pool.query(`
        SELECT id, name, code 
        FROM cruise_lines 
        WHERE id = $1
      `, [known.id]);
      
      if (result.rows.length > 0) {
        const line = result.rows[0];
        console.log(`✅ Line ${known.id}: Found as "${line.name}" (${line.code})`);
      } else {
        console.log(`❌ Line ${known.id}: NOT FOUND (expected ${known.name})`);
      }
    }
    
    console.log('\n');
    
    // Check a sample cruise to see its structure
    const sampleResult = await pool.query(`
      SELECT c.id, c.cruise_id, c.cruise_line_id, c.name, cl.name as line_name
      FROM cruises c
      JOIN cruise_lines cl ON cl.id = c.cruise_line_id
      WHERE c.name LIKE '%Vision%'
      LIMIT 1
    `);
    
    if (sampleResult.rows.length > 0) {
      console.log('📊 Sample Cruise (Vision of the Seas):');
      console.log(JSON.stringify(sampleResult.rows[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkCruiseLineIds();