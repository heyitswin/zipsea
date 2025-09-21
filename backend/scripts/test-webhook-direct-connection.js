const https = require('https');
require('dotenv').config();
const { Client } = require('pg');

const WEBHOOK_URL = 'https://zipsea-backend.onrender.com/api/webhooks/traveltek';
const API_KEY = 'sk_test_nFMLRbtLOc8R0Yw23C6GhBJJ4gD_9l2V';

// Create test webhook payload
const payload = {
  event: 'cruiseline-pricing-updated',
  lineId: 1,
  timestamp: new Date().toISOString(),
  test: true,
  message: 'Test webhook to verify status tracking'
};

const postData = JSON.stringify(payload);

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'X-API-Key': API_KEY
  }
};

console.log('🚀 Sending test webhook to:', WEBHOOK_URL);
console.log('📦 Payload:', JSON.stringify(payload, null, 2));

const req = https.request(WEBHOOK_URL, options, async (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', async () => {
    console.log('\n✅ Response received:');
    console.log('  Status:', res.statusCode, res.statusMessage);
    console.log('  Body:', data);

    try {
      const response = JSON.parse(data);

      // Now check directly in the database
      console.log('\n📊 Checking database for webhook events...');

      const client = new Client({
        connectionString: process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      await client.connect();

      // Check for recent webhook events
      const result = await client.query(`
        SELECT id, line_id, webhook_type, status, received_at
        FROM webhook_events
        WHERE received_at > NOW() - INTERVAL '1 minute'
        ORDER BY id DESC
        LIMIT 5
      `);

      console.log(`\nFound ${result.rows.length} webhook events in the last minute:`);
      result.rows.forEach(row => {
        console.log(`  - ID: ${row.id}, Line: ${row.line_id}, Type: ${row.webhook_type}, Status: ${row.status}`);
      });

      await client.end();

      if (result.rows.length === 0) {
        console.log('\n❌ No webhook events were created in the database!');
        console.log('This suggests the webhook route is failing before database insertion.');
      } else {
        console.log('\n✅ Webhook events are being created!');
      }

    } catch (e) {
      console.error('Error:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Error sending webhook:', e.message);
});

req.write(postData);
req.end();
