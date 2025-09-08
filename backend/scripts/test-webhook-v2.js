const axios = require('axios');

async function testWebhookFunctionality() {
  console.log('🔍 Testing Webhook Functionality V2');
  console.log('=' .repeat(60));

  // Correct webhook endpoint path
  const WEBHOOK_PATH = '/api/webhooks/traveltek/cruiseline-pricing-updated';

  // Test both staging and production
  const environments = [
    {
      name: 'Staging',
      url: 'https://zipsea-backend.onrender.com',
      expectedStatus: 'operational'
    },
    {
      name: 'Production',
      url: 'https://zipsea-production.onrender.com',
      expectedStatus: 'operational'
    }
  ];

  for (const env of environments) {
    console.log(`\n📍 Testing ${env.name} (${env.url})`);
    console.log('-'.repeat(40));

    try {
      // 1. Test health endpoint
      console.log('Testing health endpoint...');
      const healthResponse = await axios.get(`${env.url}/health`, {
        timeout: 10000
      });
      console.log(`✅ Health check: ${healthResponse.data.status || 'OK'}`);

      // 2. Test webhook endpoint availability
      console.log('\nTesting webhook endpoint availability...');
      const webhookUrl = `${env.url}${WEBHOOK_PATH}`;
      console.log(`   Webhook URL: ${webhookUrl}`);

      try {
        // Try a GET request to check if endpoint exists
        await axios.get(webhookUrl, { timeout: 5000 });
      } catch (getError) {
        if (getError.response && getError.response.status === 405) {
          console.log('✅ Webhook endpoint exists (GET not allowed, POST only)');
        } else if (getError.response && getError.response.status === 404) {
          console.log('❌ Webhook endpoint not found (404)');
        } else {
          console.log('⚠️  Webhook endpoint status:', getError.message);
        }
      }

      // 3. Test webhook with invalid data (should fail gracefully)
      console.log('\nTesting webhook with invalid line ID...');
      try {
        const testResponse = await axios.post(
          webhookUrl,
          {
            lineid: 999999, // Non-existent line
            currency: 'USD',
            timestamp: new Date().toISOString()
          },
          {
            timeout: 10000,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        console.log('✅ Webhook responded:', testResponse.status, testResponse.statusText);
        if (testResponse.data) {
          console.log('   Response:', JSON.stringify(testResponse.data).substring(0, 100));
        }
      } catch (webhookError) {
        if (webhookError.response) {
          const status = webhookError.response.status;
          if (status === 400) {
            console.log('✅ Webhook validated input correctly (400 - bad request)');
          } else if (status === 404) {
            console.log('⚠️  Line not found in database (404)');
          } else if (status === 500) {
            console.log('❌ Webhook returned 500 error - internal server error');
            if (webhookError.response.data) {
              console.log('   Error:', JSON.stringify(webhookError.response.data).substring(0, 200));
            }
          } else {
            console.log(`⚠️  Webhook returned status ${status}`);
          }
        } else {
          console.log('❌ Webhook request failed:', webhookError.message);
        }
      }

    } catch (error) {
      console.log(`❌ ${env.name} test failed:`, error.message);
    }
  }

  // Test with real cruise line IDs
  console.log('\n' + '='.repeat(60));
  console.log('📍 Testing with Real Cruise Lines');
  console.log('-'.repeat(40));

  // Test a few known cruise lines
  const testLines = [
    { id: 18, name: 'Celebrity Cruises' },
    { id: 27, name: 'Royal Caribbean' },
    { id: 1, name: 'Carnival Cruise Line' }
  ];

  for (const line of testLines) {
    console.log(`\n🚢 Testing ${line.name} (Line ID: ${line.id})`);

    try {
      const response = await axios.post(
        `https://zipsea-production.onrender.com${WEBHOOK_PATH}`,
        {
          lineid: line.id, // Lowercase 'lineid' as expected by webhook
          currency: 'USD',
          timestamp: new Date().toISOString()
        },
        {
          timeout: 30000, // Longer timeout for real processing
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Webhook triggered successfully for ${line.name}!`);
      console.log('   Status:', response.status);
      if (response.data) {
        const dataStr = JSON.stringify(response.data, null, 2);
        console.log('   Response:', dataStr.substring(0, 200));
      }

      // Add delay between requests to avoid overwhelming the server
      console.log('   Waiting 5 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
      if (error.response) {
        console.log(`⚠️  Webhook returned error for ${line.name}:`, error.response.status);
        if (error.response.data) {
          console.log('   Error details:', JSON.stringify(error.response.data, null, 2).substring(0, 300));
        }
      } else {
        console.log(`❌ Webhook request failed for ${line.name}:`, error.message);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test completed');
  console.log('\n📝 SUMMARY:');
  console.log('- Webhook endpoint: /api/webhooks/traveltek/cruiseline-pricing-updated');
  console.log('- Expected payload: { lineid: number, currency: string, timestamp: string }');
  console.log('- Processing: Downloads and updates pricing from FTP (max 500 cruises per webhook)');
  console.log('- Monitor: Check Render logs for detailed processing information');
  console.log('- Slack: Notifications should appear in Slack channel after processing');
  console.log('\n🔍 To check if FTP sync is working:');
  console.log('1. Check Slack for webhook notifications');
  console.log('2. Query database for recent updates:');
  console.log('   SELECT COUNT(*) FROM cruises WHERE updated_at > NOW() - INTERVAL \'1 hour\';');
  console.log('3. Check Render logs for webhook processing details');
}

testWebhookFunctionality().catch(console.error);
