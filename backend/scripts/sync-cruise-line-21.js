#!/usr/bin/env node

/**
 * Sync cruise line 21 data from Traveltek FTP
 * This will populate the database with cruises for line 21
 */

require('dotenv').config();
const ftp = require('basic-ftp');
const { Pool } = require('pg');

async function syncCruiseLine21() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  const client = new ftp.Client();
  
  console.log('🚀 Syncing cruise line 21 data from Traveltek...\n');
  
  try {
    // Connect to FTP
    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST,
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false
    });
    
    console.log('✅ Connected to FTP\n');
    
    // First, ensure cruise line 21 exists
    const lineCheckResult = await pool.query(
      'SELECT id, name FROM cruise_lines WHERE id = 21'
    );
    
    if (lineCheckResult.rowCount === 0) {
      console.log('Creating cruise line 21...');
      await pool.query(`
        INSERT INTO cruise_lines (id, name, code, logo_url, website_url, description, is_active)
        VALUES (21, 'Cruise Line 21', 'CL21', NULL, NULL, 'Cruise Line 21', true)
        ON CONFLICT (id) DO NOTHING
      `);
    }
    
    let totalCruisesAdded = 0;
    let totalFilesProcessed = 0;
    
    // Check last 3 months for cruise line 21 data
    const now = new Date();
    for (let monthOffset = 0; monthOffset <= 2; monthOffset++) {
      const checkDate = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
      const year = checkDate.getFullYear();
      const month = String(checkDate.getMonth() + 1).padStart(2, '0');
      const basePath = `${year}/${month}/21`;
      
      console.log(`📁 Checking ${basePath}...`);
      
      try {
        // List all ship directories for line 21
        const shipDirs = await client.list(basePath);
        const directories = shipDirs.filter(item => item.type === 2);
        
        console.log(`  Found ${directories.length} ship directories`);
        
        for (const dir of directories) {
          const shipId = parseInt(dir.name);
          const shipPath = `${basePath}/${dir.name}`;
          
          // Ensure ship exists
          const shipCheckResult = await pool.query(
            'SELECT id FROM ships WHERE id = $1',
            [shipId]
          );
          
          if (shipCheckResult.rowCount === 0) {
            await pool.query(`
              INSERT INTO ships (id, cruise_line_id, name, code, capacity, crew, tonnage, year_built, is_active)
              VALUES ($1, 21, $2, $3, 1000, 500, 50000, 2000, true)
              ON CONFLICT (id) DO NOTHING
            `, [shipId, `Ship ${shipId}`, `S${shipId}`]);
          }
          
          try {
            // Get cruise files
            const files = await client.list(shipPath);
            const jsonFiles = files.filter(f => f.name.endsWith('.json'));
            
            console.log(`    Ship ${shipId}: ${jsonFiles.length} cruise files`);
            
            // Process first 50 files per ship (for initial sync)
            const filesToProcess = jsonFiles.slice(0, 50);
            
            for (const file of filesToProcess) {
              const filePath = `${shipPath}/${file.name}`;
              const codetocruiseid = parseInt(file.name.replace('.json', ''));
              
              try {
                // Download and parse the file
                const buffer = await client.downloadToBuffer(filePath);
                const data = JSON.parse(buffer.toString());
                
                // Extract cruise data
                const cruiseData = {
                  id: codetocruiseid, // Use codetocruiseid as the id
                  cruise_id: String(data.cruiseid || codetocruiseid),
                  cruise_line_id: 21,
                  ship_id: shipId,
                  name: data.cruisename || data.cruisecode || `Cruise ${codetocruiseid}`,
                  voyage_code: data.cruisecode || null,
                  itinerary_code: data.itinerarycode || null,
                  sailing_date: data.saildate || data.startdate,
                  return_date: data.enddate || data.returndate,
                  nights: data.nights || data.duration || 7,
                  embarkation_port_id: data.embarkportid || null,
                  disembarkation_port_id: data.disembarkportid || null,
                  is_active: true
                };
                
                // Insert or update cruise
                const insertResult = await pool.query(`
                  INSERT INTO cruises (
                    id, cruise_id, cruise_line_id, ship_id, name, 
                    voyage_code, itinerary_code, sailing_date, return_date, nights,
                    embarkation_port_id, disembarkation_port_id, is_active,
                    interior_cheapest_price, oceanview_cheapest_price, 
                    balcony_cheapest_price, suite_cheapest_price,
                    needs_price_update, created_at, updated_at
                  ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                    $14, $15, $16, $17, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                  )
                  ON CONFLICT (id) DO UPDATE SET
                    interior_cheapest_price = EXCLUDED.interior_cheapest_price,
                    oceanview_cheapest_price = EXCLUDED.oceanview_cheapest_price,
                    balcony_cheapest_price = EXCLUDED.balcony_cheapest_price,
                    suite_cheapest_price = EXCLUDED.suite_cheapest_price,
                    updated_at = CURRENT_TIMESTAMP
                  RETURNING id
                `, [
                  cruiseData.id,
                  cruiseData.cruise_id,
                  cruiseData.cruise_line_id,
                  cruiseData.ship_id,
                  cruiseData.name,
                  cruiseData.voyage_code,
                  cruiseData.itinerary_code,
                  cruiseData.sailing_date,
                  cruiseData.return_date,
                  cruiseData.nights,
                  cruiseData.embarkation_port_id,
                  cruiseData.disembarkation_port_id,
                  cruiseData.is_active,
                  data.cheapestinside ? parseFloat(data.cheapestinside) : null,
                  data.cheapestoutside ? parseFloat(data.cheapestoutside) : null,
                  data.cheapestbalcony ? parseFloat(data.cheapestbalcony) : null,
                  data.cheapestsuite ? parseFloat(data.cheapestsuite) : null
                ]);
                
                if (insertResult.rowCount > 0) {
                  totalCruisesAdded++;
                  if (totalCruisesAdded % 10 === 0) {
                    process.stdout.write('.');
                  }
                }
                
                totalFilesProcessed++;
                
              } catch (err) {
                // Skip individual file errors
                continue;
              }
            }
            
            if (totalCruisesAdded > 0) {
              console.log(''); // New line after dots
            }
            
          } catch (err) {
            console.log(`    Error accessing ship ${shipId}: ${err.message}`);
          }
        }
        
      } catch (err) {
        console.log(`  Cannot access ${basePath}: ${err.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SYNC SUMMARY:');
    console.log(`  Files processed: ${totalFilesProcessed}`);
    console.log(`  Cruises added/updated: ${totalCruisesAdded}`);
    console.log('='.repeat(60));
    
    if (totalCruisesAdded > 0) {
      console.log('\n✅ Cruise line 21 sync completed successfully!');
      console.log('\nNow webhooks for line 21 will work properly.');
    } else {
      console.log('\n⚠️ No cruises were added. This might mean:');
      console.log('  - No data available for line 21 in FTP');
      console.log('  - Different directory structure for line 21');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.close();
    await pool.end();
  }
}

// Run the sync
syncCruiseLine21().catch(console.error);