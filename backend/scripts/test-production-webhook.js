const https = require('https');
require('dotenv').config();
const { Client } = require('pg');

// Use PRODUCTION URL
const WEBHOOK_URL = 'https://zipsea-production.onrender.com/api/webhooks/traveltek';

const payload = {
  event: 'cruiseline-pricing-updated',
  lineId: 1,
  timestamp: new Date().toISOString(),
  test: true,
  message: 'Test webhook on production deployment'
};

const postData = JSON.stringify(payload);

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🚀 Sending test webhook to PRODUCTION:', WEBHOOK_URL);
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

      if (response.eventIds && response.eventIds.length > 0) {
        console.log('\n🎉 SUCCESS! Webhook event IDs created:', response.eventIds);

        // Verify in database
        console.log('\n📊 Checking database for webhook events...');

        const client = new Client({
          connectionString: process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false }
        });

        await client.connect();

        const result = await client.query(`
          SELECT id, line_id, webhook_type, status, received_at
          FROM webhook_events
          WHERE id = ANY($1::int[])
        `, [response.eventIds]);

        console.log(`\n✅ Found ${result.rows.length} webhook events in database:`);
        result.rows.forEach(row => {
          console.log(`  - ID: ${row.id}, Line: ${row.line_id}, Type: ${row.webhook_type}, Status: ${row.status}`);
        });

        await client.end();
      } else if (response.status === 'error') {
        console.log('\n❌ Webhook failed:', response.message);
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
