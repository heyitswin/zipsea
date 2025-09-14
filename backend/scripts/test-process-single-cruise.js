#!/usr/bin/env node

require('dotenv').config();
const { WebhookProcessorOptimizedV2 } = require('../dist/services/webhook-processor-optimized-v2.service');

async function testProcessSingleCruise() {
  console.log('Testing direct processing of cruise 2143102...\n');

  // Create a file object as the processor would discover it
  const testFile = {
    path: '/2025/10/22/4439/2143102.json',
    name: '2143102.json',
    lineId: 22,
    shipId: 4439,
    cruiseId: '2143102',
    size: 267525,
    year: 2025,
    month: 10
  };

  console.log('File to process:', JSON.stringify(testFile, null, 2));
  console.log('\nAttempting to process file...\n');

  try {
    // Use the static method that the worker would call
    const result = await WebhookProcessorOptimizedV2.processFileStatic(testFile);

    console.log('\n✅ Processing completed successfully!');
    console.log('Result:', result);

    // Now check if the database was updated
    const { db } = require('../dist/db/connection');
    const { cruises, cheapestPricing } = require('../dist/db/schema');
    const { eq } = require('drizzle-orm');

    const updatedCruise = await db.select({
      id: cruises.id,
      updatedAt: cruises.updatedAt,
      lastCached: cruises.lastCached
    })
    .from(cruises)
    .where(eq(cruises.id, '2143102'))
    .limit(1);

    if (updatedCruise.length > 0) {
      console.log('\nCruise in database after processing:');
      console.log('  updatedAt:', updatedCruise[0].updatedAt);
      console.log('  lastCached:', updatedCruise[0].lastCached);
    }

    const updatedPricing = await db.select({
      interiorPrice: cheapestPricing.interiorPrice,
      oceanviewPrice: cheapestPricing.oceanviewPrice,
      balconyPrice: cheapestPricing.balconyPrice,
      updatedAt: cheapestPricing.updatedAt
    })
    .from(cheapestPricing)
    .where(eq(cheapestPricing.cruiseId, '2143102'))
    .limit(1);

    if (updatedPricing.length > 0) {
      console.log('\nPricing after processing:');
      console.log('  Interior: $' + updatedPricing[0].interiorPrice);
      console.log('  Ocean View: $' + updatedPricing[0].oceanviewPrice);
      console.log('  Balcony: $' + updatedPricing[0].balconyPrice);
      console.log('  updatedAt:', updatedPricing[0].updatedAt);
    }

  } catch (error) {
    console.error('\n❌ Error processing file:', error);
    console.error('Stack trace:', error.stack);
  }

  process.exit(0);
}

testProcessSingleCruise().catch(console.error);
