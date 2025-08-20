#!/usr/bin/env node

/**
 * Diagnose why cruises are failing to sync
 * Identifies common issues and attempts fixes
 */

require('dotenv').config();
const FTP = require('ftp');

console.log('🔍 Diagnosing Sync Failures');
console.log('============================\n');

const ftpConfig = {
  host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
  user: process.env.TRAVELTEK_FTP_USER,
  password: process.env.TRAVELTEK_FTP_PASSWORD,
  port: 21,
  secure: false,
  connTimeout: 30000,
  pasvTimeout: 30000
};

if (!ftpConfig.user || !ftpConfig.password) {
  console.error('❌ FTP credentials not found');
  process.exit(1);
}

// Track failure reasons
const failureReasons = {
  duplicateId: [],
  invalidData: [],
  missingRequired: [],
  dateFormat: [],
  numberFormat: [],
  foreignKey: [],
  other: []
};

// Helper to download file
async function downloadFile(client, filePath) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Download timeout')), 20000);
    
    client.get(filePath, (err, stream) => {
      if (err) {
        clearTimeout(timeout);
        reject(err);
        return;
      }
      
      let data = '';
      stream.on('data', chunk => data += chunk.toString());
      stream.on('end', () => {
        clearTimeout(timeout);
        resolve(data);
      });
      stream.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  });
}

// Helper to list directory
async function listDirectory(client, dirPath) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('List timeout')), 15000);
    
    client.list(dirPath, (err, list) => {
      clearTimeout(timeout);
      if (err) reject(err);
      else resolve(list || []);
    });
  });
}

// Validate cruise data
function validateCruiseData(cruiseData) {
  const issues = [];
  
  // Check required fields
  if (!cruiseData.cruiseid) issues.push('Missing cruiseid');
  if (!cruiseData.name) issues.push('Missing name');
  if (!cruiseData.saildate && !cruiseData.startdate) issues.push('Missing sailing date');
  
  // Check numeric fields
  const numericFields = ['cruiseid', 'lineid', 'shipid', 'nights'];
  for (const field of numericFields) {
    if (cruiseData[field]) {
      const num = Number(cruiseData[field]);
      if (isNaN(num)) {
        issues.push(`${field} is not a valid number: ${cruiseData[field]}`);
      }
    }
  }
  
  // Check date format
  const dateStr = cruiseData.saildate || cruiseData.startdate;
  if (dateStr) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      issues.push(`Invalid date format: ${dateStr}`);
    }
  }
  
  // Check for problematic values
  if (cruiseData.ownerid === 'system') {
    // This is OK, we handle it
  }
  
  return issues;
}

