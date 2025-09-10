#!/usr/bin/env node

/**
 * Test script for the fixed Webhook Processor V2
 * Tests pricing extraction, month scanning, and BullMQ integration
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'https://zipsea-backend.onrender.com';

async function testWebhook() {
  console.log('🧪 Testing Fixed Webhook Processor V2');
  console.log('=' .repeat(50));

  try {
    // Test with a small cruise line first (line 14 has only 1 cruise)
    console.log('\n1️⃣ Testing with Line 14 (Small test)...');
    const testResponse = await axios.post(`${BASE_URL}/api/webhooks/traveltek/test`, {
      lineId: 14
    });

    console.log('✅ Webhook accepted:', testResponse.data);

    // Wait a bit for processing to start
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check diagnostics
    console.log('\n2️⃣ Checking diagnostics...');
    const diagResponse = await axios.get(`${BASE_URL}/api/webhooks/traveltek/diagnostics`);
    console.log('📊 Diagnostics:', JSON.stringify(diagResponse.data, null, 2));

    // Test with a larger cruise line
    console.log('\n3️⃣ Testing with Line 22 (Royal Caribbean)...');
    const rcResponse = await axios.post(`${BASE_URL}/api/webhooks/traveltek/test`, {
      lineId: 22
    });

    console.log('✅ Webhook accepted:', rcResponse.data);

    // Check queue status if available
    if (rcResponse.data.jobId || rcResponse.data.jobCount) {
      console.log(`📦 Queued ${rcResponse.data.jobCount || 1} jobs for processing`);
      console.log(`   Job IDs: ${rcResponse.data.jobIds || [rcResponse.data.jobId]}`);
    }

    // Monitor for a bit
    console.log('\n4️⃣ Monitoring processing for 30 seconds...');
    for (let i = 0; i < 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      try {
        const statusResponse = await axios.get(`${BASE_URL}/api/webhooks/traveltek/diagnostics`);
        const activeLocks = statusResponse.data.activeLocks || [];
        const queueStatus = statusResponse.data.queueStatus || {};

        console.log(`   [${new Date().toISOString().split('T')[1].split('.')[0]}] Active locks: ${activeLocks.length}, Queue: ${JSON.stringify(queueStatus)}`);
      } catch (error) {
        console.log(`   [${new Date().toISOString().split('T')[1].split('.')[0]}] Status check failed:`, error.message);
      }
    }

    console.log('\n✅ Test completed successfully!');
    console.log('\n📝 What to verify:');
    console.log('1. Check Render logs for [OPTIMIZED-V2] and [WORKER-V2] entries');
    console.log('2. Look for "Scanning years: 2025, 2026" showing full year scanning');
    console.log('3. Check for "Updated cheapest_pricing for cruise X" entries');
    console.log('4. Verify BullMQ job processing with "Job X completed" messages');
    console.log('5. Check Slack for update notifications');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);

    if (error.response?.status === 404) {
      console.log('\n⚠️  The test endpoint might not be deployed yet.');
      console.log('   Make sure the latest code is deployed to Render.');
    }
  }
}

// Run the test
testWebhook().catch(console.error);
