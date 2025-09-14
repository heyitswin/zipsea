#!/usr/bin/env node

require('dotenv').config();
const ftp = require('basic-ftp');

async function checkItineraryData() {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    console.log('Fetching cruise 2143102 to check itinerary data...\n');

    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false,
    });

    const filePath = '/2025/10/22/4439/2143102.json';
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

    console.log('=== Checking Itinerary Data in FTP File ===\n');

    // Check for itinerary field
    if (data.itinerary) {
      console.log('✅ Itinerary field EXISTS in FTP file');
      console.log(`Number of itinerary items: ${Object.keys(data.itinerary).length}`);

      // Show first few itinerary items
      const items = Object.entries(data.itinerary).slice(0, 3);
      console.log('\nFirst 3 itinerary items:');
      items.forEach(([key, item]) => {
        console.log(`\n  ${key}:`);
        console.log(`    Day: ${item.day || 'N/A'}`);
        console.log(`    Port: ${item.port || 'N/A'}`);
        console.log(`    Country: ${item.country || 'N/A'}`);
        console.log(`    Arrive: ${item.arrive || 'N/A'}`);
        console.log(`    Depart: ${item.depart || 'N/A'}`);
      });

      // Check total itinerary
      console.log(`\nTotal itinerary items: ${Object.keys(data.itinerary).length}`);
    } else {
      console.log('❌ Itinerary field NOT FOUND in FTP file');
    }

    // Check for ports/destinations
    if (data.ports) {
      console.log('\n✅ Ports field exists');
      console.log(`Number of ports: ${Object.keys(data.ports).length}`);
    }

    if (data.destinations) {
      console.log('✅ Destinations field exists');
      console.log(`Number of destinations: ${Object.keys(data.destinations).length}`);
    }

    // Check for itinerary description
    if (data.itinerarydescription) {
      console.log('\n✅ Itinerary description exists:');
      console.log(data.itinerarydescription.substring(0, 200) + '...');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
  }
}

checkItineraryData().catch(console.error);
