const https = require('https');

const WEBHOOK_URL = 'https://zipsea-backend.onrender.com/api/webhooks/traveltek';
const API_KEY = 'sk_test_nFMLRbtLOc8R0Yw23C6GhBJJ4gD_9l2V'; // Test API key

// Create test webhook payload
const payload = {
  event: 'cruiseline-pricing-updated',
  lineId: 1, // Test with a specific line ID
  timestamp: new Date().toISOString(),
  test: true,
  message: 'Test webhook to verify status tracking',
};

const postData = JSON.stringify(payload);

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'X-API-Key': API_KEY,
  },
};

console.log('🚀 Sending test webhook to:', WEBHOOK_URL);
console.log('📦 Payload:', JSON.stringify(payload, null, 2));

const req = https.request(WEBHOOK_URL, options, res => {
  let data = '';

  res.on('data', chunk => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n✅ Response received:');
    console.log('  Status:', res.statusCode, res.statusMessage);
    console.log('  Headers:', res.headers);
    console.log('  Body:', data);

    if (res.statusCode === 200) {
      try {
        const response = JSON.parse(data);
        if (response.eventIds && response.eventIds.length > 0) {
          console.log('\n✅ Webhook event created with IDs:', response.eventIds);
          console.log(
            '\n📝 Now run the status check script to verify the event is being processed:'
          );
          console.log('   node scripts/test-webhook-status-fix.js');
        }
      } catch (e) {
        console.log('  (Could not parse response as JSON)');
      }
    } else {
      console.log('\n❌ Webhook rejected with status:', res.statusCode);
    }
  });
});

req.on('error', e => {
  console.error('❌ Error sending webhook:', e.message);
});

req.write(postData);
req.end();

console.log('\n⏳ Waiting for response...');
