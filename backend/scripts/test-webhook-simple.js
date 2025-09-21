const https = require('https');

// Simplified test to get better error info
const testData = JSON.stringify({
  event: 'test',
  lineId: 1
});

const options = {
  hostname: 'zipsea-backend.onrender.com',
  path: '/api/webhooks/traveltek',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': testData.length
  }
};

console.log('Sending simple webhook test...');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);

    // Try parsing as JSON
    try {
      const parsed = JSON.parse(data);
      if (parsed.error) {
        console.log('\nError details:', parsed.error);
      }
      if (parsed.eventIds) {
        console.log('\nSuccess! Event IDs created:', parsed.eventIds);
      }
    } catch (e) {
      // Not JSON, that's ok
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.write(testData);
req.end();
