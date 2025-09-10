#!/usr/bin/env node

/**
 * Test script to verify webhook processor extracts and populates database tables
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { getWebhookProcessorSimple } = require('../dist/services/webhook-processor-simple.service');
const { db } = require('../dist/db');
const { cruises, ships, ports, regions, pricing } = require('../dist/db/schema');
const { eq, desc, sql } = require('drizzle-orm');

async function testDataExtraction() {
  console.log('='.repeat(60));
  console.log('Testing Data Extraction and Population');
  console.log('='.repeat(60));

  const processor = getWebhookProcessorSimple();

  try {
    // Get initial counts
    const initialCounts = await getTableCounts();
    console.log('\n📊 Initial Database State:');
    displayCounts(initialCounts);

    // Test with line 10 (smaller dataset)
    const testLineId = 10;

    console.log(`\n📝 Processing webhooks for Line ${testLineId}...`);
    console.log('This will extract and populate data into proper tables\n');

    await processor.processWebhooks(testLineId);

    // Get final counts
    const finalCounts = await getTableCounts();

    console.log('\n' + '='.repeat(60));
    console.log('📊 Final Database State:');
    displayCounts(finalCounts);

    console.log('\n' + '='.repeat(60));
    console.log('📈 Changes:');
    console.log(`Cruises:    +${finalCounts.cruises - initialCounts.cruises}`);
    console.log(`Ships:      +${finalCounts.ships - initialCounts.ships}`);
    console.log(`Ports:      +${finalCounts.ports - initialCounts.ports}`);
    console.log(`Regions:    +${finalCounts.regions - initialCounts.regions}`);
    console.log(`Pricing:    +${finalCounts.pricing - initialCounts.pricing}`);

    // Check a sample cruise for detailed data
    console.log('\n' + '='.repeat(60));
    console.log('📋 Sample Cruise Details:');

    const sampleCruise = await db
      .select()
      .from(cruises)
      .where(eq(cruises.cruiseLineId, testLineId))
      .limit(1);

    if (sampleCruise.length > 0) {
      const cruise = sampleCruise[0];
      console.log(`\nCruise ID: ${cruise.id}`);
      console.log(`Name: ${cruise.name}`);
      console.log(`Ship ID: ${cruise.shipId}`);
      console.log(`Nights: ${cruise.nights}`);
      console.log(`Sailing Date: ${cruise.sailingDate}`);
      console.log(`Cheapest Price: ${cruise.currency} ${cruise.cheapestPrice}`);

      // Check if ship was created
      if (cruise.shipId) {
        const ship = await db
          .select()
          .from(ships)
          .where(eq(ships.id, cruise.shipId))
          .limit(1);

        if (ship.length > 0) {
          console.log(`Ship Name: ${ship[0].name}`);
        }
      }

      // Check if ports were created
      if (cruise.embarkationPortId) {
        const port = await db
          .select()
          .from(ports)
          .where(eq(ports.id, cruise.embarkationPortId))
          .limit(1);

        if (port.length > 0) {
          console.log(`Embarkation Port: ${port[0].name}`);
        }
      }

      // Check pricing records
      const pricingRecords = await db
        .select()
        .from(pricing)
        .where(eq(pricing.cruiseId, cruise.id))
        .limit(5);

      console.log(`\nPricing Records: ${pricingRecords.length} found`);

      console.log('\n✅ SUCCESS: Data is being properly extracted and populated!');
    } else {
      console.log('No cruises found for this line');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  }

  console.log('\n' + '='.repeat(60));
  process.exit(0);
}

async function getTableCounts() {
  const cruiseCount = await db.select({ count: sql`count(*)` }).from(cruises);
  const shipCount = await db.select({ count: sql`count(*)` }).from(ships);
  const portCount = await db.select({ count: sql`count(*)` }).from(ports);
  const regionCount = await db.select({ count: sql`count(*)` }).from(regions);
  const pricingCount = await db.select({ count: sql`count(*)` }).from(pricing);

  return {
    cruises: parseInt(cruiseCount[0].count),
    ships: parseInt(shipCount[0].count),
    ports: parseInt(portCount[0].count),
    regions: parseInt(regionCount[0].count),
    pricing: parseInt(pricingCount[0].count),
  };
}

function displayCounts(counts) {
  console.log(`Cruises: ${counts.cruises}`);
  console.log(`Ships:   ${counts.ships}`);
  console.log(`Ports:   ${counts.ports}`);
  console.log(`Regions: ${counts.regions}`);
  console.log(`Pricing: ${counts.pricing}`);
}

// Run the test
testDataExtraction().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
