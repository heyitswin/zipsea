#!/usr/bin/env node

/**
 * Test a simple query to see why API returns no results
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

async function testSimpleQuery() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Testing Simple Cruise Query\n');
    console.log('========================================\n');
    
    // 1. Most basic query
    console.log('1. Basic Query (no joins):');
    const basic = await client.query(`
      SELECT COUNT(*) as count
      FROM cruises
      WHERE is_active = true
      AND sailing_date >= '2025-08-20'
      LIMIT 10
    `);
    console.log(`   Found: ${basic.rows[0].count} cruises\n`);
    
    // 2. With cruise line join
    console.log('2. With Cruise Line Join:');
    const withLine = await client.query(`
      SELECT COUNT(*) as count
      FROM cruises c
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.is_active = true
      AND c.sailing_date >= '2025-08-20'
    `);
    console.log(`   Found: ${withLine.rows[0].count} cruises\n`);
    
    // 3. With ship join
    console.log('3. With Ship Join:');
    const withShip = await client.query(`
      SELECT COUNT(*) as count
      FROM cruises c
      LEFT JOIN ships s ON c.ship_id = s.id
      WHERE c.is_active = true
      AND c.sailing_date >= '2025-08-20'
    `);
    console.log(`   Found: ${withShip.rows[0].count} cruises\n`);
    
    // 4. With cheapest pricing join
    console.log('4. With Cheapest Pricing Join:');
    const withPricing = await client.query(`
      SELECT COUNT(*) as count
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.is_active = true
      AND c.sailing_date >= '2025-08-20'
    `);
    console.log(`   Found: ${withPricing.rows[0].count} cruises`);
    console.log(`   Note: We have ${basic.rows[0].count - withPricing.rows[0].count} cruises without cheapest_pricing\n`);
    
    // 5. Check if cheapest_pricing is the issue
    console.log('5. Cruises WITH cheapest_pricing:');
    const withCheapest = await client.query(`
      SELECT COUNT(DISTINCT c.id) as count
      FROM cruises c
      INNER JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.is_active = true
      AND c.sailing_date >= '2025-08-20'
    `);
    console.log(`   Found: ${withCheapest.rows[0].count} cruises with pricing\n`);
    
    // 6. Check embark/disembark ports
    console.log('6. With Port Joins:');
    const withPorts = await client.query(`
      SELECT COUNT(*) as count
      FROM cruises c
      LEFT JOIN ports p1 ON c.embark_port_id = p1.id
      LEFT JOIN ports p2 ON c.disembark_port_id = p2.id
      WHERE c.is_active = true
      AND c.sailing_date >= '2025-08-20'
    `);
    console.log(`   Found: ${withPorts.rows[0].count} cruises\n`);
    
    // 7. Full join like the API might use
    console.log('7. Full Query (all joins):');
    const fullQuery = await client.query(`
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
    console.log(`   Found: ${fullQuery.rows[0].count} cruises\n`);
    
    // 8. Sample one cruise to see what data looks like
    console.log('8. Sample Cruise Data:');
    const sample = await client.query(`
      SELECT 
        c.id,
        c.name,
        c.sailing_date,
        c.is_active,
        cl.name as cruise_line,
        s.name as ship,
        p1.name as embark_port,
        p2.name as disembark_port,
        cp.cheapest_price
      FROM cruises c
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      LEFT JOIN ships s ON c.ship_id = s.id
      LEFT JOIN ports p1 ON c.embark_port_id = p1.id
      LEFT JOIN ports p2 ON c.disembark_port_id = p2.id
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.is_active = true
      AND c.sailing_date >= '2025-09-01'
      LIMIT 1
    `);
    
    if (sample.rows.length > 0) {
      const cruise = sample.rows[0];
      console.log(`   ID: ${cruise.id}`);
      console.log(`   Name: ${cruise.name}`);
      console.log(`   Date: ${cruise.sailing_date}`);
      console.log(`   Cruise Line: ${cruise.cruise_line}`);
      console.log(`   Ship: ${cruise.ship}`);
      console.log(`   Embark: ${cruise.embark_port}`);
      console.log(`   Disembark: ${cruise.disembark_port}`);
      console.log(`   Cheapest Price: ${cruise.cheapest_price}`);
    }
    
    console.log('\n========================================');
    console.log('Diagnosis:');
    console.log('========================================\n');
    
    if (withCheapest.rows[0].count === 0) {
      console.log('❌ NO CRUISES HAVE CHEAPEST_PRICING!');
      console.log('This might be why the API returns empty results.');
      console.log('The search might be doing an INNER JOIN on cheapest_pricing.');
      console.log('\nSolution: Check if search service requires cheapest_pricing');
    } else if (fullQuery.rows[0].count === 0) {
      console.log('❌ Full query returns 0 results!');
      console.log('Something in the JOIN conditions is filtering everything out.');
    } else {
      console.log(`✅ Full query returns ${fullQuery.rows[0].count} cruises`);
      console.log('The issue must be in the search service logic.');
    }
    
  } catch (error) {
    console.error('❌ Error testing query:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testSimpleQuery()
  .then(() => {
    console.log('\n✅ Test complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });