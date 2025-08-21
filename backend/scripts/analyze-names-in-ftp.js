#!/usr/bin/env node

/**
 * Analyze FTP data to find where the real cruise line and ship names are stored
 */

const ftp = require('basic-ftp');
const path = require('path');
require('dotenv').config();

const FTP_HOST = process.env.FTP_HOST || 'ftpeu1prod.traveltek.net';
const FTP_USER = process.env.FTP_USER;
const FTP_PASS = process.env.FTP_PASS;

if (!FTP_USER || !FTP_PASS) {
  console.error('❌ FTP credentials not found in environment variables');
  process.exit(1);
}

const ftpClient = new ftp.Client();
ftpClient.ftp.verbose = false;

async function connectToFTP() {
  try {
    await ftpClient.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASS,
      secure: false,
      secureOptions: { rejectUnauthorized: false }
    });
    console.log('✅ Connected to FTP server');
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to FTP:', error.message);
    return false;
  }
}

function findNameFields(obj, path = '', depth = 0) {
  const results = [];
  if (depth > 5) return results; // Prevent infinite recursion
  
  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      const newPath = path ? `${path}.${key}` : key;
      const value = obj[key];
      
      // Look for fields that might contain names
      if (key.toLowerCase().includes('name') || 
          key.toLowerCase().includes('title') ||
          key.toLowerCase().includes('engine') ||
          key.toLowerCase().includes('description')) {
        
        if (typeof value === 'string' && value.length > 0 && value !== '[object Object]') {
          results.push({
            path: newPath,
            value: value,
            type: 'string'
          });
        } else if (typeof value === 'object' && value !== null) {
          // Recurse into objects
          results.push(...findNameFields(value, newPath, depth + 1));
        }
      } else if (typeof value === 'object' && value !== null && 
                 (key === 'linecontent' || key === 'shipcontent' || 
                  key === 'linename' || key === 'shipname')) {
        // These are likely to contain name information
        results.push(...findNameFields(value, newPath, depth + 1));
      }
    }
  }
  
  return results;
}

async function analyzeFTPData() {
  try {
    console.log('🔍 Analyzing FTP Data Structure for Names\n');
    console.log('========================================\n');
    
    // Connect to FTP
    if (!await connectToFTP()) {
      throw new Error('Failed to connect to FTP');
    }
    
    // Get a sample cruise file from 2025
    console.log('1. Fetching sample cruise files...\n');
    
    // Try to get files from different cruise lines
    const samplePaths = [
      '/2025/01/1/1',  // Line 1, Ship 1
      '/2025/01/15/22', // Line 15, Ship 22
      '/2025/02/8/45',  // Line 8, Ship 45
    ];
    
    for (const dirPath of samplePaths) {
      try {
        console.log(`\nChecking directory: ${dirPath}`);
        const files = await ftpClient.list(dirPath);
        
        if (files.length > 0) {
          // Get the first cruise file
          const cruiseFile = files.find(f => f.name.endsWith('.json'));
          if (!cruiseFile) continue;
          
          const filePath = `${dirPath}/${cruiseFile.name}`;
          console.log(`   Analyzing file: ${filePath}`);
          
          // Download and parse the file
          const chunks = [];
          await ftpClient.downloadTo(chunks, filePath);
          const content = Buffer.concat(chunks).toString('utf8');
          const data = JSON.parse(content);
          
          // Extract cruise line and ship IDs from path
          const pathParts = dirPath.split('/');
          const lineId = pathParts[3];
          const shipId = pathParts[4];
          
          console.log(`   Line ID: ${lineId}, Ship ID: ${shipId}`);
          
          // Find all name-related fields
          console.log('\n   📋 Name fields found:');
          const nameFields = findNameFields(data);
          
          // Group by cruise line and ship
          const lineFields = nameFields.filter(f => 
            f.path.toLowerCase().includes('line') || 
            f.path.toLowerCase().includes('cruise'));
          const shipFields = nameFields.filter(f => 
            f.path.toLowerCase().includes('ship'));
          
          if (lineFields.length > 0) {
            console.log('\n   Cruise Line Name Fields:');
            lineFields.forEach(field => {
              console.log(`     ${field.path}: "${field.value}"`);
            });
          }
          
          if (shipFields.length > 0) {
            console.log('\n   Ship Name Fields:');
            shipFields.forEach(field => {
              console.log(`     ${field.path}: "${field.value}"`);
            });
          }
          
          // Also check specific known fields
          console.log('\n   📍 Checking specific fields:');
          
          // Check linecontent
          if (data.linecontent) {
            console.log('     linecontent exists:');
            if (data.linecontent.enginename) {
              console.log(`       enginename: "${data.linecontent.enginename}"`);
            }
            if (data.linecontent.name) {
              console.log(`       name: "${data.linecontent.name}"`);
            }
            if (data.linecontent.shortname) {
              console.log(`       shortname: "${data.linecontent.shortname}"`);
            }
            if (data.linecontent.description) {
              console.log(`       description: "${data.linecontent.description}"`);
            }
          }
          
          // Check shipcontent
          if (data.shipcontent) {
            console.log('     shipcontent exists:');
            if (data.shipcontent.name) {
              console.log(`       name: "${data.shipcontent.name}"`);
            }
            if (data.shipcontent.nicename) {
              console.log(`       nicename: "${data.shipcontent.nicename}"`);
            }
            if (data.shipcontent.shortname) {
              console.log(`       shortname: "${data.shipcontent.shortname}"`);
            }
          }
          
          // Check direct fields
          if (data.linename) {
            console.log(`     linename: ${JSON.stringify(data.linename)}`);
          }
          if (data.shipname) {
            console.log(`     shipname: ${JSON.stringify(data.shipname)}`);
          }
          
          console.log('\n   ---');
        }
      } catch (error) {
        console.log(`   ⚠️  Error processing ${dirPath}: ${error.message}`);
      }
    }
    
    console.log('\n========================================');
    console.log('Analysis Summary:');
    console.log('========================================\n');
    
    console.log('🔍 Name Field Locations:');
    console.log('\nFor Cruise Lines:');
    console.log('  1. data.linecontent.enginename (preferred - actual cruise line name)');
    console.log('  2. data.linecontent.name');
    console.log('  3. data.linecontent.shortname');
    console.log('  4. data.linename (may be string or object)');
    
    console.log('\nFor Ships:');
    console.log('  1. data.shipcontent.name (preferred)');
    console.log('  2. data.shipcontent.nicename');
    console.log('  3. data.shipname (may be string or object)');
    
    console.log('\n✅ Analysis complete!');
    
  } catch (error) {
    console.error('❌ Error analyzing FTP data:', error);
    throw error;
  } finally {
    ftpClient.close();
  }
}

// Run the analysis
analyzeFTPData()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Analysis failed:', error);
    process.exit(1);
  });