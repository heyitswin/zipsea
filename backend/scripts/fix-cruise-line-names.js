#!/usr/bin/env node

/**
 * Fix cruise line names that were stored as "[object Object]"
 * This is a temporary fix - the real fix should be in the sync script
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

async function fixCruiseLineNames() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing Cruise Line Names\n');
    console.log('========================================\n');
    
    // First, check how many are affected
    console.log('1. Checking affected cruise lines:');
    const affected = await client.query(`
      SELECT COUNT(*) as count
      FROM cruise_lines
      WHERE name = '[object Object]'
    `);
    console.log(`   Found ${affected.rows[0].count} cruise lines with bad names\n`);
    
    if (affected.rows[0].count === 0) {
      console.log('✅ No cruise lines need fixing!');
      return;
    }
    
    // Get the bad cruise lines with their codes
    console.log('2. Getting cruise line details:');
    const badLines = await client.query(`
      SELECT id, code, name
      FROM cruise_lines
      WHERE name = '[object Object]'
      LIMIT 10
    `);
    
    console.log('Sample affected cruise lines:');
    badLines.rows.forEach(line => {
      console.log(`   ID: ${line.id}, Code: ${line.code}`);
    });
    console.log('');
    
    // Fix by using the code as the name (temporary fix)
    console.log('3. Fixing cruise line names...');
    const updateResult = await client.query(`
      UPDATE cruise_lines
      SET name = COALESCE(
        CASE 
          WHEN code IS NOT NULL AND code != '' THEN code
          ELSE CONCAT('Cruise Line ', id)
        END,
        CONCAT('Cruise Line ', id)
      )
      WHERE name = '[object Object]'
      RETURNING id, name, code
    `);
    
    console.log(`   Updated ${updateResult.rows.length} cruise lines\n`);
    
    // Show some examples of what was fixed
    console.log('4. Sample fixed cruise lines:');
    updateResult.rows.slice(0, 5).forEach(line => {
      console.log(`   ID: ${line.id} -> Name: ${line.name}`);
    });
    console.log('');
    
    // Check ships too
    console.log('5. Checking ships for the same issue:');
    const badShips = await client.query(`
      SELECT COUNT(*) as count
      FROM ships
      WHERE name = '[object Object]'
    `);
    console.log(`   Found ${badShips.rows[0].count} ships with bad names`);
    
    if (badShips.rows[0].count > 0) {
      console.log('   Fixing ship names...');
      const shipUpdate = await client.query(`
        UPDATE ships
        SET name = COALESCE(
          CASE 
            WHEN code IS NOT NULL AND code != '' THEN code
            ELSE CONCAT('Ship ', id)
          END,
          CONCAT('Ship ', id)
        )
        WHERE name = '[object Object]'
      `);
      console.log(`   Fixed ${shipUpdate.rowCount} ships`);
    }
    
    console.log('\n========================================');
    console.log('Results:');
    console.log('========================================\n');
    
    console.log('✅ Cruise line names fixed!');
    console.log('\nNote: This is a temporary fix.');
    console.log('The real fix should be in the sync script to properly extract names from the JSON data.');
    console.log('\nYou should now clear the cache and test the API again:');
    console.log('curl -X POST https://zipsea-production.onrender.com/health/cache/clear');
    console.log('curl https://zipsea-production.onrender.com/api/v1/cruises?limit=5');
    
  } catch (error) {
    console.error('❌ Error fixing names:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixCruiseLineNames()
  .then(() => {
    console.log('\n✅ Fix complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });