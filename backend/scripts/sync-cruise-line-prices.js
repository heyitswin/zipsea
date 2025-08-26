#!/usr/bin/env node

/**
 * Sync all cruise prices for a specific cruise line
 * This is the correct approach for handling webhook updates
 */

require('dotenv').config();
const ftp = require('basic-ftp');
const { Pool } = require('pg');

async function syncCruiseLinePrices(lineId = 3) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  console.log(`\n🚀 Syncing prices for cruise line ${lineId}\n`);
  console.log('=' .repeat(60));
  
  const client = new ftp.Client();
  let stats = {
    filesFound: 0,
    filesProcessed: 0,
    cruisesUpdated: 0,
    cruisesNotFound: 0,
    errors: 0
  };
  
  try {
    // Connect to FTP
    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST,
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false
    });
    
    console.log('✅ Connected to FTP\n');
    
    // Get current date for checking recent directories
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Check last 2 months (most recent updates)
    for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
      const checkDate = new Date(currentYear, currentMonth - monthOffset - 1, 1);
      const year = checkDate.getFullYear();
      const month = String(checkDate.getMonth() + 1).padStart(2, '0');
      const basePath = `${year}/${month}/${lineId}`;
      
      console.log(`📁 Processing ${basePath}...`);
      
      try {
        // Get all ship directories
        const shipDirs = await client.list(basePath);
        const directories = shipDirs.filter(item => item.type === 2);
        
        for (const dir of directories) {
          const shipPath = `${basePath}/${dir.name}`;
          const shipId = parseInt(dir.name);
          
          try {
            // Get all cruise files for this ship
            const files = await client.list(shipPath);
            const jsonFiles = files.filter(f => f.name.endsWith('.json'));
            stats.filesFound += jsonFiles.length;
            
            console.log(`  Ship ${shipId}: ${jsonFiles.length} files`);
            
            // Process each file
            for (const file of jsonFiles) {
              const filePath = `${shipPath}/${file.name}`;
              const codetocruiseid = parseInt(file.name.replace('.json', ''));
              
              try {
                // Download the file
                const stream = await client.downloadToBuffer(filePath);
                const data = JSON.parse(stream.toString());
                
                // Extract key data
                const cruiseid = String(data.cruiseid);
                const sailingDate = data.saildate || data.startdate;
                const prices = {
                  interior: null,
                  oceanview: null,
                  balcony: null,
                  suite: null
                };
                
                // Extract cheapest prices
                if (data.cheapestinside) {
                  prices.interior = parseFloat(data.cheapestinside);
                }
                if (data.cheapestoutside) {
                  prices.oceanview = parseFloat(data.cheapestoutside);
                }
                if (data.cheapestbalcony) {
                  prices.balcony = parseFloat(data.cheapestbalcony);
                }
                if (data.cheapestsuite) {
                  prices.suite = parseFloat(data.cheapestsuite);
                }
                
                // Also check cached prices
                if (data.cachedprices) {
                  if (data.cachedprices.inside && !prices.interior) {
                    prices.interior = parseFloat(data.cachedprices.inside);
                  }
                  if (data.cachedprices.outside && !prices.oceanview) {
                    prices.oceanview = parseFloat(data.cachedprices.outside);
                  }
                  if (data.cachedprices.balcony && !prices.balcony) {
                    prices.balcony = parseFloat(data.cachedprices.balcony);
                  }
                  if (data.cachedprices.suite && !prices.suite) {
                    prices.suite = parseFloat(data.cachedprices.suite);
                  }
                }
                
                // Update database
                // First try to match by id (if we have correct codetocruiseid)
                let updateResult = await pool.query(`
                  UPDATE cruises
                  SET 
                    interior_cheapest_price = $1,
                    oceanview_cheapest_price = $2,
                    balcony_cheapest_price = $3,
                    suite_cheapest_price = $4,
                    needs_price_update = false,
                    updated_at = CURRENT_TIMESTAMP
                  WHERE id = $5
                  RETURNING id
                `, [prices.interior, prices.oceanview, prices.balcony, prices.suite, codetocruiseid]);
                
                if (updateResult.rowCount === 0) {
                  // If not found by id, try matching by cruise_id + sailing_date
                  updateResult = await pool.query(`
                    UPDATE cruises
                    SET 
                      interior_cheapest_price = $1,
                      oceanview_cheapest_price = $2,
                      balcony_cheapest_price = $3,
                      suite_cheapest_price = $4,
                      needs_price_update = false,
                      updated_at = CURRENT_TIMESTAMP
                    WHERE cruise_id = $5 
                      AND DATE(sailing_date) = DATE($6)
                      AND cruise_line_id = $7
                    RETURNING id
                  `, [prices.interior, prices.oceanview, prices.balcony, prices.suite, 
                      cruiseid, sailingDate, lineId]);
                }
                
                if (updateResult.rowCount > 0) {
                  stats.cruisesUpdated++;
                  if (stats.cruisesUpdated % 10 === 0) {
                    process.stdout.write(`✓`);
                  }
                } else {
                  stats.cruisesNotFound++;
                }
                
                stats.filesProcessed++;
                
              } catch (err) {
                stats.errors++;
                // Continue processing other files
              }
            }
            
            console.log(''); // New line after progress dots
            
          } catch (err) {
            console.log(`    Error accessing ship ${shipId}: ${err.message}`);
          }
        }
        
      } catch (err) {
        console.log(`  Cannot access ${basePath}: ${err.message}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
  } finally {
    client.close();
    await pool.end();
  }
  
  // Print summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 SYNC SUMMARY:');
  console.log(`  Files found: ${stats.filesFound}`);
  console.log(`  Files processed: ${stats.filesProcessed}`);
  console.log(`  Cruises updated: ${stats.cruisesUpdated}`);
  console.log(`  Cruises not found: ${stats.cruisesNotFound}`);
  console.log(`  Errors: ${stats.errors}`);
  console.log('=' .repeat(60));
  
  if (stats.cruisesUpdated > 0) {
    console.log('\n✅ Price sync completed successfully!');
  } else {
    console.log('\n⚠️  No cruises were updated. This might indicate:');
    console.log('  - ID mismatch between database and FTP');
    console.log('  - Cruises not in database yet');
    console.log('  - Different date formats');
  }
}

// Run the sync
const lineId = process.argv[2] ? parseInt(process.argv[2]) : 3;
syncCruiseLinePrices(lineId).catch(console.error);