#!/usr/bin/env node

/**
 * Detailed diagnosis of sync failures
 * Shows exactly why each cruise fails to sync
 */

require('dotenv').config();
const FTP = require('ftp');
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

console.log('🔍 Detailed Sync Failure Diagnosis');
console.log('=====================================\n');

const ftpConfig = {
  host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
  user: process.env.TRAVELTEK_FTP_USER,
  password: process.env.TRAVELTEK_FTP_PASSWORD,
  port: 21,
  secure: false,
  connTimeout: 30000,
  pasvTimeout: 30000
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

// Data type converters
function toIntegerOrNull(value) {
  if (value === null || value === undefined || value === '' || value === 'system') {
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function toDecimalOrNull(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'object') {
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function parseArrayField(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => toIntegerOrNull(v)).filter(v => v !== null);
  if (typeof value === 'string') {
    return value.split(',').map(v => toIntegerOrNull(v.trim())).filter(v => v !== null);
  }
  return [];
}

async function testSyncSingleFile(client, filePath, cruiseData) {
  const errors = [];
  const warnings = [];
  
  try {
    // Check required fields
    if (!cruiseData.cruiseid) {
      errors.push('Missing cruiseid');
      return { success: false, errors, warnings };
    }
    
    // Parse IDs
    const cruiseId = toIntegerOrNull(cruiseData.cruiseid);
    if (!cruiseId) {
      errors.push(`Invalid cruiseid: ${cruiseData.cruiseid}`);
      return { success: false, errors, warnings };
    }
    
    // Check if already exists
    const existing = await db.execute(sql`
      SELECT id FROM cruises WHERE id = ${cruiseId} LIMIT 1
    `);
    
    if (existing.rows.length > 0) {
      warnings.push(`Cruise ${cruiseId} already exists`);
      return { success: false, reason: 'duplicate', warnings };
    }
    
    // Parse other IDs
    const lineId = toIntegerOrNull(cruiseData.lineid) || 1;
    const shipId = toIntegerOrNull(cruiseData.shipid) || 1;
    
    // Create dependencies
    await db.execute(sql`
      INSERT INTO cruise_lines (id, name, code, is_active)
      VALUES (${lineId}, ${'Line ' + lineId}, ${'L' + lineId}, true)
      ON CONFLICT DO NOTHING
    `);
    
    await db.execute(sql`
      INSERT INTO ships (id, cruise_line_id, name, code, is_active)
      VALUES (${shipId}, ${lineId}, ${'Ship ' + shipId}, ${'S' + shipId}, true)
      ON CONFLICT DO NOTHING
    `);
    
    // Handle ports
    const startPortId = toIntegerOrNull(cruiseData.startportid);
    const endPortId = toIntegerOrNull(cruiseData.endportid);
    const portIds = parseArrayField(cruiseData.portids);
    const regionIds = parseArrayField(cruiseData.regionids);
    
    // Create ports and regions
    const allPortIds = new Set([startPortId, endPortId, ...portIds].filter(id => id !== null));
    for (const portId of allPortIds) {
      await db.execute(sql`
        INSERT INTO ports (id, name, code, is_active)
        VALUES (${portId}, ${'Port ' + portId}, ${'P' + portId}, true)
        ON CONFLICT DO NOTHING
      `);
    }
    
    for (const regionId of regionIds) {
      await db.execute(sql`
        INSERT INTO regions (id, name, code, is_active)
        VALUES (${regionId}, ${'Region ' + regionId}, ${'R' + regionId}, true)
        ON CONFLICT DO NOTHING
      `);
    }
    
    // Parse dates
    const sailDate = cruiseData.saildate || cruiseData.startdate || new Date().toISOString();
    const nights = toIntegerOrNull(cruiseData.nights) || 0;
    const returnDate = new Date(sailDate);
    returnDate.setDate(returnDate.getDate() + nights);
    
    // Insert cruise
    await db.execute(sql`
      INSERT INTO cruises (
        id, code_to_cruise_id, cruise_line_id, ship_id, name,
        sailing_date, return_date, nights,
        embark_port_id, disembark_port_id,
        market_id, owner_id,
        region_ids, port_ids,
        show_cruise, is_active, currency,
        traveltek_file_path
      ) VALUES (
        ${cruiseId},
        ${cruiseData.codetocruiseid || String(cruiseId)},
        ${lineId},
        ${shipId},
        ${cruiseData.name || 'Cruise ' + cruiseId},
        ${sailDate},
        ${returnDate.toISOString()},
        ${nights},
        ${startPortId},
        ${endPortId},
        ${toIntegerOrNull(cruiseData.marketid)},
        ${toIntegerOrNull(cruiseData.ownerid)},
        ${JSON.stringify(regionIds)},
        ${JSON.stringify(Array.from(allPortIds))},
        ${cruiseData.showcruise !== false},
        true,
        ${'USD'},
        ${filePath}
      )
    `);
    
    return { success: true };
    
  } catch (error) {
    errors.push(error.message);
    return { success: false, errors, warnings };
  }
}

async function diagnose() {
  const client = new FTP();
  
  return new Promise((resolve, reject) => {
    client.on('ready', async () => {
      console.log('✅ Connected to FTP\n');
      
      try {
        // Test with a small sample
        const testPaths = [
          '2025/1/1/180',    // January, line 1
          '2025/1/7/265',    // January, line 7 (Royal Caribbean)
          '2025/2/1/2649',   // February, line 1
        ];
        
        let totalTested = 0;
        let successful = 0;
        let duplicates = 0;
        let failed = 0;
        const failureDetails = {};
        
        for (const basePath of testPaths) {
          console.log(`\n📂 Testing ${basePath}...`);
          
          try {
            const files = await listDirectory(client, basePath);
            const jsonFiles = files.filter(f => f.type === '-' && f.name.endsWith('.json'));
            
            console.log(`   Found ${jsonFiles.length} JSON files`);
            
            // Test first 5 files
            for (const file of jsonFiles.slice(0, 5)) {
              const filePath = `${basePath}/${file.name}`;
              totalTested++;
              
              try {
                const jsonContent = await downloadFile(client, filePath);
                const cruiseData = JSON.parse(jsonContent);
                
                if (!cruiseData.codetocruiseid) {
                  cruiseData.codetocruiseid = file.name.replace('.json', '');
                }
                
                const result = await testSyncSingleFile(client, filePath, cruiseData);
                
                if (result.success) {
                  successful++;
                  console.log(`   ✅ ${file.name}: Success`);
                } else if (result.reason === 'duplicate') {
                  duplicates++;
                  console.log(`   ⚠️  ${file.name}: Already exists`);
                } else {
                  failed++;
                  console.log(`   ❌ ${file.name}: Failed`);
                  if (result.errors && result.errors.length > 0) {
                    console.log(`      Errors: ${result.errors.join(', ')}`);
                    
                    // Track error types
                    result.errors.forEach(err => {
                      const key = err.substring(0, 50);
                      failureDetails[key] = (failureDetails[key] || 0) + 1;
                    });
                  }
                }
                
              } catch (error) {
                failed++;
                console.log(`   ❌ ${file.name}: ${error.message}`);
                const key = error.message.substring(0, 50);
                failureDetails[key] = (failureDetails[key] || 0) + 1;
              }
            }
            
          } catch (err) {
            console.log(`   ❌ Cannot access: ${err.message}`);
          }
        }
        
        // Print summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 DIAGNOSIS SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Successful: ${successful}`);
        console.log(`⚠️  Duplicates: ${duplicates}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📁 Total tested: ${totalTested}`);
        
        if (Object.keys(failureDetails).length > 0) {
          console.log('\n🔍 COMMON FAILURE REASONS:');
          console.log('─'.repeat(40));
          
          const sorted = Object.entries(failureDetails)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
          
          sorted.forEach(([error, count]) => {
            console.log(`   ${count}x: ${error}`);
          });
        }
        
        console.log('\n💡 RECOMMENDATIONS:');
        console.log('─'.repeat(40));
        
        if (duplicates > 0) {
          console.log('• Many duplicates found - database may already have data');
          console.log('• Check with: SELECT COUNT(*) FROM cruises;');
        }
        
        if (failed > 0) {
          console.log('• Failures may be due to data type issues');
          console.log('• Check the specific error messages above');
          console.log('• May need to update data converters');
        }
        
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
diagnose()
  .then(() => {
    console.log('\n✨ Diagnosis complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal:', error.message);
    process.exit(1);
  });