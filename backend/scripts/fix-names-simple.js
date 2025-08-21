#!/usr/bin/env node

/**
 * Simple fix for cruise line and ship names
 * This version focuses on fixing the names without FTP connection
 */

const { Pool } = require('pg');
require('dotenv').config();

// Debug: Show what environment variables are available
console.log('🔍 Checking environment variables...');
console.log('   DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Not set');
console.log('   PRODUCTION_DATABASE_URL:', process.env.PRODUCTION_DATABASE_URL ? '✅ Set' : '❌ Not set');
console.log('   FTP_HOST:', process.env.FTP_HOST ? '✅ Set' : '❌ Not set');
console.log('   FTP_USER:', process.env.FTP_USER ? '✅ Set' : '❌ Not set');
console.log('   FTP_PASS:', process.env.FTP_PASS ? '✅ Set' : '❌ Not set');
console.log('   FTP_PASSWORD:', process.env.FTP_PASSWORD ? '✅ Set' : '❌ Not set');
console.log('   TRAVELTEK_FTP_USER:', process.env.TRAVELTEK_FTP_USER ? '✅ Set' : '❌ Not set');
console.log('   TRAVELTEK_FTP_PASS:', process.env.TRAVELTEK_FTP_PASS ? '✅ Set' : '❌ Not set');
console.log('   TRAVELTEK_FTP_PASSWORD:', process.env.TRAVELTEK_FTP_PASSWORD ? '✅ Set' : '❌ Not set');
console.log('');

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

