#!/usr/bin/env node

/**
 * Test the search query directly using the same logic as the service
 */

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testSearchDirectly() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Testing Search Query Logic\n');
    console.log('========================================\n');
    
    // Check if cruise_lines.name is actually an object/JSON
    console.log('1. Checking Cruise Lines Data:');
    const lineCheck = await client.query(`
      SELECT 
        id,
        name,
        pg_typeof(name) as type
      FROM cruise_lines
      LIMIT 5
    `);
    
    console.log('Sample cruise lines:');
    lineCheck.rows.forEach(row => {
      console.log(`  ID: ${row.id}, Type: ${row.type}`);
      console.log(`  Name: ${JSON.stringify(row.name)}`);
      if (typeof row.name === 'object') {
        console.log(`  Name keys: ${Object.keys(row.name).join(', ')}`);
      }
      console.log('');
    });
    
    // Check the actual search query structure
    console.log('2. Testing Search Query:');
    const searchQuery = await client.query(`
      SELECT 
        c.id,
        c.name as cruise_name,
        c.sailing_date,
        cl.name as cruise_line,
        s.name as ship_name,
        cp.cheapest_price,
        c.port_ids,
        c.region_ids
      FROM cruises c
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      LEFT JOIN ships s ON c.ship_id = s.id
      LEFT JOIN ports p1 ON c.embark_port_id = p1.id
      LEFT JOIN ports p2 ON c.disembark_port_id = p2.id
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.is_active = true
      AND c.sailing_date >= '2025-08-20'
      LIMIT 5
    `);
    
    console.log(`Found ${searchQuery.rows.length} results:`);
    searchQuery.rows.forEach((row, i) => {
      console.log(`\nCruise ${i + 1}:`);
      console.log(`  ID: ${row.id}`);
      console.log(`  Name: ${row.cruise_name}`);
      console.log(`  Date: ${row.sailing_date}`);
      console.log(`  Cruise Line: ${typeof row.cruise_line === 'object' ? JSON.stringify(row.cruise_line) : row.cruise_line}`);
      console.log(`  Ship: ${row.ship_name}`);
      console.log(`  Price: ${row.cheapest_price}`);
      console.log(`  Port IDs: ${row.port_ids}`);
      console.log(`  Region IDs: ${row.region_ids}`);
    });
    
    // Check if the issue is with the COUNT query
    console.log('\n3. Testing Count Query:');
    const countQuery = await client.query(`
      SELECT COUNT(*) as count
      FROM cruises c
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      LEFT JOIN ships s ON c.ship_id = s.id
      LEFT JOIN ports p1 ON c.embark_port_id = p1.id
      LEFT JOIN ports p2 ON c.disembark_port_id = p2.id
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.is_active = true
      AND c.sailing_date >= '2025-08-20'
    `);
    console.log(`  Total count: ${countQuery.rows[0].count}`);
    
    // Check if there are any null IDs causing issues
    console.log('\n4. Checking for NULL Foreign Keys:');
    const nullCheck = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(cruise_line_id) as has_line,
        COUNT(ship_id) as has_ship,
        COUNT(embark_port_id) as has_embark,
        COUNT(disembark_port_id) as has_disembark
      FROM cruises
      WHERE is_active = true
      AND sailing_date >= '2025-08-20'
    `);
    
    const nc = nullCheck.rows[0];
    console.log(`  Total cruises: ${nc.total}`);
    console.log(`  With cruise_line_id: ${nc.has_line} (${nc.total - nc.has_line} missing)`);
    console.log(`  With ship_id: ${nc.has_ship} (${nc.total - nc.has_ship} missing)`);
    console.log(`  With embark_port_id: ${nc.has_embark} (${nc.total - nc.has_embark} missing)`);
    console.log(`  With disembark_port_id: ${nc.has_disembark} (${nc.total - nc.has_disembark} missing)`);
    
    console.log('\n========================================');
    console.log('Diagnosis:');
    console.log('========================================\n');
    
    if (searchQuery.rows.length === 0) {
      console.log('❌ Query returns no results!');
      console.log('Check the WHERE conditions in the search service.');
    } else if (typeof lineCheck.rows[0]?.name === 'object') {
      console.log('⚠️  Cruise line names are stored as JSON objects!');
      console.log('This is why they show as [object Object] in the UI.');
      console.log('\nSolution: Fix the sync to store cruise line names as strings.');
      console.log('Or extract the correct field from the JSON object.');
    } else {
      console.log('✅ Query returns results correctly.');
      console.log('The issue might be in the TypeScript/Drizzle query building.');
    }
    
  } catch (error) {
    console.error('❌ Error testing search:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testSearchDirectly()
  .then(() => {
    console.log('\n✅ Test complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });