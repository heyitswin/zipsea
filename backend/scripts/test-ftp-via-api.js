#!/usr/bin/env node

/**
 * Test FTP credentials via API endpoint
 * This script calls a test endpoint on the deployed service to check FTP configuration
 */

const axios = require('axios');

const ENV = process.env.ENV || 'staging';
const API_URL = ENV === 'production'
  ? 'https://zipsea-production.onrender.com'
  : 'https://zipsea-backend.onrender.com';

async function testFTPViaAPI() {
  console.log('🔍 Testing FTP Configuration via API');
  console.log(`📍 Environment: ${ENV}`);
  console.log(`🔗 API URL: ${API_URL}`);
  console.log('============================================================\n');

  try {
    // Try to trigger a test webhook with a small line
    console.log('📤 Triggering test webhook for line 14 (Holland America)...');
    const response = await axios.post(
      `${API_URL}/api/webhooks/traveltek/test`,
      { lineId: 14 },
      {
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true // Don't throw on any status
      }
    );

    if (response.status === 404) {
      console.log('❌ Test endpoint not found - deployment may be pending');
      return;
    }

    if (response.status === 200) {
      console.log('✅ Webhook accepted');
      console.log('📝 Response:', response.data);

      // Wait a bit then check status
      console.log('\n⏳ Waiting 10 seconds to check processing status...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Check webhook status
      const statusResponse = await axios.get(
        `${API_URL}/api/webhooks/traveltek/status?days=1&limit=5`,
        { validateStatus: () => true }
      );

      if (statusResponse.status === 200 && statusResponse.data) {
        console.log('\n📊 Recent webhook activity:');
        const recent = statusResponse.data.recentWebhooks || [];
        recent.forEach(wh => {
          console.log(`   Line ${wh.lineId}: ${wh.successful || 0} successful, ${wh.failed || 0} failed`);
        });
      }
    } else {
      console.log(`❌ Unexpected response: ${response.status}`);
      console.log('📝 Data:', response.data);
    }
  } catch (error) {
    console.error('❌ Error testing FTP via API:', error.message);
  }
}

testFTPViaAPI();
