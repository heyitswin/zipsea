#!/usr/bin/env node

const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'https://zipsea-production.onrender.com';

async function testWebhook() {
  console.log('🧪 Testing webhook processing...\n');

  try {
    // Test with a small cruise line (Celebrity - ID 20)
    const response = await axios.post(`${BACKEND_URL}/api/webhooks/traveltek`, {
      event: 'cruise_line_update',
      lineId: 20,
      test: true,
      timestamp: new Date().toISOString()
    });

    console.log('✅ Webhook accepted:', response.data);
    console.log('\n📝 Check Slack for processing completion notification');
    console.log('📊 Monitor logs at: https://dashboard.render.com/web/srv-d2idrj3ipnbc73abnee0/logs');

  } catch (error) {
    console.error('❌ Failed to send webhook:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testWebhook();
