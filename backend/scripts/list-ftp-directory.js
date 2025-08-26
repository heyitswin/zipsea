#!/usr/bin/env node

/**
 * List files in a specific FTP directory
 */

require('dotenv').config();
const ftp = require('basic-ftp');

async function listDirectory() {
  const path = process.argv[2] || '2025/08/3/1049';
  
  console.log(`Listing directory: ${path}\n`);
  
  const client = new ftp.Client();
  
  try {
    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST,
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false
    });
    
    console.log('✅ Connected to FTP\n');
    
    try {
      const list = await client.list(path);
      
      if (list.length === 0) {
        console.log('Directory is empty or does not exist');
      } else {
        console.log(`Found ${list.length} items:\n`);
        
        // Sort by name
        list.sort((a, b) => a.name.localeCompare(b.name));
        
        // Show first 20 files
        const toShow = list.slice(0, 50);
        toShow.forEach(item => {
          const type = item.type === 2 ? '[DIR]' : '[FILE]';
          const size = item.type === 1 ? `(${item.size} bytes)` : '';
          console.log(`  ${type} ${item.name} ${size}`);
        });
        
        if (list.length > 50) {
          console.log(`  ... and ${list.length - 50} more items`);
        }
        
        // Check if our cruise exists
        const cruiseFile = list.find(item => item.name === '356117.json');
        if (cruiseFile) {
          console.log('\n✅ Found cruise 356117.json!');
        } else {
          console.log('\n❌ Cruise 356117.json not found in this directory');
          
          // Show some sample cruise IDs to understand the pattern
          const jsonFiles = list.filter(item => item.name.endsWith('.json'));
          if (jsonFiles.length > 0) {
            console.log('\nSample cruise files in this directory:');
            jsonFiles.slice(0, 5).forEach(file => {
              console.log(`  - ${file.name}`);
            });
          }
        }
      }
    } catch (err) {
      console.log(`Error listing directory: ${err.message}`);
      
      // Try parent directory
      const parentPath = path.substring(0, path.lastIndexOf('/'));
      console.log(`\nTrying parent directory: ${parentPath}`);
      
      try {
        const parentList = await client.list(parentPath);
        console.log(`\nParent directory contains ${parentList.length} items:`);
        parentList.forEach(item => {
          const type = item.type === 2 ? '[DIR]' : '[FILE]';
          console.log(`  ${type} ${item.name}`);
        });
      } catch (err2) {
        console.log('Could not list parent directory either');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.close();
  }
}

listDirectory();