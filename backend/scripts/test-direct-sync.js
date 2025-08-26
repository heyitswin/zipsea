#!/usr/bin/env node

/**
 * Test direct FTP sync for a single cruise
 */

require('dotenv').config();
const ftp = require('basic-ftp');

async function testDirectSync() {
  const { Pool } = require('pg');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  console.log('Testing direct FTP sync...\n');
  
  try {
    // Get a pending cruise
    const pendingResult = await pool.query(`
      SELECT cruise_id, cruise_line_id, ship_id, sailing_date 
      FROM cruises 
      WHERE needs_price_update = true 
      LIMIT 1
    `);
    
    if (pendingResult.rows.length === 0) {
      console.log('No pending cruises found');
      return;
    }
    
    const cruise = pendingResult.rows[0];
    console.log('Testing with cruise:', cruise);
    
    // Connect to FTP
    const client = new ftp.Client();
    client.ftp.verbose = true;
    
    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST,
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false
    });
    
    console.log('\n✅ FTP connected');
    
    // Try different path patterns
    const sailingDate = new Date(cruise.sailing_date);
    const year = sailingDate.getFullYear();
    const month = String(sailingDate.getMonth() + 1).padStart(2, '0');
    
    const paths = [
      `${year}/${month}/${cruise.cruise_line_id}/${cruise.ship_id}/${cruise.cruise_id}.json`,
      `2025/08/${cruise.cruise_line_id}/${cruise.ship_id}/${cruise.cruise_id}.json`,
      `2025/09/${cruise.cruise_line_id}/${cruise.ship_id}/${cruise.cruise_id}.json`,
    ];
    
    console.log('\nTrying paths:');
    let foundPath = null;
    let fileData = null;
    
    for (const path of paths) {
      console.log(`  Checking: ${path}`);
      try {
        const buffer = await client.downloadToBuffer(path);
        console.log(`    ✅ FOUND! Size: ${buffer.length} bytes`);
        foundPath = path;
        fileData = buffer.toString();
        break;
      } catch (err) {
        console.log(`    ❌ Not found`);
      }
    }
    
    client.close();
    
    if (foundPath) {
      console.log('\n✅ SUCCESS! File found at:', foundPath);
      
      // Parse JSON
      try {
        const data = JSON.parse(fileData);
        console.log('Cruise data keys:', Object.keys(data).slice(0, 10));
        
        // Check pricing data
        if (data.interior_cheapest_price || data.oceanview_cheapest_price || 
            data.balcony_cheapest_price || data.suite_cheapest_price) {
          console.log('\nPricing found:');
          console.log('  Interior:', data.interior_cheapest_price || 'N/A');
          console.log('  Oceanview:', data.oceanview_cheapest_price || 'N/A');
          console.log('  Balcony:', data.balcony_cheapest_price || 'N/A');
          console.log('  Suite:', data.suite_cheapest_price || 'N/A');
        }
        
        // Update cruise with pricing
        await pool.query(`
          UPDATE cruises 
          SET 
            interior_cheapest_price = $1,
            oceanview_cheapest_price = $2,
            balcony_cheapest_price = $3,
            suite_cheapest_price = $4,
            needs_price_update = false,
            updated_at = CURRENT_TIMESTAMP
          WHERE cruise_id = $5
        `, [
          data.interior_cheapest_price || null,
          data.oceanview_cheapest_price || null,
          data.balcony_cheapest_price || null,
          data.suite_cheapest_price || null,
          cruise.cruise_id
        ]);
        
        console.log('\n✅ Cruise updated successfully!');
        
      } catch (err) {
        console.error('Failed to parse JSON:', err.message);
      }
    } else {
      console.log('\n❌ Could not find cruise file in FTP');
      console.log('The file might be in a different month or not yet available');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

testDirectSync();