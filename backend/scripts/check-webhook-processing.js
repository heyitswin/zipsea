#!/usr/bin/env node

/**
 * Check webhook processing status without database access
 * Uses API endpoints to verify webhook functionality
 */

const BASE_URL = process.env.API_URL || 'https://zipsea-backend.onrender.com';

async function checkWebhookProcessing() {
  console.log('🔍 WEBHOOK PROCESSING CHECK');
  console.log('===========================');
  console.log(`API: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  try {
    // 1. Check diagnostics
    console.log('1️⃣ Checking system diagnostics...');
    const diagResponse = await fetch(`${BASE_URL}/api/webhooks/traveltek/diagnostics`);
    const diagnostics = await diagResponse.json();

    if (diagnostics.success) {
      console.log('✅ FTP Connection:', diagnostics.diagnostics.ftpConnection);
      console.log('✅ Redis Status:', diagnostics.diagnostics.redisStatus);
      console.log('🔒 Active Locks:', diagnostics.diagnostics.activeLocks);

      if (diagnostics.diagnostics.recentProcessing && diagnostics.diagnostics.recentProcessing.length > 0) {
        console.log('\n📊 Recent Processing:');
        diagnostics.diagnostics.recentProcessing.forEach(p => {
          console.log(`  - Line ${p.lineId}: ${p.status} (${p.timestamp})`);
        });
      } else {
        console.log('⚠️  No recent processing detected');
      }

      if (diagnostics.recommendations && diagnostics.recommendations.length > 0) {
        console.log('\n⚠️  Recommendations:');
        diagnostics.recommendations.forEach(r => console.log(`  - ${r}`));
      }
    }

    // 2. Check for stuck locks and clear if needed
    if (diagnostics.diagnostics.activeLocks > 0) {
      console.log('\n2️⃣ Found active locks, attempting to clear...');
      const clearResponse = await fetch(`${BASE_URL}/api/webhooks/traveltek/clear-locks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const clearResult = await clearResponse.json();
      if (clearResult.success) {
        console.log(`✅ Cleared ${clearResult.cleared.length} lock(s)`);
        clearResult.cleared.forEach(lock => {
          console.log(`  - Line ${lock.lineId} (${lock.webhookId})`);
        });
      }
    }

    // 3. Test with a small cruise line
    console.log('\n3️⃣ Testing webhook with Crystal Cruises (5 cruises)...');
    const testResponse = await fetch(`${BASE_URL}/api/webhooks/traveltek/cruiseline-pricing-updated`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'cruiseline_pricing_updated',
        lineid: 21 // Crystal Cruises - only 5 cruises
      })
    });

    const testResult = await testResponse.json();
    if (testResult.success) {
      console.log('✅ Test webhook accepted');
      console.log(`  Webhook ID: ${testResult.webhookId}`);
      console.log(`  Processing Mode: ${testResult.processingMode}`);

      // Wait and check status
      console.log('\n⏳ Waiting 10 seconds for processing...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Check status again
      const statusResponse = await fetch(`${BASE_URL}/api/webhooks/traveltek/diagnostics`);
      const statusCheck = await statusResponse.json();

      if (statusCheck.diagnostics.recentProcessing && statusCheck.diagnostics.recentProcessing.length > 0) {
        console.log('✅ Processing detected!');
        statusCheck.diagnostics.recentProcessing.forEach(p => {
          console.log(`  - Line ${p.lineId}: ${p.status}`);
        });
      } else {
        console.log('⚠️  No processing detected after 10 seconds');
        console.log('  This might indicate:');
        console.log('  - Processing is taking longer than expected');
        console.log('  - Webhook is queued but not processing');
        console.log('  - There might be an issue with the webhook service');
      }
    } else {
      console.log('❌ Test webhook failed:', testResult.message);
    }

    // 4. Check cruise data updates
    console.log('\n4️⃣ Checking for recent cruise updates...');
    const searchResponse = await fetch(`${BASE_URL}/api/v1/search?query=crystal&limit=5`);
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.cruises && searchData.cruises.length > 0) {
        console.log(`Found ${searchData.cruises.length} Crystal cruises`);
        const recentlyUpdated = searchData.cruises.filter(c => {
          const updatedAt = new Date(c.updated_at || c.updatedAt);
          const hoursSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
          return hoursSinceUpdate < 1;
        });

        if (recentlyUpdated.length > 0) {
          console.log(`✅ ${recentlyUpdated.length} cruise(s) updated in the last hour`);
        } else {
          console.log('⚠️  No cruises updated in the last hour');
        }
      }
    }

    // 5. Provide summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 SUMMARY');
    console.log('='.repeat(50));

    if (diagnostics.diagnostics.ftpConnection === 'success' &&
        diagnostics.diagnostics.redisStatus === 'connected') {
      console.log('✅ System components are healthy');
    } else {
      console.log('❌ System health issues detected');
    }

    if (diagnostics.diagnostics.activeLocks > 0) {
      console.log('⚠️  Active locks may be blocking processing');
    }

    console.log('\n💡 Next Steps:');
    console.log('1. Monitor Render logs for detailed processing info');
    console.log('2. Check Slack for webhook notifications');
    console.log('3. Run with a larger cruise line to test at scale:');
    console.log('   curl -X POST ' + BASE_URL + '/api/webhooks/traveltek/cruiseline-pricing-updated \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"event": "cruiseline_pricing_updated", "lineid": 16}\'');
    console.log('\n   Line 16 (MSC) has ~6000 cruises - good for stress testing');

  } catch (error) {
    console.error('❌ Error checking webhook processing:', error.message);
  }
}

// Run the check
checkWebhookProcessing().catch(console.error);
