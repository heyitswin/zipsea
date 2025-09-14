#!/usr/bin/env node

const { db } = require('../dist/config/database.js');
const { cruises } = require('../dist/db/schema/index.js');
const { eq } = require('drizzle-orm');
const dotenv = require('dotenv');
const path = require('path');
const ftp = require('basic-ftp');
const { Writable } = require('stream');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const cruiseId = '2170555';
const filePath = '/2026/08/16/6514/2170555.json';

async function checkCruise() {
  try {
    // Check if cruise exists in database
    console.log(`\n=== Checking Database for Cruise ${cruiseId} ===`);
    const cruise = await db.select().from(cruises).where(eq(cruises.id, cruiseId)).limit(1);

    if (cruise.length > 0) {
      console.log('✅ Cruise exists in database');
      console.log(`Title: ${cruise[0].title}`);
      console.log(`Ship ID: ${cruise[0].shipId}`);
      console.log(`Sailing Date: ${cruise[0].sailingDate}`);
      console.log(`Interior Price: ${cruise[0].interiorPrice}`);
      console.log(`Ocean View Price: ${cruise[0].oceanviewPrice}`);
      console.log(`Balcony Price: ${cruise[0].balconyPrice}`);
      console.log(`Suite Price: ${cruise[0].suitePrice}`);
      console.log(`Last Updated: ${cruise[0].updatedAt}`);
    } else {
      console.log('❌ Cruise NOT found in database');
    }

    // Try to download and check the FTP file
    console.log(`\n=== Checking FTP File ${filePath} ===`);
    const client = new ftp.Client();

    try {
      await client.access({
        host: process.env.FTP_HOST || 'ftpeu1prod.traveltek.net',
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        secure: false,
      });

      // Download file to memory
      const chunks = [];
      const writeStream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });

      await client.downloadTo(writeStream, filePath);
      const content = Buffer.concat(chunks).toString();

      console.log(`File size: ${content.length} bytes`);

      // Try to parse JSON
      try {
        const data = JSON.parse(content);
        console.log('✅ JSON is valid');
        console.log(`Cruise ID in file: ${data.codetocruiseid || data.id}`);
      } catch (parseError) {
        console.log('❌ JSON is corrupted');
        console.log(`Parse error: ${parseError.message}`);

        // Find the position where it fails
        const errorMatch = parseError.message.match(/position (\d+)/);
        if (errorMatch) {
          const position = parseInt(errorMatch[1]);
          console.log(`\nContent around position ${position}:`);
          console.log(content.substring(Math.max(0, position - 100), position + 100));

          // Check if file is truncated
          const lastChars = content.substring(content.length - 100);
          console.log(`\nLast 100 characters of file:`);
          console.log(lastChars);

          if (!lastChars.includes('}')) {
            console.log("\n⚠️  File appears to be truncated (doesn't end with })");
          }
        }
      }
    } finally {
      client.close();
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkCruise();
