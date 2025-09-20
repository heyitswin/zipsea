require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkCruise() {
  try {
    console.log('🔍 INVESTIGATING CRUISE 2145865 PRICING ISSUE');
    console.log('=' .repeat(60));

    // Check database prices
    const dbResult = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        c.cheapest_price,
        c.updated_at,
        cp.interior_price as cp_interior,
        cp.oceanview_price as cp_oceanview,
        cp.balcony_price as cp_balcony,
        cp.suite_price as cp_suite,
        cp.cheapest_price as cp_cheapest,
        cp.last_updated as cp_updated
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.id = '2145865'
    `);

    if (dbResult.rows.length > 0) {
      const data = dbResult.rows[0];
      console.log('\n📊 DATABASE PRICES:');
      console.log('-------------------');
      console.log('Cruises table:');
      console.log(`  Interior:  $${data.interior_price || 'NULL'}`);
      console.log(`  Oceanview: $${data.oceanview_price || 'NULL'}`);
      console.log(`  Balcony:   $${data.balcony_price || 'NULL'}`);
      console.log(`  Suite:     $${data.suite_price || 'NULL'}`);
      console.log(`  Cheapest:  $${data.cheapest_price || 'NULL'}`);
      console.log(`  Updated:   ${data.updated_at}\n`);

      if (data.cp_interior) {
        console.log('Cheapest_pricing table:');
        console.log(`  Interior:  $${data.cp_interior}`);
        console.log(`  Oceanview: $${data.cp_oceanview}`);
        console.log(`  Balcony:   $${data.cp_balcony}`);
        console.log(`  Suite:     $${data.cp_suite}`);
        console.log(`  Cheapest:  $${data.cp_cheapest}`);
        console.log(`  Updated:   ${data.cp_updated}`);
      } else {
        console.log('❌ No entry in cheapest_pricing table');
      }
    }

    // Check raw_data
    console.log('\n📄 RAW DATA ANALYSIS:');
    console.log('---------------------');

    const rawResult = await pool.query(`
      SELECT
        raw_data,
        pg_column_size(raw_data) as size_bytes
      FROM cruises
      WHERE id = '2145865'
    `);

    if (rawResult.rows.length > 0 && rawResult.rows[0].raw_data) {
      const rawData = rawResult.rows[0].raw_data;
      console.log(`Raw data size: ${rawResult.rows[0].size_bytes} bytes`);

      // Check if it's corrupted (character-by-character)
      if (typeof rawData === 'object' && rawData['0'] !== undefined) {
        console.log('❌ RAW DATA IS CORRUPTED (character-by-character storage)');

        // Try to reconstruct
        const chars = [];
        let i = 0;
        while (rawData[i.toString()] !== undefined) {
          chars.push(rawData[i.toString()]);
          i++;
        }
        const reconstructed = JSON.parse(chars.join(''));

        console.log('\nReconstructed prices from raw_data:');
        console.log(`  cheapestinside:  $${reconstructed.cheapestinside || 'NOT FOUND'}`);
        console.log(`  cheapestoutside: $${reconstructed.cheapestoutside || 'NOT FOUND'}`);
        console.log(`  cheapestbalcony: $${reconstructed.cheapestbalcony || 'NOT FOUND'}`);
        console.log(`  cheapestsuite:   $${reconstructed.cheapestsuite || 'NOT FOUND'}`);

        // Check cheapest object
        if (reconstructed.cheapest) {
          console.log('\nCheapest object in raw_data:');
          if (reconstructed.cheapest.combined) {
            console.log('  Combined prices:');
            console.log(`    inside:  $${reconstructed.cheapest.combined.inside || 'N/A'}`);
            console.log(`    outside: $${reconstructed.cheapest.combined.outside || 'N/A'}`);
            console.log(`    balcony: $${reconstructed.cheapest.combined.balcony || 'N/A'}`);
            console.log(`    suite:   $${reconstructed.cheapest.combined.suite || 'N/A'}`);
          }
        }

        // Check for cabin prices
        if (reconstructed.cabins) {
          const cabinPrices = [];
          Object.values(reconstructed.cabins).forEach(cabin => {
            if (cabin.price) {
              cabinPrices.push(parseFloat(cabin.price));
            }
          });
          if (cabinPrices.length > 0) {
            cabinPrices.sort((a, b) => a - b);
            console.log(`\n📦 Individual cabin prices found: ${cabinPrices.length} cabins`);
            console.log(`  Lowest cabin price:  $${cabinPrices[0]}`);
            console.log(`  Highest cabin price: $${cabinPrices[cabinPrices.length - 1]}`);

            // Show first 5 cabin prices
            console.log(`  First 5 prices: ${cabinPrices.slice(0, 5).map(p => '$' + p).join(', ')}`);
          }
        }
      } else if (typeof rawData === 'object') {
        console.log('✅ Raw data is valid JSON');

        console.log('\nPrices from raw_data:');
        console.log(`  cheapestinside:  $${rawData.cheapestinside || 'NOT FOUND'}`);
        console.log(`  cheapestoutside: $${rawData.cheapestoutside || 'NOT FOUND'}`);
        console.log(`  cheapestbalcony: $${rawData.cheapestbalcony || 'NOT FOUND'}`);
        console.log(`  cheapestsuite:   $${rawData.cheapestsuite || 'NOT FOUND'}`);

        if (rawData.cheapest && rawData.cheapest.combined) {
          console.log('\nCheapest.combined prices:');
          console.log(`    inside:  $${rawData.cheapest.combined.inside || 'N/A'}`);
          console.log(`    outside: $${rawData.cheapest.combined.outside || 'N/A'}`);
          console.log(`    balcony: $${rawData.cheapest.combined.balcony || 'N/A'}`);
          console.log(`    suite:   $${rawData.cheapest.combined.suite || 'N/A'}`);
        }
      }
    } else {
      console.log('❌ No raw_data found');
    }

    // Check FTP file if exists
    const ftpPath = '/Volumes/Data_2TB/zipsea-ftp-backup/2025/09/22/2145865.json';
    if (fs.existsSync(ftpPath)) {
      console.log('\n📁 FTP FILE ANALYSIS:');
      console.log('---------------------');
      const ftpContent = JSON.parse(fs.readFileSync(ftpPath, 'utf8'));

      console.log('FTP file prices:');
      console.log(`  cheapestinside:  $${ftpContent.cheapestinside || 'NOT FOUND'}`);
      console.log(`  cheapestoutside: $${ftpContent.cheapestoutside || 'NOT FOUND'}`);
      console.log(`  cheapestbalcony: $${ftpContent.cheapestbalcony || 'NOT FOUND'}`);
      console.log(`  cheapestsuite:   $${ftpContent.cheapestsuite || 'NOT FOUND'}`);

      if (ftpContent.cheapest && ftpContent.cheapest.combined) {
        console.log('\nFTP cheapest.combined:');
        console.log(`  inside:  $${ftpContent.cheapest.combined.inside || 'N/A'}`);
        console.log(`  outside: $${ftpContent.cheapest.combined.outside || 'N/A'}`);
        console.log(`  balcony: $${ftpContent.cheapest.combined.balcony || 'N/A'}`);
        console.log(`  suite:   $${ftpContent.cheapest.combined.suite || 'N/A'}`);
      }
    }

    // Check API response
    console.log('\n🌐 API RESPONSE:');
    console.log('----------------');
    const https = require('https');
    const apiData = await new Promise((resolve, reject) => {
      https.get(`https://api.zipsea.com/api/cruises/2145865`, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.data);
          } catch (e) {
            resolve(null);
          }
        });
      }).on('error', reject);
    });

    if (apiData) {
      console.log(`  Interior:  $${apiData.interiorPrice || 'NULL'}`);
      console.log(`  Oceanview: $${apiData.oceanviewPrice || 'NULL'}`);
      console.log(`  Balcony:   $${apiData.balconyPrice || 'NULL'}`);
      console.log(`  Suite:     $${apiData.suitePrice || 'NULL'}`);
      console.log(`  Cheapest:  $${apiData.cheapestPrice || 'NULL'}`);

      if (apiData.cheapestPricing) {
        console.log('\nAPI cheapestPricing:');
        console.log(`  Interior:  $${apiData.cheapestPricing.interior?.price || 'NULL'}`);
        console.log(`  Oceanview: $${apiData.cheapestPricing.oceanview?.price || 'NULL'}`);
        console.log(`  Balcony:   $${apiData.cheapestPricing.balcony?.price || 'NULL'}`);
        console.log(`  Suite:     $${apiData.cheapestPricing.suite?.price || 'NULL'}`);
      }
    } else {
      console.log('❌ Failed to get API response');
    }

    console.log('\n' + '=' .repeat(60));
    console.log('\n🎯 DIAGNOSIS:');
    console.log('------------');
    console.log('1. Check if $100 is in the database');
    console.log('2. Check if $100 comes from FTP data');
    console.log('3. Check if webhook processor is extracting wrong field');
    console.log('4. Check if there\'s a calculation error');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkCruise();