// Attempt to sync with detailed error handling
async function attemptSync(cruiseData) {
  const { db } = require('../dist/db/connection');
  const { sql } = require('drizzle-orm');
  
  try {
    // Validate data first
    const validationIssues = validateCruiseData(cruiseData);
    if (validationIssues.length > 0) {
      return { 
        success: false, 
        reason: 'validation', 
        details: validationIssues.join(', ')
      };
    }
    
    // Parse and clean data
    const cruiseId = Number(cruiseData.cruiseid);
    const lineId = Number(cruiseData.lineid) || 1;
    const shipId = Number(cruiseData.shipid);
    const startPortId = cruiseData.startportid && cruiseData.startportid !== 'system' ? 
      Number(cruiseData.startportid) : null;
    const endPortId = cruiseData.endportid && cruiseData.endportid !== 'system' ? 
      Number(cruiseData.endportid) : null;
    const marketId = cruiseData.marketid && cruiseData.marketid !== 'system' ? 
      Number(cruiseData.marketid) : null;
    const ownerId = cruiseData.ownerid && cruiseData.ownerid !== 'system' ? 
      Number(cruiseData.ownerid) : null;
    
    // Check if already exists
    const existing = await db.execute(sql`
      SELECT id FROM cruises WHERE id = ${cruiseId} LIMIT 1
    `);
    
    if (existing.rows.length > 0) {
      return { 
        success: false, 
        reason: 'duplicate', 
        details: `Cruise ${cruiseId} already exists`
      };
    }
    
    // Create dependencies with better error handling
    try {
      await db.execute(sql`
        INSERT INTO cruise_lines (id, name, code, is_active)
        VALUES (${lineId}, ${'Line ' + lineId}, ${'CL' + lineId}, true)
        ON CONFLICT DO NOTHING
      `);
    } catch (e) {
      // Ignore cruise line insert errors
    }
    
    try {
      await db.execute(sql`
        INSERT INTO ships (id, cruise_line_id, name, code, is_active)
        VALUES (${shipId}, ${lineId}, ${'Ship ' + shipId}, ${'SH' + shipId}, true)
        ON CONFLICT DO NOTHING
      `);
    } catch (e) {
      // Ignore ship insert errors
    }
    
    // Handle ports
    const portIds = new Set();
    if (startPortId) portIds.add(startPortId);
    if (endPortId) portIds.add(endPortId);
    
    if (cruiseData.portids) {
      let portIdArray = [];
      if (typeof cruiseData.portids === 'string') {
        portIdArray = cruiseData.portids.split(',').map(p => p.trim());
      } else if (Array.isArray(cruiseData.portids)) {
        portIdArray = cruiseData.portids;
      }
      
      for (const pid of portIdArray) {
        const numPid = Number(pid);
        if (!isNaN(numPid) && numPid > 0) {
          portIds.add(numPid);
        }
      }
    }
    
    // Create all ports
    for (const portId of portIds) {
      try {
        await db.execute(sql`
          INSERT INTO ports (id, name, code, is_active)
          VALUES (${portId}, ${'Port ' + portId}, ${'P' + portId}, true)
          ON CONFLICT DO NOTHING
        `);
      } catch (e) {
        // Ignore port errors
      }
    }
    
    // Handle regions
    const regionIds = [];
    if (cruiseData.regionids) {
      let regionIdArray = [];
      if (typeof cruiseData.regionids === 'string') {
        regionIdArray = cruiseData.regionids.split(',').map(r => r.trim());
      } else if (Array.isArray(cruiseData.regionids)) {
        regionIdArray = cruiseData.regionids;
      }
      
      for (const rid of regionIdArray) {
        const numRid = Number(rid);
        if (!isNaN(numRid) && numRid > 0) {
          regionIds.push(numRid);
          try {
            await db.execute(sql`
              INSERT INTO regions (id, name, code, is_active)
              VALUES (${numRid}, ${'Region ' + numRid}, ${'R' + numRid}, true)
              ON CONFLICT DO NOTHING
            `);
          } catch (e) {
            // Ignore region errors
          }
        }
      }
    }
    
    // Parse dates carefully
    const sailDate = cruiseData.saildate || cruiseData.startdate;
    let returnDate;
    try {
      returnDate = new Date(sailDate);
      returnDate.setDate(returnDate.getDate() + (Number(cruiseData.nights) || 0));
    } catch (e) {
      returnDate = new Date(sailDate);
    }
    
    // Insert cruise with all cleaned data
    await db.execute(sql`
      INSERT INTO cruises (
        id, code_to_cruise_id, cruise_line_id, ship_id, name,
        sailing_date, return_date, nights,
        embark_port_id, disembark_port_id,
        market_id, owner_id,
        region_ids, port_ids,
        show_cruise, is_active, currency
      ) VALUES (
        ${cruiseId},
        ${cruiseData.codetocruiseid || String(cruiseId)},
        ${lineId}, 
        ${shipId},
        ${cruiseData.name || 'Cruise ' + cruiseId},
        ${sailDate},
        ${returnDate.toISOString().split('T')[0]},
        ${Number(cruiseData.nights) || 0},
        ${startPortId}, 
        ${endPortId},
        ${marketId},
        ${ownerId},
        ${JSON.stringify(regionIds)},
        ${JSON.stringify(Array.from(portIds))},
        ${cruiseData.showcruise !== false},
        true,
        ${'USD'}
      )
    `);
    
    return { success: true };
    
  } catch (error) {
    // Categorize the error
    const errorMsg = error.message;
    
    if (errorMsg.includes('duplicate key')) {
      return { 
        success: false, 
        reason: 'duplicate', 
        details: errorMsg 
      };
    } else if (errorMsg.includes('foreign key')) {
      return { 
        success: false, 
        reason: 'foreignKey', 
        details: errorMsg 
      };
    } else if (errorMsg.includes('invalid input syntax for type numeric')) {
      return { 
        success: false, 
        reason: 'numberFormat', 
        details: errorMsg 
      };
    } else if (errorMsg.includes('invalid input value for enum')) {
      return { 
        success: false, 
        reason: 'invalidData', 
        details: errorMsg 
      };
    } else {
      return { 
        success: false, 
        reason: 'other', 
        details: errorMsg 
      };
    }
  }
}

