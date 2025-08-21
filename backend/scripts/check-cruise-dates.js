#!/usr/bin/env node

/**
 * Check what date ranges the cruises actually cover
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

async function checkCruiseDates() {
  const client = await pool.connect();
  
  try {
    console.log('🗓️  Checking Cruise Date Distribution\n');
    console.log('========================================\n');
    
    // Get current server date
    const serverDate = await client.query('SELECT NOW() as server_time');
    console.log(`Server Date: ${serverDate.rows[0].server_time}`);
    console.log(`Today (should be Aug 20, 2025): ${new Date().toISOString()}\n`);
    
    // Check date distribution by month
    console.log('Cruise Distribution by Month:');
    console.log('-----------------------------');
    
    const monthDistribution = await client.query(`
      SELECT 
        TO_CHAR(sailing_date, 'YYYY-MM') as month,
        COUNT(*) as cruise_count,
        MIN(sailing_date) as earliest,
        MAX(sailing_date) as latest
      FROM cruises
      GROUP BY TO_CHAR(sailing_date, 'YYYY-MM')
      ORDER BY month
    `);
    
    monthDistribution.rows.forEach(row => {
      console.log(`  ${row.month}: ${row.cruise_count} cruises`);
    });
    
    console.log('\n');
    
    // Check future vs past cruises (from Aug 20, 2025)
    const cutoffDate = '2025-08-20';
    const futureCheck = await client.query(`
      SELECT 
        COUNT(CASE WHEN sailing_date >= $1 THEN 1 END) as future_cruises,
        COUNT(CASE WHEN sailing_date < $1 THEN 1 END) as past_cruises,
        MIN(CASE WHEN sailing_date >= $1 THEN sailing_date END) as next_cruise,
        MAX(CASE WHEN sailing_date < $1 THEN sailing_date END) as last_past_cruise
      FROM cruises
    `, [cutoffDate]);
    
    const stats = futureCheck.rows[0];
    console.log('Cruise Timing (relative to Aug 20, 2025):');
    console.log('-----------------------------------------');
    console.log(`  Future cruises (Aug 20, 2025+): ${stats.future_cruises}`);
    console.log(`  Past cruises (before Aug 20, 2025): ${stats.past_cruises}`);
    console.log(`  Next cruise date: ${stats.next_cruise}`);
    console.log(`  Last past cruise: ${stats.last_past_cruise}`);
    console.log('');
    
    // Check September 2025 specifically
    const sept2025 = await client.query(`
      SELECT 
        COUNT(*) as count,
        MIN(sailing_date) as first_sailing,
        MAX(sailing_date) as last_sailing,
        COUNT(DISTINCT ship_id) as ships,
        COUNT(DISTINCT cruise_line_id) as lines
      FROM cruises
      WHERE sailing_date >= '2025-09-01' 
      AND sailing_date < '2025-10-01'
    `);
    
    const septStats = sept2025.rows[0];
    console.log('September 2025 Cruises:');
    console.log('----------------------');
    console.log(`  Total: ${septStats.count}`);
    console.log(`  First sailing: ${septStats.first_sailing}`);
    console.log(`  Last sailing: ${septStats.last_sailing}`);
    console.log(`  Ships: ${septStats.ships}`);
    console.log(`  Cruise lines: ${septStats.lines}`);
    console.log('');
    
    // Sample some September cruises
    if (septStats.count > 0) {
      const samples = await client.query(`
        SELECT 
          c.id,
          c.name,
          c.sailing_date,
          cl.name as cruise_line,
          s.name as ship
        FROM cruises c
        LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        LEFT JOIN ships s ON c.ship_id = s.id
        WHERE c.sailing_date >= '2025-09-01' 
        AND c.sailing_date < '2025-10-01'
        ORDER BY c.sailing_date
        LIMIT 5
      `);
      
      console.log('Sample September 2025 Cruises:');
      console.log('-----------------------------');
      samples.rows.forEach(cruise => {
        console.log(`  ${cruise.sailing_date.toISOString().split('T')[0]} - ${cruise.name}`);
      });
    }
    
    console.log('\n========================================');
    console.log('Diagnosis:');
    console.log('========================================\n');
    
    if (stats.future_cruises === 0) {
      console.log('❌ NO FUTURE CRUISES!');
      console.log('All cruises are in the past relative to Aug 20, 2025');
      console.log('This is why the API returns empty results.');
      console.log('\nSolution: Run sync for Sept 2025+ cruises:');
      console.log('FORCE_UPDATE=true SYNC_YEARS=2025,2026 node scripts/sync-sept-onwards.js');
    } else {
      console.log(`✅ Found ${stats.future_cruises} future cruises`);
      console.log('The API should be returning these cruises.');
    }
    
  } catch (error) {
    console.error('❌ Error checking dates:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the check
checkCruiseDates()
  .then(() => {
    console.log('\n✅ Date check complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });