#!/usr/bin/env npx tsx

/**
 * Trigger Royal Caribbean Webhook for Live Testing
 * 
 * This script sends a real webhook to test the bulk FTP downloader
 * with Royal Caribbean line 22 in a controlled way.
 */

import axios from 'axios';

async function triggerWebhook() {
  console.log('🚀 Triggering Royal Caribbean Webhook for Bulk FTP Testing');
  console.log('========================================================');

  const webhookPayload = {
    event: 'cruiseline_pricing_updated',
    lineid: 22, // Royal Caribbean
    marketid: 0,
    currency: 'USD',
    description: 'LIVE TEST: Royal Caribbean bulk FTP downloader verification',
    source: 'manual_bulk_ftp_test',
    timestamp: Math.floor(Date.now() / 1000)
  };

  try {
    console.log('📡 Sending webhook to backend...');
    console.log('Payload:', JSON.stringify(webhookPayload, null, 2));

    const response = await axios.post(
      'http://localhost:3001/api/webhooks/traveltek/cruiseline-pricing-updated',
      webhookPayload,
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n✅ Webhook sent successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));

    console.log('\n📊 Expected Processing Flow:');
    console.log('1. 🔍 RealtimeWebhookService will get all Royal Caribbean cruises');
    console.log('2. 📦 Cruises will be processed in mega-batches of 500');
    console.log('3. 📡 BulkFtpDownloader will use 3-5 persistent FTP connections');
    console.log('4. 💾 All cruise files downloaded to memory first');
    console.log('5. 🔄 Database updated from cached data (no repeated FTP calls)');
    console.log('6. 📢 Slack notification with bulk processing metrics');

    console.log('\n🔍 Monitor the following:');
    console.log('- Check Slack for bulk processing notifications');
    console.log('- Backend logs will show FTP connection pooling');
    console.log('- Processing time should be much faster than individual approach');
    console.log('- Database will be updated with new pricing');

    console.log(`\n✅ Webhook triggered with Job ID: ${response.data.processingJobId}`);
    console.log('Check the backend logs and Slack for processing updates!');

  } catch (error) {
    console.error('❌ Failed to trigger webhook:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.log('Response data:', error.response.data);
    }
  }
}

triggerWebhook().catch(console.error);