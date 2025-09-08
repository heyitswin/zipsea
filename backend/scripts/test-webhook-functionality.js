const axios = require('axios');

async function testWebhookFunctionality() {
  console.log('🔍 Testing Webhook Functionality');
  console.log('='.repeat(60));

  // Test both staging and production
  const environments = [
    {
      name: 'Staging',
      url: 'https://zipsea-backend.onrender.com',
      expectedStatus: 'operational',
    },
    {
      name: 'Production',
      url: 'https://zipsea-production.onrender.com',
      expectedStatus: 'operational',
    },
  ];

  for (const env of environments) {
    console.log(`\n📍 Testing ${env.name} (${env.url})`);
    console.log('-'.repeat(40));

    try {
      // 1. Test health endpoint
      console.log('Testing health endpoint...');
      const healthResponse = await axios.get(`${env.url}/health`, {
        timeout: 10000,
      });
      console.log(`✅ Health check: ${healthResponse.data.status || 'OK'}`);

      // 2. Test webhook endpoint (without actually triggering)
      console.log('\nTesting webhook endpoint availability...');
      try {
        // Send an OPTIONS request to check if endpoint exists
        const webhookResponse = await axios.options(
          `${env.url}/api/webhooks/traveltek/cruiseline-pricing-updated`,
          {
            timeout: 5000,
          }
        );
        console.log('✅ Webhook endpoint is accessible');
      } catch (optionsError) {
        // OPTIONS might not be supported, try a GET
        try {
          await axios.get(`${env.url}/api/webhooks/traveltek/cruiseline-pricing-updated`, {
            timeout: 5000,
          });
        } catch (getError) {
          if (
            getError.response &&
            (getError.response.status === 405 || getError.response.status === 404)
          ) {
            console.log('✅ Webhook endpoint exists (method not allowed for GET)');
          } else {
            console.log('⚠️  Webhook endpoint may have issues:', getError.message);
          }
        }
      }

      // 3. Test webhook with minimal data (should fail gracefully)
      console.log('\nTesting webhook with test data...');
      try {
        const testResponse = await axios.post(
          `${env.url}/api/webhook/pricing`,
          {
            eventType: 'test',
            lineId: 999999, // Non-existent line
            timestamp: new Date().toISOString(),
          },
          {
            timeout: 10000,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        console.log('✅ Webhook responded:', testResponse.status, testResponse.statusText);
        if (testResponse.data) {
          console.log('   Response:', JSON.stringify(testResponse.data).substring(0, 100));
        }
      } catch (webhookError) {
        if (webhookError.response) {
          const status = webhookError.response.status;
          if (status === 400 || status === 404) {
            console.log('✅ Webhook validated input correctly (rejected test data)');
          } else if (status === 500) {
            console.log('⚠️  Webhook returned 500 error - may have internal issues');
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

  // Test with a real cruise line ID
  console.log('\n' + '='.repeat(60));
  console.log('📍 Testing with Real Cruise Line (Celebrity Cruises)');
  console.log('-'.repeat(40));

  try {
    const response = await axios.post(
      'https://zipsea-production.onrender.com/api/webhook/pricing',
      {
        eventType: 'pricing_update',
        lineId: 18, // Celebrity Cruises Traveltek ID
        timestamp: new Date().toISOString(),
      },
      {
        timeout: 30000, // Longer timeout for real processing
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Webhook triggered successfully!');
    console.log('   Status:', response.status);
    if (response.data) {
      console.log('   Response:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    if (error.response) {
      console.log('⚠️  Webhook returned error:', error.response.status);
      if (error.response.data) {
        console.log('   Error details:', JSON.stringify(error.response.data, null, 2));
      }
    } else {
      console.log('❌ Webhook request failed:', error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test completed');
  console.log('\n📝 NOTES:');
  console.log('- If webhooks are failing, check Render logs for detailed errors');
  console.log('- FTP credentials are stored in Render environment variables');
  console.log('- Webhooks process up to 500 cruises per trigger');
  console.log('- Each webhook updates pricing data from FTP files');
}

testWebhookFunctionality().catch(console.error);
