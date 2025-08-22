#!/usr/bin/env node

/**
 * TEST WEBHOOK ENDPOINT
 * 
 * This script tests the Traveltek webhook endpoint to ensure:
 * 1. Webhook is reachable and responding
 * 2. Price updates are processed correctly
 * 3. Price snapshots are created
 * 4. Database is updated properly
 */

require('dotenv').config();
const fetch = require('node-fetch');
const postgres = require('postgres');

// Configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://zipsea-staging.onrender.com/api/webhooks/traveltek';
const DATABASE_URL = process.env.DATABASE_URL;

const sql = postgres(DATABASE_URL, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Sample webhook payload based on Traveltek format
const createTestPayload = () => ({
  event: 'price_update',
  timestamp: new Date().toISOString(),
  data: {
    cruiseid: 12345,
    codetocruiseid: 2222449,
    lineid: 16,
    shipid: 123,
    saildate: '2025-09-15',
    prices: {
      'STANDARD': {
        'INSIDE': {
          'DOUBLE': {
            price: 899.00,
            taxes: 125.00,
            ncf: 50.00,
            gratuity: 75.00,
            fuel: 0,
            deposit: 250.00,
            insurance: 0,
            other: 0,
            total: 1149.00,
            currency: 'USD'
          }
        }
      }
    },
    cheapest: {
      combined: {
        inside: 899.00,
        oceanview: 999.00,
        balcony: 1199.00,
        suite: 1599.00
      }
    }
  }
});

async function testWebhookEndpoint() {
  console.log('🧪 TESTING WEBHOOK ENDPOINT');
  console.log('============================\n');
  
  console.log('Webhook URL:', WEBHOOK_URL);
  console.log('');
  
  // Step 1: Check current state
  console.log('📊 Checking current database state...');
  const beforeSnapshot = await sql`
    SELECT COUNT(*) as count FROM price_snapshots
  `;
  const beforeEvents = await sql`
    SELECT COUNT(*) as count FROM webhook_events
  `;
  
  console.log(`   Price Snapshots: ${beforeSnapshot[0].count}`);
  console.log(`   Webhook Events: ${beforeEvents[0].count}`);
  console.log('');
  
  // Step 2: Send test webhook
  console.log('📤 Sending test webhook...');
  const payload = createTestPayload();
  console.log('   Payload:', JSON.stringify(payload, null, 2).substring(0, 200) + '...');
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.WEBHOOK_SECRET || 'test-secret'
      },
      body: JSON.stringify(payload)
    });
    
    console.log(`   Response Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('   ✅ Webhook accepted:', result);
    } else {
      const error = await response.text();
      console.log('   ❌ Webhook rejected:', error);
    }
  } catch (error) {
    console.log('   ❌ Failed to send webhook:', error.message);
  }
  
  console.log('');
  
  // Step 3: Wait a moment for processing
  console.log('⏳ Waiting 2 seconds for processing...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('');
  
  // Step 4: Check if data was stored
  console.log('📊 Checking database after webhook...');
  const afterSnapshot = await sql`
    SELECT COUNT(*) as count FROM price_snapshots
  `;
  const afterEvents = await sql`
    SELECT COUNT(*) as count FROM webhook_events
  `;
  
  console.log(`   Price Snapshots: ${afterSnapshot[0].count} (${afterSnapshot[0].count > beforeSnapshot[0].count ? '+' + (afterSnapshot[0].count - beforeSnapshot[0].count) : 'no change'})`);
  console.log(`   Webhook Events: ${afterEvents[0].count} (${afterEvents[0].count > beforeEvents[0].count ? '+' + (afterEvents[0].count - beforeEvents[0].count) : 'no change'})`);
  console.log('');
  
  // Step 5: Check latest webhook event
  const latestEvent = await sql`
    SELECT * FROM webhook_events 
    ORDER BY created_at DESC 
    LIMIT 1
  `;
  
  if (latestEvent.length > 0) {
    console.log('📝 Latest webhook event:');
    console.log(`   ID: ${latestEvent[0].id}`);
    console.log(`   Event Type: ${latestEvent[0].event_type}`);
    console.log(`   Status: ${latestEvent[0].status}`);
    console.log(`   Created: ${latestEvent[0].created_at}`);
    
    if (latestEvent[0].error) {
      console.log(`   Error: ${latestEvent[0].error}`);
    }
  }
  
  console.log('');
  
  // Step 6: Check latest price snapshot
  const latestSnapshot = await sql`
    SELECT * FROM price_snapshots 
    ORDER BY created_at DESC 
    LIMIT 1
  `;
  
  if (latestSnapshot.length > 0) {
    console.log('💰 Latest price snapshot:');
    console.log(`   Cruise ID: ${latestSnapshot[0].cruise_id}`);
    console.log(`   Inside: $${latestSnapshot[0].inside_price}`);
    console.log(`   Oceanview: $${latestSnapshot[0].oceanview_price}`);
    console.log(`   Balcony: $${latestSnapshot[0].balcony_price}`);
    console.log(`   Suite: $${latestSnapshot[0].suite_price}`);
    console.log(`   Created: ${latestSnapshot[0].created_at}`);
  }
  
  console.log('\n' + '='.repeat(40));
  console.log('✅ WEBHOOK TEST COMPLETE');
  console.log('='.repeat(40) + '\n');
  
  await sql.end();
}

// Run the test
testWebhookEndpoint().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});