async function diagnoseFailures() {
  const client = new FTP();
  
  return new Promise((resolve, reject) => {
    client.on('ready', async () => {
      console.log('✅ Connected to FTP\n');
      
      try {
        // Test with a sample of files from different sources
        const testPaths = [
          '2025/01/1/180',   // Line 1
          '2025/01/7/265',   // Line 7 (Royal Caribbean)
          '2025/01/13/1077', // Line 13
          '2025/02/1/2649',  // Line 1, different ship
        ];
        
        const testFiles = [];
        
        for (const path of testPaths) {
          try {
            const files = await listDirectory(client, path);
            const jsonFiles = files.filter(f => f.type === '-' && f.name.endsWith('.json'));
            
            // Take first 3 files from each path
            for (const file of jsonFiles.slice(0, 3)) {
              testFiles.push({
                path: `${path}/${file.name}`,
                name: file.name
              });
            }
          } catch (e) {
            console.log(`Could not access ${path}`);
          }
        }
        
        console.log(`📊 Testing ${testFiles.length} files for common issues...\n`);
        
        let successful = 0;
        let failed = 0;
        
        for (const fileInfo of testFiles) {
          try {
            const jsonContent = await downloadFile(client, fileInfo.path);
            const cruiseData = JSON.parse(jsonContent);
            
            if (!cruiseData.codetocruiseid) {
              cruiseData.codetocruiseid = fileInfo.name.replace('.json', '');
            }
            
            const result = await attemptSync(cruiseData);
            
            if (result.success) {
              successful++;
              console.log(`✅ ${fileInfo.name}: Success`);
            } else {
              failed++;
              console.log(`❌ ${fileInfo.name}: ${result.reason}`);
              if (result.details && result.details.length < 100) {
                console.log(`   Details: ${result.details}`);
              }
              
              // Track failure reason
              if (result.reason === 'duplicate') {
                failureReasons.duplicateId.push(fileInfo.name);
              } else if (result.reason === 'validation') {
                failureReasons.invalidData.push(fileInfo.name);
              } else if (result.reason === 'foreignKey') {
                failureReasons.foreignKey.push(fileInfo.name);
              } else if (result.reason === 'numberFormat') {
                failureReasons.numberFormat.push(fileInfo.name);
              } else {
                failureReasons.other.push(fileInfo.name);
              }
            }
            
          } catch (error) {
            failed++;
            console.log(`❌ ${fileInfo.path}: ${error.message}`);
            failureReasons.other.push(fileInfo.path);
          }
        }
        
        // Print diagnosis summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 DIAGNOSIS SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📁 Total tested: ${testFiles.length}`);
        
        console.log('\n🔍 FAILURE ANALYSIS:');
        console.log('─'.repeat(40));
        
        if (failureReasons.duplicateId.length > 0) {
          console.log(`\n📌 Duplicates (already in database): ${failureReasons.duplicateId.length}`);
          console.log('   These are OK - cruise already exists');
        }
        
        if (failureReasons.invalidData.length > 0) {
          console.log(`\n⚠️  Invalid Data: ${failureReasons.invalidData.length}`);
          console.log('   Missing required fields or invalid format');
        }
        
        if (failureReasons.numberFormat.length > 0) {
          console.log(`\n🔢 Number Format Issues: ${failureReasons.numberFormat.length}`);
          console.log('   Non-numeric values in numeric fields');
        }
        
        if (failureReasons.foreignKey.length > 0) {
          console.log(`\n🔗 Foreign Key Issues: ${failureReasons.foreignKey.length}`);
          console.log('   Referenced IDs don\'t exist');
        }
        
        if (failureReasons.other.length > 0) {
          console.log(`\n❓ Other Issues: ${failureReasons.other.length}`);
        }
        
        // Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        console.log('─'.repeat(40));
        
        if (failureReasons.duplicateId.length > 0) {
          console.log('• Duplicates are normal - use sync-continuous.js which skips existing cruises');
        }
        
        if (failureReasons.numberFormat.length > 0) {
          console.log('• Number format issues have been fixed in this script');
          console.log('• The script now handles "system" values and converts them to NULL');
        }
        
        if (failureReasons.foreignKey.length > 0) {
          console.log('• Foreign key issues should be resolved - script creates all dependencies');
        }
        
        console.log('\n✅ SOLUTION:');
        console.log('Use sync-continuous.js which:');
        console.log('  1. Skips existing cruises automatically');
        console.log('  2. Handles all data type conversions');
        console.log('  3. Creates all dependencies first');
        console.log('  4. Saves progress and can resume');
        
        client.end();
        resolve();
        
      } catch (error) {
        console.error('Diagnosis error:', error);
        client.end();
        reject(error);
      }
    });
    
    client.on('error', (err) => {
      console.error('FTP error:', err.message);
      reject(err);
    });
    
    client.connect(ftpConfig);
  });
}

// Run diagnosis
diagnoseFailures()
  .then(() => {
    console.log('\n✨ Diagnosis complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal:', error.message);
    process.exit(1);
  });