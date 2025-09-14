#!/usr/bin/env node

const fetch = require('node-fetch');
require('dotenv').config();

async function forceSyncCruise() {
  console.log('🔄 FORCING SYNC FOR CRUISE 2143102');
  console.log('===================================\n');

  // Trigger webhook for Royal Caribbean (line 22)
  const webhookUrl = 'https://api.zipsea.com/api/webhooks/traveltek';

  const payload = {
    event: 'cruises_live_pricing_updated',
    cruise_line_id: 22,
    lineId: 22,
    message: 'Force sync for cruise 2143102',
    paths: [
      '2025/10/22/4439/2143102.json'
    ]
  };

  console.log('Sending webhook to:', webhookUrl);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (response.ok) {
      console.log('\n✅ Webhook sent successfully!');
      console.log('Response:', JSON.stringify(result, null, 2));

      console.log('\n⏳ Webhook will process in background...');
      console.log('Check logs for OPTIMIZED-V2 entries for cruise 2143102');

      // Wait a bit then check if the cruise was updated
      console.log('\nWaiting 30 seconds for processing...');
      await new Promise(resolve => setTimeout(resolve, 30000));

      // Check the API for updated pricing
      console.log('\n📊 Checking for updated pricing...');
      const apiResponse = await fetch('https://api.zipsea.com/api/v1/cruises/2143102');
      const cruiseData = await apiResponse.json();

      if (cruiseData.success) {
        console.log('\nCurrent pricing in database:');
        const pricing = cruiseData.data.cheapestPricing;
        if (pricing) {
          console.log(`  Interior: $${pricing.interior?.price || 'N/A'}`);
          console.log(`  Ocean View: $${pricing.oceanview?.price || 'N/A'}`);
          console.log(`  Balcony: $${pricing.balcony?.price || 'N/A'}`);
          console.log(`  Suite: $${pricing.suite?.price || 'N/A'}`);
        }

        console.log('\nExpected pricing from FTP:');
        console.log('  Interior: $801');
        console.log('  Ocean View: N/A');
        console.log('  Balcony: $1,354');
        console.log('  Suite: N/A');

        // Check if updated
        if (pricing?.interior?.price === 801) {
          console.log('\n✅ PRICES UPDATED SUCCESSFULLY!');
        } else {
          console.log('\n⚠️  Prices not yet updated. May need more time or manual intervention.');
        }
      }

    } else {
      console.log('\n❌ Webhook failed!');
      console.log('Status:', response.status);
      console.log('Response:', JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

forceSyncCruise();
