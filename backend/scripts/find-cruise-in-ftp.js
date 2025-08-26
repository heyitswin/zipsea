#!/usr/bin/env node

/**
 * Search all FTP directories to find a specific cruise file
 */

require('dotenv').config();
const ftp = require('basic-ftp');

async function findCruiseFile() {
  const cruiseId = process.argv[2] || '356117';
  const lineId = process.argv[3] || '3';
  const shipId = process.argv[4] || '1049';
  
  console.log(`Searching for cruise ${cruiseId} (Line: ${lineId}, Ship: ${shipId})...\n`);
  
  const client = new ftp.Client();
  
  try {
    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST,
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false
    });
    
    console.log('✅ Connected to FTP\n');
    
    // Search through all year directories
    const years = ['2024', '2025', '2026'];
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    
    for (const year of years) {
      console.log(`Checking year ${year}...`);
      
      for (const month of months) {
        // Try with ship ID
        const pathWithShip = `${year}/${month}/${lineId}/${shipId}/${cruiseId}.json`;
        
        try {
          const size = await client.size(pathWithShip);
          console.log(`\n✅ FOUND! ${pathWithShip} (${size} bytes)`);
          
          // Download and show some content
          const buffer = await client.downloadToBuffer(pathWithShip);
          const data = JSON.parse(buffer.toString());
          
          console.log('\nFile details:');
          console.log('  Cruise ID:', data.cruiseid || data.cruiseId);
          console.log('  Ship:', data.shipname || data.shipName);
          console.log('  Sailing Date:', data.sailingdate || data.sailingDate);
          console.log('  Duration:', data.duration);
          
          if (data.interior_cheapest_price || data.oceanview_cheapest_price) {
            console.log('\nPricing:');
            console.log('  Interior:', data.interior_cheapest_price || 'N/A');
            console.log('  Oceanview:', data.oceanview_cheapest_price || 'N/A');
            console.log('  Balcony:', data.balcony_cheapest_price || 'N/A');
            console.log('  Suite:', data.suite_cheapest_price || 'N/A');
          }
          
          client.close();
          return;
        } catch (err) {
          // File not found, continue searching
        }
        
        // Try without ship ID
        const pathWithoutShip = `${year}/${month}/${lineId}/${cruiseId}.json`;
        
        try {
          const size = await client.size(pathWithoutShip);
          console.log(`\n✅ FOUND! ${pathWithoutShip} (${size} bytes)`);
          
          const buffer = await client.downloadToBuffer(pathWithoutShip);
          const data = JSON.parse(buffer.toString());
          
          console.log('\nFile details:');
          console.log('  Cruise ID:', data.cruiseid || data.cruiseId);
          console.log('  Ship:', data.shipname || data.shipName);
          console.log('  Sailing Date:', data.sailingdate || data.sailingDate);
          
          client.close();
          return;
        } catch (err) {
          // Continue searching
        }
      }
    }
    
    console.log('\n❌ Cruise file not found in any year/month combination');
    console.log('The file might:');
    console.log('  - Be in a different structure');
    console.log('  - Not exist yet');
    console.log('  - Have been deleted');
    
    // Try listing one directory to see structure
    console.log('\nChecking directory structure...');
    try {
      const list = await client.list(`2025/08/${lineId}`);
      if (list.length > 0) {
        console.log(`\nFound ${list.length} items in 2025/08/${lineId}:`);
        list.slice(0, 5).forEach(item => {
          console.log(`  ${item.type === 2 ? '[DIR]' : '[FILE]'} ${item.name}`);
        });
      }
    } catch (err) {
      console.log('Could not list directory');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.close();
  }
}

findCruiseFile();