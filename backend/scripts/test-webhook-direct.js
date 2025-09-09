#!/usr/bin/env node

/**
 * Direct test of webhook processing to isolate issues
 */

const API_URL = process.env.API_URL || 'https://zipsea-backend.onrender.com';

async function testWebhookDirect() {
  console.log('🧪 DIRECT WEBHOOK TEST');
  console.log('======================\n');

  // Test 1: Clear any stuck locks first
  console.log('1️⃣ Clearing any stuck locks...');
  try {
    const clearResponse = await fetch(`${API_URL}/api/webhooks/traveltek/clear-locks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const clearResult = await clearResponse.json();
    console.log('Locks cleared:', clearResult);
  } catch (error) {
    console.log('Error clearing locks:', error.message);
  }

  // Test 2: Try the simple webhook endpoint
  console.log('\n2️⃣ Testing simple webhook endpoint...');
  try {
    const simpleResponse = await fetch(`${API_URL}/api/webhooks/traveltek/simple`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineId: 21 }), // Crystal - 5 cruises
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (simpleResponse.ok) {
      const result = await simpleResponse.json();
      console.log('✅ Simple webhook response:', result);
    } else {
      console.log('❌ Simple webhook failed:', simpleResponse.status);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('⏱️ Simple webhook timed out after 10 seconds');
    } else {
      console.log('❌ Simple webhook error:', error.message);
    }
  }

  // Test 3: Check if the test endpoint itself is working
  console.log('\n3️⃣ Testing test endpoint with timeout...');
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const testResponse = await fetch(`${API_URL}/api/webhooks/traveltek/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineId: 21 }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (testResponse.ok) {
      const result = await testResponse.json();
      console.log('✅ Test endpoint response:', result);
    } else {
      console.log('❌ Test endpoint failed:', testResponse.status);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('⏱️ Test endpoint timed out after 5 seconds');
      console.log('   This suggests the webhook handler is blocking');
    } else {
      console.log('❌ Test endpoint error:', error.message);
    }
  }

  // Test 4: Check system health
  console.log('\n4️⃣ Checking system health...');
  try {
    const healthResponse = await fetch(`${API_URL}/api/health`);
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log('✅ System health:', health);
    }
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }

  // Test 5: Direct cruise line pricing update (main endpoint)
  console.log('\n5️⃣ Testing main webhook endpoint with timeout...');
  try {
    const mainResponse = await fetch(
      `${API_URL}/api/webhooks/traveltek/cruiseline-pricing-updated`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'cruiseline_pricing_updated',
          lineid: 21,
        }),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      }
    );

    if (mainResponse.ok) {
      const result = await mainResponse.json();
      console.log('✅ Main webhook response:', result);

      // Wait a bit and check if processing started
      console.log('\n⏳ Waiting 3 seconds to check processing...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      const diagResponse = await fetch(`${API_URL}/api/webhooks/traveltek/diagnostics`);
      const diag = await diagResponse.json();

      if (diag.diagnostics.activeLocks > 0) {
        console.log('🔒 Processing appears to be running (lock acquired)');
      } else if (diag.diagnostics.recentProcessing?.length > 0) {
        console.log('✅ Processing completed!');
      } else {
        console.log('⚠️ No processing detected');
      }
    } else {
      console.log('❌ Main webhook failed:', mainResponse.status);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('⏱️ Main webhook timed out after 5 seconds');
    } else {
      console.log('❌ Main webhook error:', error.message);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log('\nBased on the results above:');
  console.log('- If endpoints are timing out, the webhook handler is blocking');
  console.log('- If endpoints return but no processing happens, async processing is broken');
  console.log('- If locks are stuck, Redis operations might be blocking');
  console.log('\nCheck Render logs for detailed error messages.');
}

// Run the test
testWebhookDirect().catch(console.error);
