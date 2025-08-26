#!/usr/bin/env node

/**
 * Check if there's a mapping between our cruise IDs and FTP cruise IDs
 */

require('dotenv').config();
const ftp = require('basic-ftp');

async function checkMapping() {
  const { Pool } = require('pg');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  const client = new ftp.Client();
  
  try {
    console.log('Checking cruise ID mapping...\n');
    
    // Get some cruises from line 3
    const dbResult = await pool.query(`
      SELECT 
        id,
        cruise_id, 
        ship_id, 
        sailing_date,
        name
      FROM cruises 
      WHERE cruise_line_id = 3 
        AND ship_id = 1049
        AND sailing_date >= '2025-08-01'
        AND sailing_date < '2025-10-01'
      ORDER BY sailing_date
      LIMIT 10
    `);
    
    console.log('Cruises in our database (Line 3, Ship 1049, Aug-Sep 2025):');
    dbResult.rows.forEach(row => {
      const date = new Date(row.sailing_date);
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      console.log(`  PK(id): ${row.id} | cruise_id: ${row.cruise_id} | ${month} ${date.getDate()} | ${row.name}`);
    });
    
    // Connect to FTP and get a sample file
    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST,
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false
    });
    
    console.log('\n✅ Connected to FTP');
    
    // Download a sample file to check its content
    const samplePath = '2025/08/3/1049/2148740.json';
    console.log(`\nDownloading sample file: ${samplePath}`);
    
    const buffer = await client.downloadToBuffer(samplePath);
    const data = JSON.parse(buffer.toString());
    
    console.log('\nFTP File content (2148740.json):');
    console.log('  cruiseid:', data.cruiseid);
    console.log('  cruisecode:', data.cruisecode);
    console.log('  codetocruiseid:', data.codetocruiseid);
    console.log('  sailingdate:', data.sailingdate);
    console.log('  shipname:', data.shipname);
    console.log('  cruisename:', data.cruisename);
    
    // Check if this matches any cruise in our DB
    if (data.cruiseid || data.codetocruiseid) {
      const matchResult = await pool.query(`
        SELECT id, cruise_id, name 
        FROM cruises 
        WHERE cruise_id = $1 OR id = $2
        LIMIT 1
      `, [String(data.cruiseid || '0'), data.codetocruiseid || 0]);
      
      if (matchResult.rows.length > 0) {
        console.log('\n✅ Match found in database:', matchResult.rows[0]);
      } else {
        console.log('\n❌ No match found in database');
        console.log('The FTP uses different IDs than our database!');
      }
    }
    
    // Try another file
    const samplePath2 = '2025/09/3/1049/2148727.json';
    console.log(`\n\nDownloading another sample: ${samplePath2}`);
    
    const buffer2 = await client.downloadToBuffer(samplePath2);
    const data2 = JSON.parse(buffer2.toString());
    
    console.log('\nFTP File content (2148727.json):');
    console.log('  cruiseid:', data2.cruiseid);
    console.log('  cruisecode:', data2.cruisecode);
    console.log('  codetocruiseid:', data2.codetocruiseid);
    console.log('  sailingdate:', data2.sailingdate);
    console.log('  shipname:', data2.shipname);
    
    console.log('\n' + '='.repeat(60));
    console.log('CONCLUSION:');
    console.log('The FTP file names (like 2148740.json) are the "codetocruiseid" values.');
    console.log('We need to either:');
    console.log('  1. Store the codetocruiseid in our database');
    console.log('  2. Download ALL files and match by sailing date/ship');
    console.log('  3. Get the mapping from Traveltek');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.close();
    await pool.end();
  }
}

checkMapping();