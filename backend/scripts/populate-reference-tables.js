#!/usr/bin/env node

/**
 * POPULATE REFERENCE TABLES
 * 
 * This script populates the cruise_lines, ships, ports, and regions tables
 * with data needed for the Traveltek sync to work properly.
 * 
 * These are reference tables that need to exist before we can insert cruises.
 */

require('dotenv').config();
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: { rejectUnauthorized: false }
});

async function populateReferenceTables() {
  console.log('🔧 POPULATING REFERENCE TABLES');
  console.log('================================\n');
  
  try {
    // Start transaction
    await sql.begin(async sql => {
      
      // Populate cruise_lines
      console.log('📝 Populating cruise_lines...');
      const cruiseLines = [
        { id: 1, name: 'Royal Caribbean International', code: 'RCI' },
        { id: 2, name: 'Carnival Cruise Line', code: 'CCL' },
        { id: 3, name: 'Norwegian Cruise Line', code: 'NCL' },
        { id: 4, name: 'MSC Cruises', code: 'MSC' },
        { id: 5, name: 'Princess Cruises', code: 'PRI' },
        { id: 6, name: 'Celebrity Cruises', code: 'CEL' },
        { id: 7, name: 'Holland America Line', code: 'HAL' },
        { id: 8, name: 'Disney Cruise Line', code: 'DCL' },
        { id: 9, name: 'Virgin Voyages', code: 'VIR' },
        { id: 10, name: 'Cunard Line', code: 'CUN' },
        { id: 11, name: 'Oceania Cruises', code: 'OCE' },
        { id: 12, name: 'Regent Seven Seas', code: 'RSS' },
        { id: 13, name: 'Silversea Cruises', code: 'SIL' },
        { id: 14, name: 'Seabourn', code: 'SEA' },
        { id: 15, name: 'Viking Ocean Cruises', code: 'VIK' },
        { id: 16, name: 'Costa Cruises', code: 'COS' },
        { id: 17, name: 'P&O Cruises', code: 'PO' },
        { id: 18, name: 'Azamara', code: 'AZA' },
        { id: 19, name: 'Windstar Cruises', code: 'WIN' },
        { id: 20, name: 'Crystal Cruises', code: 'CRY' },
        { id: 21, name: 'Hurtigruten', code: 'HUR' },
        { id: 22, name: 'Marella Cruises', code: 'MAR' },
        { id: 23, name: 'Fred Olsen Cruise Lines', code: 'FOL' },
        { id: 24, name: 'Saga Cruises', code: 'SAG' },
        { id: 25, name: 'Ambassador Cruise Line', code: 'AMB' },
        { id: 26, name: 'Explora Journeys', code: 'EXP' },
        { id: 27, name: 'Atlas Ocean Voyages', code: 'ATL' },
        { id: 28, name: 'American Cruise Lines', code: 'ACL' },
        { id: 29, name: 'UnCruise Adventures', code: 'UNC' },
        { id: 30, name: 'Scenic Luxury Cruises', code: 'SCE' }
      ];
      
      for (const line of cruiseLines) {
        await sql`
          INSERT INTO cruise_lines (id, name, code, is_active)
          VALUES (${line.id}, ${line.name}, ${line.code}, true)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            code = EXCLUDED.code,
            updated_at = NOW()
        `;
      }
      console.log(`   ✅ Inserted ${cruiseLines.length} cruise lines\n`);
      
      // For now, create placeholder entries for ships and ports
      // These will be populated with actual data as cruises are synced
      console.log('📝 Creating placeholder ships (1-500)...');
      for (let i = 1; i <= 500; i++) {
        await sql`
          INSERT INTO ships (id, name, cruise_line_id, is_active)
          VALUES (${i}, ${'Ship ' + i}, 1, true)
          ON CONFLICT (id) DO NOTHING
        `;
      }
      console.log('   ✅ Created ship placeholders\n');
      
      console.log('📝 Creating placeholder ports (1-1000)...');
      for (let i = 1; i <= 1000; i++) {
        await sql`
          INSERT INTO ports (id, name, code, country, is_active)
          VALUES (${i}, ${'Port ' + i}, ${'P' + i}, 'Unknown', true)
          ON CONFLICT (id) DO NOTHING
        `;
      }
      console.log('   ✅ Created port placeholders\n');
      
      console.log('📝 Creating placeholder regions (1-100)...');
      for (let i = 1; i <= 100; i++) {
        await sql`
          INSERT INTO regions (id, name, code, is_active)
          VALUES (${i}, ${'Region ' + i}, ${'R' + i}, true)
          ON CONFLICT (id) DO NOTHING
        `;
      }
      console.log('   ✅ Created region placeholders\n');
      
    });
    
    console.log('✅ REFERENCE TABLES POPULATED SUCCESSFULLY!');
    console.log('============================================\n');
    
    // Show counts
    const counts = await sql`
      SELECT 
        (SELECT COUNT(*) FROM cruise_lines) as cruise_lines,
        (SELECT COUNT(*) FROM ships) as ships,
        (SELECT COUNT(*) FROM ports) as ports,
        (SELECT COUNT(*) FROM regions) as regions
    `;
    
    console.log('📊 Table Counts:');
    console.log(`   Cruise Lines: ${counts[0].cruise_lines}`);
    console.log(`   Ships: ${counts[0].ships}`);
    console.log(`   Ports: ${counts[0].ports}`);
    console.log(`   Regions: ${counts[0].regions}`);
    console.log('\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the script
populateReferenceTables().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});