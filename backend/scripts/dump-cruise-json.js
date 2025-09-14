#!/usr/bin/env node

const ftp = require('basic-ftp');
const fs = require('fs');
require('dotenv').config();

async function dumpCruiseJSON() {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST || 'ftp.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false,
    });

    const filePath = '/2025/10/22/4439/2143102.json';
    const localPath = '/tmp/2143102.json';

    console.log(`Downloading ${filePath}...`);
    await client.downloadTo(localPath, filePath);

    const content = JSON.parse(fs.readFileSync(localPath, 'utf8'));

    console.log('Top-level fields in the JSON:');
    console.log('=============================\n');

    Object.keys(content).forEach(key => {
      const value = content[key];
      const type = Array.isArray(value) ? 'array' : typeof value;
      console.log(`${key}: ${type}`);

      // Show sample values for pricing-related fields
      if (key.toLowerCase().includes('price') || key.toLowerCase().includes('cheap')) {
        if (type === 'object' && value !== null) {
          console.log(`  → ${JSON.stringify(value).substring(0, 100)}...`);
        } else if (type !== 'object') {
          console.log(`  → ${value}`);
        }
      }
    });

    // Look for pricing in nested structures
    console.log('\n\nPricing-related structures:');
    console.log('===========================\n');

    // Check cheapest object
    if (content.cheapest) {
      console.log('content.cheapest:');
      console.log(JSON.stringify(content.cheapest, null, 2));
    }

    // Check prices object
    if (content.prices) {
      console.log('\ncontent.prices (first 500 chars):');
      console.log(JSON.stringify(content.prices, null, 2).substring(0, 500));
    }

    // Check cabin pricing
    if (content.cabins) {
      console.log('\ncontent.cabins (keys):');
      console.log(Object.keys(content.cabins));
    }

    // Save full JSON for manual inspection
    const outputPath = '/tmp/2143102-full.json';
    fs.writeFileSync(outputPath, JSON.stringify(content, null, 2));
    console.log(`\n\nFull JSON saved to: ${outputPath}`);

    // Clean up
    fs.unlinkSync(localPath);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.close();
  }
}

dumpCruiseJSON();
