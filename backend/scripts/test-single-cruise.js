#!/usr/bin/env node

/**
 * Test processing a single cruise file to verify data extraction
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { getCruiseDataProcessor } = require('../dist/services/cruise-data-processor.service');
const { ftpConnectionPool } = require('../dist/services/ftp-connection-pool.service');
const { db } = require('../dist/db');
const { cruises, ships, ports } = require('../dist/db/schema');
const { eq } = require('drizzle-orm');

async function testSingleCruise() {
  console.log('='.repeat(60));
  console.log('Testing Single Cruise Processing');
  console.log('='.repeat(60));

  const processor = getCruiseDataProcessor();
  const conn = await ftpConnectionPool.getConnection();

  try {
    // Download a single cruise file
    const testFile = '/2025/09/10/54/2092631.json';
    console.log(`\n📥 Downloading ${testFile}...`);

    const tempFile = '/tmp/test-cruise.json';
    await conn.client.downloadTo(tempFile, testFile);

    const fs = require('fs');
    const cruiseData = JSON.parse(fs.readFileSync(tempFile, 'utf-8'));

    console.log('\n📋 Cruise Data:');
    console.log(`  ID (codetocruiseid): ${cruiseData.codetocruiseid}`);
    console.log(`  Name: ${cruiseData.name}`);
    console.log(`  Line ID: ${cruiseData.lineid}`);
    console.log(`  Ship ID: ${cruiseData.shipid}`);
    console.log(`  Ship Name: ${cruiseData.shipname}`);
    console.log(`  Nights: ${cruiseData.nights}`);
    console.log(`  Sail Date: ${cruiseData.saildate}`);

    console.log('\n⚙️  Processing cruise data...');
    const result = await processor.processCruiseData(cruiseData);

    if (result.success) {
      console.log(`\n✅ SUCCESS: Cruise ${result.action}!`);
      console.log(`  Cruise ID: ${result.cruiseId}`);

      // Verify the cruise was created/updated
      const cruise = await db
        .select()
        .from(cruises)
        .where(eq(cruises.id, result.cruiseId))
        .limit(1);

      if (cruise.length > 0) {
        console.log('\n📊 Database Verification:');
        console.log(`  Cruise Name: ${cruise[0].name}`);
        console.log(`  Ship ID: ${cruise[0].shipId}`);
        console.log(`  Nights: ${cruise[0].nights}`);
        console.log(`  Cheapest Price: ${cruise[0].currency} ${cruise[0].cheapestPrice}`);

        // Check if ship was created
        if (cruise[0].shipId) {
          const ship = await db
            .select()
            .from(ships)
            .where(eq(ships.id, cruise[0].shipId))
            .limit(1);

          if (ship.length > 0) {
            console.log(`  Ship Name: ${ship[0].name}`);
          }
        }

        // Check if ports were created
        if (cruise[0].embarkationPortId) {
          const port = await db
            .select()
            .from(ports)
            .where(eq(ports.id, cruise[0].embarkationPortId))
            .limit(1);

          if (port.length > 0) {
            console.log(`  Embarkation Port: ${port[0].name}`);
          }
        }

        console.log('\n✅ Data extraction and population successful!');
      } else {
        console.log('\n❌ Cruise not found in database after processing');
      }
    } else {
      console.log(`\n❌ Failed to process cruise: ${result.error}`);
    }

    // Clean up
    fs.unlinkSync(tempFile);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  } finally {
    ftpConnectionPool.releaseConnection(conn.id);
  }

  console.log('\n' + '='.repeat(60));
  process.exit(0);
}

// Run the test
testSingleCruise().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
