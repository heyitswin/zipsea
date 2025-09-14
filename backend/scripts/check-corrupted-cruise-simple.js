#!/usr/bin/env node

const dotenv = require('dotenv');
const path = require('path');
const ftp = require('basic-ftp');
const { Writable } = require('stream');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const cruiseId = '2170555';
const filePath = '/2026/08/16/6514/2170555.json';

async function checkCruise() {
  // Database connection
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    // Check if cruise exists in database
    console.log(`\n=== Checking Database for Cruise ${cruiseId} ===`);
    const result = await pool.query('SELECT * FROM cruises WHERE id = $1', [cruiseId]);

    if (result.rows.length > 0) {
      const cruise = result.rows[0];
      console.log('✅ Cruise exists in database');
      console.log(`Title: ${cruise.title}`);
      console.log(`Ship ID: ${cruise.ship_id}`);
      console.log(`Sailing Date: ${cruise.sailing_date}`);
      console.log(`Interior Price: ${cruise.interior_price}`);
      console.log(`Ocean View Price: ${cruise.oceanview_price}`);
      console.log(`Balcony Price: ${cruise.balcony_price}`);
      console.log(`Suite Price: ${cruise.suite_price}`);
      console.log(`Last Updated: ${cruise.updated_at}`);
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

        // Check pricing data
        if (data.cheapest) {
          console.log('\nPricing in file:');
          console.log(`Interior: ${data.cheapest.combined?.inside || 'null'}`);
          console.log(`Ocean View: ${data.cheapest.combined?.outside || 'null'}`);
          console.log(`Balcony: ${data.cheapest.combined?.balcony || 'null'}`);
          console.log(`Suite: ${data.cheapest.combined?.suite || 'null'}`);
        }
      } catch (parseError) {
        console.log('❌ JSON is corrupted');
        console.log(`Parse error: ${parseError.message}`);

        // Find the position where it fails
        const errorMatch = parseError.message.match(/position (\d+)/);
        if (errorMatch) {
          const position = parseInt(errorMatch[1]);
          console.log(`\nContent around position ${position}:`);
          console.log('Before:', content.substring(Math.max(0, position - 100), position));
          console.log('>>> ERROR HERE <<<');
          console.log(
            'After:',
            content.substring(position, Math.min(content.length, position + 100))
          );

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
    console.error('Error:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkCruise();
