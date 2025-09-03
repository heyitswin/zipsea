/**
 * Download and analyze a sample JSON file from FTP to understand data structure
 */

import { logger } from '../src/config/logger';
import { ftpConnectionPool } from '../src/services/ftp-connection-pool.service';
import { Writable } from 'stream';
import * as fs from 'fs';

async function downloadSampleCruiseJSON() {
  console.log('🔍 Downloading sample Line 24 cruise JSON file\n');

  let connection: any = null;
  try {
    connection = await ftpConnectionPool.getConnection();
    console.log('✅ Connected to FTP server');

    // Generate paths for current month
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const monthPath = `${year}/${month}/24`;

    console.log(`📂 Checking path: ${monthPath}`);

    // Get ship directories
    const shipDirs = await connection.list(monthPath);
    const directories = shipDirs.filter((item: any) => item.type === 2);
    
    if (directories.length === 0) {
      console.log('❌ No ship directories found');
      return;
    }

    console.log(`🚢 Found ${directories.length} ship directories`);
    
    // Check first ship directory
    const shipPath = `${monthPath}/${directories[0].name}`;
    console.log(`📁 Checking ship directory: ${shipPath}`);
    
    const files = await connection.list(shipPath);
    const jsonFiles = files.filter((f: any) => f.name.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      console.log('❌ No JSON files found');
      return;
    }

    console.log(`📄 Found ${jsonFiles.length} JSON files`);
    
    // Download first few files
    const sampleCount = Math.min(3, jsonFiles.length);
    console.log(`⬇️ Downloading ${sampleCount} sample files...\n`);

    for (let i = 0; i < sampleCount; i++) {
      const file = jsonFiles[i];
      const filePath = `${shipPath}/${file.name}`;
      const localPath = `/tmp/cruise-sample-${i + 1}.json`;

      try {
        console.log(`   ${i + 1}. Downloading ${file.name}...`);
        
        const chunks: Buffer[] = [];
        const writableStream = new Writable({
          write(chunk: Buffer, encoding: string, callback: Function) {
            chunks.push(chunk);
            callback();
          }
        });

        await Promise.race([
          connection.downloadTo(writableStream, filePath),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Download timeout')), 30000)
          )
        ]);

        const buffer = Buffer.concat(chunks);
        const content = buffer.toString();
        
        // Save to local file for inspection
        fs.writeFileSync(localPath, content);
        console.log(`      ✅ Saved to ${localPath}`);
        
        // Parse and analyze structure
        const data = JSON.parse(content);
        console.log(`      📊 Analyzing structure...`);
        
        // Show key fields
        console.log(`         codetocruiseid: ${data.codetocruiseid}`);
        console.log(`         name: ${data.name}`);
        console.log(`         saildate: ${data.saildate}`);
        console.log(`         nights: ${data.nights}`);
        
        // Check pricing fields
        const pricingFields = ['cheapestinside', 'cheapestoutside', 'cheapestbalcony', 'cheapestsuite'];
        console.log(`         Pricing data:`);
        pricingFields.forEach(field => {
          const value = data[field];
          console.log(`           ${field}: ${value !== undefined ? value : 'MISSING'}`);
        });
        
        // Check for cached prices
        if (data.cachedprices) {
          console.log(`         Cached pricing data:`);
          console.log(`           inside: ${data.cachedprices.inside}`);
          console.log(`           outside: ${data.cachedprices.outside}`);
          console.log(`           balcony: ${data.cachedprices.balcony}`);
          console.log(`           suite: ${data.cachedprices.suite}`);
        } else {
          console.log(`         ❌ No cachedprices field found`);
        }
        
        // Check itinerary
        if (data.itinerary && Array.isArray(data.itinerary)) {
          console.log(`         Itinerary: ${data.itinerary.length} days`);
          if (data.itinerary.length > 0) {
            console.log(`           First day: ${data.itinerary[0].day} - ${data.itinerary[0].port}`);
          }
        } else {
          console.log(`         ❌ No itinerary data`);
        }
        
        // Check port data
        console.log(`         Port data:`);
        console.log(`           portids: ${data.portids || 'MISSING'}`);
        console.log(`           startportid: ${data.startportid || 'MISSING'}`);
        console.log(`           endportid: ${data.endportid || 'MISSING'}`);
        
        // Show all top-level keys
        console.log(`         All fields: ${Object.keys(data).join(', ')}`);
        
        console.log('');
        
      } catch (err) {
        console.error(`      ❌ Error downloading ${file.name}:`, err);
      }
    }

    console.log('🎯 ANALYSIS COMPLETE');
    console.log('\n💡 KEY INSIGHTS:');
    console.log('   - Check if pricing fields (cheapestinside, etc.) are present in JSON files');
    console.log('   - Look for patterns in files with vs without pricing data');
    console.log('   - Verify if cachedprices is an alternative source of pricing');
    console.log('   - Confirm itinerary and port data availability');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      ftpConnectionPool.releaseConnection(connection);
    }
  }

  process.exit(0);
}

downloadSampleCruiseJSON();