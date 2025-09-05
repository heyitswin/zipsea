#!/usr/bin/env node

/**
 * Examine Sample Cruise File - Diagnostic Script
 * Downloads and examines a sample Traveltek JSON file to verify data structure
 * Date: 2025-01-14
 */

const ftp = require('basic-ftp');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Configuration
const SAMPLE_FILE = '2025/10/22/4439/2143102.json'; // Symphony of the Seas example
const OUTPUT_FILE = './sample-cruise-data.json';

/**
 * Create FTP connection
 */
async function createFtpConnection() {
  const ftpConfig = {
    host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
    user: process.env.TRAVELTEK_FTP_USER,
    password: process.env.TRAVELTEK_FTP_PASSWORD,
    secure: false,
    timeout: 30000,
    verbose: false,
  };

  const client = new ftp.Client();
  client.ftp.verbose = false;

  await client.access(ftpConfig);
  return client;
}

/**
 * Download and examine sample file
 */
async function examineSampleFile() {
  console.log('🔍 Examining Sample Traveltek Cruise File');
  console.log('==========================================\n');

  let client;
  try {
    // Connect to FTP
    console.log('📡 Connecting to Traveltek FTP server...');
    client = await createFtpConnection();
    console.log('✅ Connected successfully\n');

    // Download sample file
    console.log(`📥 Downloading sample file: ${SAMPLE_FILE}`);

    // Use downloadToDir to download to a temporary file, then read it
    const tempFile = './temp-cruise-sample.json';
    await client.downloadTo(tempFile, SAMPLE_FILE);

    // Read the downloaded file
    const data = await fs.readFile(tempFile);

    if (data.length === 0) {
      console.log('❌ No data downloaded - file might not exist');
      return;
    }

    console.log(`✅ Downloaded ${data.length} bytes\n`);

    // Clean up temp file
    try {
      await fs.unlink(tempFile);
    } catch (e) {
      // Ignore cleanup errors
    }

    // Parse JSON
    console.log('🔍 Parsing JSON data...');
    let jsonData;
    try {
      jsonData = JSON.parse(data.toString());
      console.log('✅ JSON parsed successfully\n');
    } catch (parseError) {
      console.log('❌ JSON parsing failed:', parseError.message);
      return;
    }

    // Save to file for examination
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(jsonData, null, 2));
    console.log(`💾 Sample data saved to: ${OUTPUT_FILE}\n`);

    // Analyze structure
    console.log('📊 DATA STRUCTURE ANALYSIS');
    console.log('===========================');

    // Basic cruise info
    console.log('\n🚢 Basic Cruise Info:');
    console.log(`   ID: ${jsonData.codetocruiseid}`);
    console.log(`   Name: ${jsonData.name}`);
    console.log(`   Line ID: ${jsonData.lineid}`);
    console.log(`   Ship ID: ${jsonData.shipid}`);
    console.log(`   Sailing Date: ${jsonData.saildate}`);
    console.log(`   Nights: ${jsonData.nights}`);

    // Pricing analysis
    console.log('\n💰 Pricing Structure:');
    if (jsonData.cheapestprice) {
      console.log(`   Direct cheapestprice: ${jsonData.cheapestprice}`);
    }

    if (jsonData.cheapestinside) {
      console.log(`   cheapestinside: ${JSON.stringify(jsonData.cheapestinside)}`);
    }

    if (jsonData.cheapestoutside) {
      console.log(`   cheapestoutside: ${JSON.stringify(jsonData.cheapestoutside)}`);
    }

    if (jsonData.cheapestbalcony) {
      console.log(`   cheapestbalcony: ${JSON.stringify(jsonData.cheapestbalcony)}`);
    }

    if (jsonData.cheapestsuite) {
      console.log(`   cheapestsuite: ${JSON.stringify(jsonData.cheapestsuite)}`);
    }

    // Complex pricing structure
    if (jsonData.cheapest) {
      console.log('\n🏷️ Complex Cheapest Structure:');
      console.log(`   Has 'cheapest' object: Yes`);

      if (jsonData.cheapest.prices) {
        console.log(`   cheapest.prices.inside: ${jsonData.cheapest.prices.inside}`);
        console.log(`   cheapest.prices.outside: ${jsonData.cheapest.prices.outside}`);
        console.log(`   cheapest.prices.balcony: ${jsonData.cheapest.prices.balcony}`);
        console.log(`   cheapest.prices.suite: ${jsonData.cheapest.prices.suite}`);
      }

      if (jsonData.cheapest.combined) {
        console.log(`   cheapest.combined.inside: ${jsonData.cheapest.combined.inside}`);
        console.log(`   cheapest.combined.outside: ${jsonData.cheapest.combined.outside}`);
        console.log(`   cheapest.combined.balcony: ${jsonData.cheapest.combined.balcony}`);
        console.log(`   cheapest.combined.suite: ${jsonData.cheapest.combined.suite}`);
      }

      if (jsonData.cheapest.cachedprices) {
        console.log(`   cheapest.cachedprices.inside: ${jsonData.cheapest.cachedprices.inside}`);
        console.log(`   cheapest.cachedprices.outside: ${jsonData.cheapest.cachedprices.outside}`);
        console.log(`   cheapest.cachedprices.balcony: ${jsonData.cheapest.cachedprices.balcony}`);
        console.log(`   cheapest.cachedprices.suite: ${jsonData.cheapest.cachedprices.suite}`);
      }
    }

    // Ship content analysis
    console.log('\n🛳️ Ship Content:');
    if (jsonData.shipcontent) {
      console.log(`   Has shipcontent: Yes`);
      console.log(`   Ship name: ${jsonData.shipcontent.name}`);
      console.log(`   Tonnage: ${jsonData.shipcontent.tonnage}`);
      console.log(`   Star rating: ${jsonData.shipcontent.starrating}`);
      console.log(`   Default image: ${jsonData.shipcontent.defaultshipimage ? 'Yes' : 'No'}`);
      console.log(`   Description: ${jsonData.shipcontent.shortdescription ? 'Yes' : 'No'}`);

      // Check for problematic values
      const problematicFields = [];
      if (jsonData.shipcontent.refurbishedyear === 'NaN') problematicFields.push('refurbishedyear');
      if (jsonData.shipcontent.starrating === 'NaN') problematicFields.push('starrating');
      if (jsonData.shipcontent.tonnage === 'NaN') problematicFields.push('tonnage');

      if (problematicFields.length > 0) {
        console.log(`   ⚠️ Problematic "NaN" fields: ${problematicFields.join(', ')}`);
      }
    }

    // Line content analysis
    console.log('\n🏢 Line Content:');
    if (jsonData.linecontent) {
      console.log(`   Has linecontent: Yes`);
      console.log(`   Line name: ${jsonData.linecontent.name}`);
    }

    // Ports and regions
    console.log('\n🌍 Ports & Regions:');
    if (jsonData.ports && Array.isArray(jsonData.ports)) {
      console.log(`   Ports count: ${jsonData.ports.length}`);
      if (jsonData.ports.length > 0) {
        console.log(`   First port: ${jsonData.ports[0].name}`);
      }
    }

    if (jsonData.regions && Array.isArray(jsonData.regions)) {
      console.log(`   Regions count: ${jsonData.regions.length}`);
      if (jsonData.regions.length > 0) {
        console.log(`   First region: ${jsonData.regions[0].name}`);
      }
    }

    // Storage analysis
    console.log('\n💾 CURRENT SYNC STORAGE ANALYSIS');
    console.log('==================================');

    console.log('\n✅ Currently Storing:');
    console.log('   • Basic cruise info (id, name, dates, nights)');
    console.log('   • Processed pricing (interior/oceanview/balcony/suite as decimals)');
    console.log('   • Ship content as JSON string');
    console.log('   • Line content as JSON string');
    console.log('   • Ports/regions as JSON strings');

    console.log('\n❌ NOT Currently Storing:');
    console.log('   • Raw cheapest pricing structure (cheapest.combined, etc.)');
    console.log('   • Price codes (insidepricecode, outsidepricecode, etc.)');
    console.log('   • Cached pricing data (cheapest.cachedprices)');
    console.log('   • Source attribution (insidesource, outsidesource, etc.)');
    console.log('   • Complete raw JSON for future processing');

    console.log('\n🔍 RECOMMENDATIONS:');
    console.log('==================');
    console.log('1. ✅ Current approach is good for basic pricing display');
    console.log('2. 💡 Consider adding raw_data JSON column for full flexibility');
    console.log('3. 🎯 Price codes might be useful for detailed displays');
    console.log('4. 📊 Cached pricing could provide real-time vs static comparison');

    console.log('\n📋 Top-level JSON keys found:');
    const keys = Object.keys(jsonData).sort();
    keys.forEach(key => {
      const value = jsonData[key];
      const type = typeof value;
      const isArray = Array.isArray(value);
      const typeInfo = isArray ? `array[${value.length}]` : type;
      console.log(`   ${key}: ${typeInfo}`);
    });
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    if (client) {
      client.close();
    }
  }
}

// Run the analysis
if (require.main === module) {
  examineSampleFile();
}

module.exports = { examineSampleFile };
