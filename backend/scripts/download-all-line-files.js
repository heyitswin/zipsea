#!/usr/bin/env node

/**
 * Download ALL files for a cruise line from recent FTP directories
 * This is how we should handle webhook updates - get everything for the line
 */

require('dotenv').config();
const ftp = require('basic-ftp');
const fs = require('fs').promises;
const path = require('path');

async function downloadAllLineFiles() {
  const lineId = process.argv[2] || '3';
  const { Pool } = require('pg');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  console.log(`Downloading ALL files for cruise line ${lineId}...\n`);
  
  const client = new ftp.Client();
  
  try {
    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST,
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false
    });
    
    console.log('✅ Connected to FTP\n');
    
    // Get current date
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Check last 2 months (where updated files likely are)
    const pathsToCheck = [];
    for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
      const checkDate = new Date(currentYear, currentMonth - monthOffset - 1, 1);
      const year = checkDate.getFullYear();
      const month = String(checkDate.getMonth() + 1).padStart(2, '0');
      pathsToCheck.push(`${year}/${month}/${lineId}`);
    }
    
    let totalFiles = 0;
    let downloadedFiles = [];
    
    for (const basePath of pathsToCheck) {
      console.log(`Checking ${basePath}...`);
      
      try {
        // List all ship directories
        const shipDirs = await client.list(basePath);
        const directories = shipDirs.filter(item => item.type === 2);
        
        console.log(`  Found ${directories.length} ship directories`);
        
        for (const dir of directories) {
          const shipPath = `${basePath}/${dir.name}`;
          
          try {
            // List all cruise files in this ship directory
            const files = await client.list(shipPath);
            const jsonFiles = files.filter(f => f.name.endsWith('.json'));
            
            console.log(`    Ship ${dir.name}: ${jsonFiles.length} cruise files`);
            
            // Download a sample of files (first 5 for demo)
            const samplesToDownload = jsonFiles.slice(0, 5);
            
            for (const file of samplesToDownload) {
              const filePath = `${shipPath}/${file.name}`;
              
              try {
                const buffer = await client.downloadToBuffer(filePath);
                const data = JSON.parse(buffer.toString());
                
                // Extract key info
                const codetocruiseid = file.name.replace('.json', '');
                const cruiseid = data.cruiseid;
                const sailingDate = data.saildate || data.startdate;
                
                downloadedFiles.push({
                  codetocruiseid,
                  cruiseid,
                  sailingDate,
                  shipId: dir.name,
                  path: filePath
                });
                
                totalFiles++;
              } catch (err) {
                console.log(`      Failed to download ${file.name}`);
              }
            }
            
            if (jsonFiles.length > 5) {
              console.log(`      (${jsonFiles.length - 5} more files available)`);
            }
          } catch (err) {
            console.log(`    Could not list ship directory ${dir.name}`);
          }
        }
      } catch (err) {
        console.log(`  Directory ${basePath} not accessible`);
      }
    }
    
    console.log(`\n📊 Downloaded ${totalFiles} sample files`);
    
    if (downloadedFiles.length > 0) {
      console.log('\nSample cruise mappings:');
      console.log('codetocruiseid (filename) -> cruiseid -> sailing date');
      downloadedFiles.slice(0, 10).forEach(file => {
        console.log(`  ${file.codetocruiseid} -> ${file.cruiseid} -> ${file.sailingDate}`);
      });
      
      // Check if these exist in our database
      console.log('\nChecking database matches...');
      for (const file of downloadedFiles.slice(0, 5)) {
        const result = await pool.query(`
          SELECT id, cruise_id, sailing_date 
          FROM cruises 
          WHERE cruise_id = $1 
            AND DATE(sailing_date) = DATE($2)
          LIMIT 1
        `, [String(file.cruiseid), file.sailingDate]);
        
        if (result.rows.length > 0) {
          const row = result.rows[0];
          console.log(`  ✅ Found: DB id=${row.id}, cruise_id=${row.cruise_id}, but FTP uses ${file.codetocruiseid}`);
          
          if (row.id != file.codetocruiseid) {
            console.log(`     ⚠️  ID MISMATCH: DB has id=${row.id} but should be ${file.codetocruiseid}`);
          }
        } else {
          console.log(`  ❌ Not found: cruiseid=${file.cruiseid}, date=${file.sailingDate}`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('CONCLUSION:');
    console.log('1. FTP has hundreds/thousands of files per cruise line');
    console.log('2. Files are named with codetocruiseid (e.g., 2148740.json)');
    console.log('3. Our database id column should match these codetocruiseid values');
    console.log('4. When webhook fires, we need to download ALL files for the line');
    console.log('5. Then match by cruiseid + sailing date to update the right records');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.close();
    await pool.end();
  }
}

downloadAllLineFiles();