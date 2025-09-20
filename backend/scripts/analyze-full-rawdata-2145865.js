require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function analyzeRawData() {
  try {
    const result = await pool.query(`
      SELECT raw_data
      FROM cruises
      WHERE id = '2145865'
    `);

    if (result.rows.length > 0) {
      const rawData = result.rows[0].raw_data;

      console.log('\n🔍 FULL RAW_DATA STRUCTURE ANALYSIS FOR CRUISE 2145865');
      console.log('=' .repeat(60));

      // Write to file for inspection
      fs.writeFileSync('/tmp/cruise-2145865-raw.json', JSON.stringify(rawData, null, 2));
      console.log('Full raw_data written to: /tmp/cruise-2145865-raw.json');

      // Check all top-level keys
      console.log('\n📋 Top-level keys in raw_data:');
      const keys = Object.keys(rawData || {});
      keys.forEach(key => {
        const value = rawData[key];
        const type = typeof value;
        if (type === 'object' && value !== null) {
          if (Array.isArray(value)) {
            console.log(`  ${key}: [Array with ${value.length} items]`);
          } else {
            const subkeys = Object.keys(value).length;
            console.log(`  ${key}: {Object with ${subkeys} keys}`);
          }
        } else {
          console.log(`  ${key}: ${type} = ${JSON.stringify(value).substring(0, 50)}...`);
        }
      });

      // Search for any field containing "101"
      console.log('\n🔎 Searching for fields containing "101":');
      searchForValue(rawData, '101', '');

      // Search for any field containing "121"
      console.log('\n🔎 Searching for fields containing "121":');
      searchForValue(rawData, '121', '');

      // Check specific fields that might contain pricing
      console.log('\n💰 Checking potential price fields:');
      const priceFields = [
        'price', 'adultprice', 'childprice', 'infantprice',
        'singleprice', 'doubleprice', 'tripleprice', 'quadprice',
        'insideprice', 'outsideprice', 'balconyprice', 'suiteprice',
        'cheapest', 'cheapestprice', 'lowestprice', 'baseprice'
      ];

      priceFields.forEach(field => {
        const value = findFieldRecursive(rawData, field);
        if (value !== null) {
          console.log(`  ${field}: ${JSON.stringify(value).substring(0, 100)}`);
        }
      });

      // Check if there's a prices array or object
      if (rawData.prices) {
        console.log('\n📦 Found "prices" field:');
        console.log(JSON.stringify(rawData.prices, null, 2).substring(0, 500));
      }

      // Check if there's a pricing field
      if (rawData.pricing) {
        console.log('\n📦 Found "pricing" field:');
        console.log(JSON.stringify(rawData.pricing, null, 2).substring(0, 500));
      }

      // Check for fare or rate fields
      if (rawData.fare || rawData.fares) {
        console.log('\n📦 Found fare data:');
        console.log(JSON.stringify(rawData.fare || rawData.fares, null, 2).substring(0, 500));
      }

      if (rawData.rate || rawData.rates) {
        console.log('\n📦 Found rate data:');
        console.log(JSON.stringify(rawData.rate || rawData.rates, null, 2).substring(0, 500));
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

function searchForValue(obj, searchValue, path) {
  if (!obj) return;

  if (typeof obj === 'string' && obj.includes(searchValue)) {
    console.log(`  Found at ${path || 'root'}: "${obj}"`);
  } else if (typeof obj === 'number' && obj.toString().includes(searchValue)) {
    console.log(`  Found at ${path || 'root'}: ${obj}`);
  } else if (typeof obj === 'object') {
    for (const key in obj) {
      const newPath = path ? `${path}.${key}` : key;
      searchForValue(obj[key], searchValue, newPath);
    }
  }
}

function findFieldRecursive(obj, fieldName, depth = 0) {
  if (!obj || depth > 5) return null;

  if (typeof obj === 'object') {
    for (const key in obj) {
      if (key.toLowerCase() === fieldName.toLowerCase()) {
        return obj[key];
      }
      const result = findFieldRecursive(obj[key], fieldName, depth + 1);
      if (result !== null) return result;
    }
  }
  return null;
}

analyzeRawData();
