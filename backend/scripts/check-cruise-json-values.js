#!/usr/bin/env node

require('dotenv').config();
const ftp = require('basic-ftp');

async function checkCruiseJsonValues() {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    console.log('Fetching cruise 2143102 JSON from FTP...\n');

    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false,
    });

    const filePath = '/2025/10/22/4439/2143102.json';
    const streamToString = require('stream').promises.pipeline;
    const { Writable } = require('stream');

    let jsonContent = '';
    const writeStream = new Writable({
      write(chunk, encoding, callback) {
        jsonContent += chunk;
        callback();
      }
    });

    await client.downloadTo(writeStream, filePath);
    const data = JSON.parse(jsonContent);

    console.log('=== Cruise 2143102 Price Fields ===\n');

    // Check the main cheapest fields
    console.log('Main cheapest fields:');
    console.log('  cheapestinside:', data.cheapestinside);
    console.log('  cheapestoutside:', data.cheapestoutside);
    console.log('  cheapestbalcony:', data.cheapestbalcony);
    console.log('  cheapestsuite:', data.cheapestsuite);

    console.log('\nPrice codes:');
    console.log('  cheapestinsidepricecode:', data.cheapestinsidepricecode);
    console.log('  cheapestoutsidepricecode:', data.cheapestoutsidepricecode);
    console.log('  cheapestbalconypricecode:', data.cheapestbalconypricecode);
    console.log('  cheapestsuitepricecode:', data.cheapestsuitepricecode);

    // Check combined structure
    if (data.cheapest && data.cheapest.combined) {
      console.log('\nCombined structure:');
      console.log('  inside:', data.cheapest.combined.inside);
      console.log('  outside:', data.cheapest.combined.outside);
      console.log('  balcony:', data.cheapest.combined.balcony);
      console.log('  suite:', data.cheapest.combined.suite);
    }

    // Check prices structure
    if (data.prices) {
      console.log('\nPrices structure exists:', Object.keys(data.prices).length, 'price codes');

      // Look for any ocean view or suite prices
      let oceanViewPrices = [];
      let suitePrices = [];

      Object.entries(data.prices).forEach(([code, priceData]) => {
        if (priceData.cabintype && priceData.cabintype.toLowerCase().includes('ocean')) {
          oceanViewPrices.push({ code, price: priceData.lowestsingleprice || priceData.lowestdoubleprice });
        }
        if (priceData.cabintype && priceData.cabintype.toLowerCase().includes('suite')) {
          suitePrices.push({ code, price: priceData.lowestsingleprice || priceData.lowestdoubleprice });
        }
      });

      if (oceanViewPrices.length > 0) {
        console.log('\nFound Ocean View prices in prices structure:');
        oceanViewPrices.forEach(p => console.log(`  ${p.code}: $${p.price}`));
      }

      if (suitePrices.length > 0) {
        console.log('\nFound Suite prices in prices structure:');
        suitePrices.forEach(p => console.log(`  ${p.code}: $${p.price}`));
      }
    }

    // Check cabins structure
    if (data.cabins) {
      console.log('\nCabins structure exists:', Object.keys(data.cabins).length, 'cabin codes');

      // Sample a few cabins to see their types
      const cabinSample = Object.entries(data.cabins).slice(0, 5);
      console.log('\nSample cabins:');
      cabinSample.forEach(([code, cabin]) => {
        console.log(`  ${code}: ${cabin.cabintype || 'no type'}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
  }
}

checkCruiseJsonValues().catch(console.error);
