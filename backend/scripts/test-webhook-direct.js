#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'https://zipsea-production.onrender.com';

async function testWebhookEndpoint() {
  console.log('🔍 Testing webhook endpoint directly...');
  console.log(`📍 Target: ${BASE_URL}/api/webhooks/traveltek/cruiseline-pricing-updated`);

  const webhookPayload = {
    event: 'cruiseline_pricing_updated',
    lineid: 22, // Royal Caribbean
    marketid: 1,
    currency: 'USD',
    description: 'Direct test of webhook endpoint',
    source: 'test_script',
    timestamp: Math.floor(Date.now() / 1000)
  };

  try {
    console.log('\n📤 Sending webhook payload:', JSON.stringify(webhookPayload, null, 2));

    const response = await axios.post(
      `${BASE_URL}/api/webhooks/traveltek/cruiseline-pricing-updated`,
      webhookPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Webhook': 'direct-test'
        },
        timeout: 10000
      }
    );

    console.log('\n✅ Response received:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

    if (response.data.webhookId) {
      console.log('\n🔑 Webhook ID:', response.data.webhookId);
      console.log('⏱️ Processing mode:', response.data.processingMode);
    }

    // Also test the generic endpoint
    console.log('\n📤 Testing generic /traveltek endpoint...');
    const genericResponse = await axios.post(
      `${BASE_URL}/api/webhooks/traveltek`,
      webhookPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Webhook': 'direct-test-generic'
        },
        timeout: 10000
      }
    );

    console.log('\n✅ Generic endpoint response:');
    console.log('Status:', genericResponse.status);
    console.log('Data:', JSON.stringify(genericResponse.data, null, 2));

  } catch (error) {
    console.error('\n❌ Error testing webhook:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testWebhookEndpoint();
