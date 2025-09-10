#!/usr/bin/env node

/**
 * Test script to verify webhook processor handles new cruises properly
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { getWebhookProcessorSimple } = require('../dist/services/webhook-processor-simple.service');
const { db } = require('../dist/db');
const { webhookEvents } = require('../dist/db/schema');
const { desc } = require('drizzle-orm');

async function testNewCruiseHandling() {
  console.log('='.repeat(60));
  console.log('Testing New Cruise Handling');
  console.log('='.repeat(60));

  const processor = getWebhookProcessorSimple();

  try {
    // Test with line 10 which has a small number of cruises
    const testLineId = 10;

    console.log(`\n📝 Testing webhook processing for Line ${testLineId}`);
    console.log('This will show how the system handles both existing and new cruises\n');

    // Process files
    await processor.processWebhooks(testLineId);

    console.log('\n' + '='.repeat(60));
    console.log('Checking webhook events for new cruises...\n');

    // Check webhook events to see what was detected
    const recentEvents = await db
      .select()
      .from(webhookEvents)
      .where(webhookEvents.lineId.eq(testLineId))
      .orderBy(desc(webhookEvents.processedAt))
      .limit(10);

    let newCruisesDetected = 0;
    let existingCruisesUpdated = 0;

    recentEvents.forEach(event => {
      if (event.webhookType === 'new_cruise') {
        newCruisesDetected++;
        console.log(`🆕 New cruise detected: ${event.metadata?.cruiseCode}`);
        if (event.metadata?.cruiseData) {
          const data = event.metadata.cruiseData;
          console.log(`   Name: ${data.name || data.cruise_name}`);
          console.log(`   Ship: ${data.shipname || data.ship_name}`);
          console.log(`   Nights: ${data.nights}`);
          console.log(`   Sail Date: ${data.saildate || data.sail_date}`);
        }
      } else if (event.webhookType === 'cruise_update') {
        existingCruisesUpdated++;
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY:');
    console.log(`New cruises detected: ${newCruisesDetected}`);
    console.log(`Existing cruises updated: ${existingCruisesUpdated}`);

    if (newCruisesDetected > 0) {
      console.log('\n✅ SUCCESS: System correctly identifies new cruises!');
      console.log('These cruises are marked as "new_cruise" in webhook_events');
      console.log('A separate sync process can create them in the database');
    } else {
      console.log('\n📝 All cruises already exist in the database');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  }

  console.log('\n' + '='.repeat(60));
  process.exit(0);
}

// Run the test
testNewCruiseHandling().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