async function fixNamesFromDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing Cruise Line and Ship Names\n');
    console.log('========================================\n');
    
    // Step 1: Try to extract better names from existing data
    console.log('1. Analyzing cruise line names that need fixing:\n');
    
    const badCruiseLines = await client.query(`
      SELECT id, name, code
      FROM cruise_lines
      WHERE name LIKE 'CL%' 
         OR name LIKE 'Line %' 
         OR name = '[object Object]'
      ORDER BY id
      LIMIT 20
    `);
    
    console.log(`   Found ${badCruiseLines.rows.length} cruise lines to fix:`);
    badCruiseLines.rows.forEach(line => {
      console.log(`     ID: ${line.id}, Current: "${line.name}", Code: ${line.code || 'none'}`);
    });
    console.log('');
    
    // Step 2: Check if we can derive names from cruise data
    console.log('2. Looking for better names in cruise data:\n');
    
    // Try to find cruise names that might contain the cruise line name
    const cruiseNamePatterns = await client.query(`
      SELECT DISTINCT 
        cl.id as line_id,
        cl.name as current_name,
        c.name as cruise_name,
        COUNT(*) as cruise_count
      FROM cruise_lines cl
      JOIN cruises c ON c.cruise_line_id = cl.id
      WHERE (cl.name LIKE 'CL%' OR cl.name LIKE 'Line %')
        AND c.name IS NOT NULL
      GROUP BY cl.id, cl.name, c.name
      ORDER BY cl.id, cruise_count DESC
      LIMIT 50
    `);
    
    // Analyze patterns to extract potential cruise line names
    const lineNameMap = new Map();
    
    for (const row of cruiseNamePatterns.rows) {
      if (!lineNameMap.has(row.line_id)) {
        // Try to extract cruise line name from cruise name
        const cruiseName = row.cruise_name;
        
        // Common patterns:
        // "Royal Caribbean - 7 Night Eastern Caribbean"
        // "Norwegian Cruise Line: Alaska Voyage"
        // "Celebrity Cruises Mediterranean"
        
        let extractedName = null;
        
        // Pattern 1: Name before dash or colon
        const match1 = cruiseName.match(/^([^-:]+?)[\s-:]/);
        if (match1) {
          extractedName = match1[1].trim();
        }
        
        // Pattern 2: Known cruise line names
        const knownLines = [
          'Royal Caribbean', 'Norwegian', 'Celebrity', 'Princess', 
          'Holland America', 'MSC', 'Costa', 'Carnival', 'Disney',
          'Virgin Voyages', 'Silversea', 'Seabourn', 'Regent',
          'Oceania', 'Viking', 'Azamara', 'Windstar', 'Crystal',
          'Cunard', 'P&O', 'Fred Olsen', 'Marella', 'Ambassador'
        ];
        
        for (const known of knownLines) {
          if (cruiseName.toLowerCase().includes(known.toLowerCase())) {
            extractedName = known;
            break;
          }
        }
        
        if (extractedName && extractedName.length > 3 && extractedName !== row.current_name) {
          lineNameMap.set(row.line_id, extractedName);
          console.log(`   Found potential name for Line ${row.line_id}: "${extractedName}" (from "${cruiseName}")`);
        }
      }
    }
    
    console.log(`\n   Identified ${lineNameMap.size} potential cruise line names\n`);
    
    // Step 3: Fix ships with similar approach
    console.log('3. Looking for ship names:\n');
    
    const badShips = await client.query(`
      SELECT s.id, s.name, s.code, COUNT(c.id) as cruise_count
      FROM ships s
      LEFT JOIN cruises c ON c.ship_id = s.id
      WHERE s.name LIKE 'Ship %' OR s.name = '[object Object]'
      GROUP BY s.id, s.name, s.code
      ORDER BY s.id
      LIMIT 20
    `);
    
    console.log(`   Found ${badShips.rows.length} ships to fix`);
    
    // Try to get ship names from cruise names
    const shipNameMap = new Map();
    
    for (const ship of badShips.rows) {
      const cruiseWithShip = await client.query(`
        SELECT c.name as cruise_name
        FROM cruises c
        WHERE c.ship_id = $1
          AND c.name IS NOT NULL
        LIMIT 5
      `, [ship.id]);
      
      if (cruiseWithShip.rows.length > 0) {
        // Try to extract ship name from cruise names
        for (const cruise of cruiseWithShip.rows) {
          const cruiseName = cruise.cruise_name;
          
          // Common patterns:
          // "Symphony of the Seas - Caribbean"
          // "Norwegian Epic: Mediterranean"
          // "Queen Mary 2 Transatlantic"
          
          // Pattern: Ship name often appears before dash or colon
          const match = cruiseName.match(/^(?:.*?on\s+)?([^-:]+?)[\s-:]/);
          if (match) {
            const potentialShipName = match[1].trim();
            
            // Filter out cruise line names
            const isLineName = ['Royal', 'Norwegian', 'Celebrity', 'Princess', 'Holland', 
                                'MSC', 'Costa', 'Carnival', 'Disney', 'Virgin'].some(
              line => potentialShipName.startsWith(line)
            );
            
            if (!isLineName && potentialShipName.length > 3) {
              shipNameMap.set(ship.id, potentialShipName);
              console.log(`   Found potential name for Ship ${ship.id}: "${potentialShipName}"`);
              break;
            }
          }
        }
      }
    }
    
    console.log(`\n   Identified ${shipNameMap.size} potential ship names\n`);
    
    // Step 4: Apply the updates
    console.log('4. Applying updates:\n');
    
    // Update cruise lines
    let updatedLines = 0;
    for (const [lineId, name] of lineNameMap) {
      const result = await client.query(
        'UPDATE cruise_lines SET name = $1 WHERE id = $2',
        [name, lineId]
      );
      if (result.rowCount > 0) {
        updatedLines++;
        console.log(`   ✅ Updated cruise line ${lineId} to "${name}"`);
      }
    }
    
    // Update ships
    let updatedShips = 0;
    for (const [shipId, name] of shipNameMap) {
      const result = await client.query(
        'UPDATE ships SET name = $1 WHERE id = $2',
        [name, shipId]
      );
      if (result.rowCount > 0) {
        updatedShips++;
        console.log(`   ✅ Updated ship ${shipId} to "${name}"`);
      }
    }
    
    // Step 5: For remaining bad names, use a better default
    console.log('\n5. Fixing remaining names with better defaults:\n');
    
    // Fix remaining cruise lines with code or better default
    const fixedDefaults = await client.query(`
      UPDATE cruise_lines
      SET name = CASE
        WHEN code IS NOT NULL AND code != '' AND code != name 
          THEN CONCAT(UPPER(SUBSTRING(code, 1, 1)), LOWER(SUBSTRING(code, 2)), ' Cruises')
        ELSE CONCAT('Cruise Line ', id)
      END
      WHERE name LIKE 'CL%' OR name LIKE 'Line %'
      RETURNING id, name
    `);
    
    console.log(`   Fixed ${fixedDefaults.rowCount} cruise lines with better defaults`);
    
    // Fix remaining ships
    const fixedShips = await client.query(`
      UPDATE ships
      SET name = CASE
        WHEN code IS NOT NULL AND code != '' AND code != name 
          THEN CONCAT('MS ', UPPER(SUBSTRING(code, 1, 1)), LOWER(SUBSTRING(code, 2)))
        ELSE CONCAT('Cruise Ship ', id)
      END
      WHERE name LIKE 'Ship %'
      RETURNING id, name
    `);
    
    console.log(`   Fixed ${fixedShips.rowCount} ships with better defaults`);
    
    // Final statistics
    console.log('\n========================================');
    console.log('Results:');
    console.log('========================================\n');
    
    console.log(`✅ Updated ${updatedLines} cruise lines with extracted names`);
    console.log(`✅ Updated ${updatedShips} ships with extracted names`);
    console.log(`✅ Fixed ${fixedDefaults.rowCount} cruise lines with better defaults`);
    console.log(`✅ Fixed ${fixedShips.rowCount} ships with better defaults`);
    
    // Show some examples
    console.log('\nSample updated cruise lines:');
    const sampleLines = await client.query(`
      SELECT id, name FROM cruise_lines 
      WHERE id IN (SELECT id FROM cruise_lines ORDER BY id LIMIT 5)
      ORDER BY id
    `);
    sampleLines.rows.forEach(line => {
      console.log(`   ${line.id}: ${line.name}`);
    });
    
    console.log('\nSample updated ships:');
    const sampleShips = await client.query(`
      SELECT id, name FROM ships 
      WHERE id IN (SELECT id FROM ships ORDER BY id LIMIT 5)
      ORDER BY id
    `);
    sampleShips.rows.forEach(ship => {
      console.log(`   ${ship.id}: ${ship.name}`);
    });
    
    console.log('\n🎯 Next steps:');
    console.log('1. Clear the cache and test the API');
    console.log('2. If FTP access is available, run the full FTP sync script for better names');
    
  } catch (error) {
    console.error('❌ Error fixing names:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixNamesFromDatabase()
  .then(() => {
    console.log('\n✅ Name fix complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });