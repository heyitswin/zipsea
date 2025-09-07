#!/usr/bin/env node
const https = require('https');

const API_URL = process.argv[2] === 'staging'
  ? 'https://zipsea-backend.onrender.com'
  : 'https://zipsea-production.onrender.com';

const ENV = process.argv[2] === 'staging' ? 'Staging' : 'Production';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    https.get(`${API_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function monitor() {
  console.log(`\n📊 Webhook Monitoring Dashboard - ${ENV}`);
  console.log('='.repeat(60));

  try {
    // Check webhook status
    console.log('\n1️⃣ Webhook Status:');
    const status = await makeRequest('/api/webhooks/traveltek/status');
    if (status.summary) {
      console.log(`   Total webhooks: ${status.summary.totalWebhooks}`);
      console.log(`   Processed: ${status.summary.processedWebhooks}`);
      console.log(`   Pending: ${status.summary.pendingWebhooks}`);
      console.log(`   Success rate: ${status.summary.successfulCruises} cruises updated`);
    }

    // Check recent webhooks
    if (status.recentWebhooks && status.recentWebhooks.length > 0) {
      console.log('\n2️⃣ Recent Webhooks (last 5):');
      status.recentWebhooks.slice(0, 5).forEach(wh => {
        const time = new Date(wh.createdAt).toLocaleTimeString();
        const status = wh.processed ? '✅' : '⏳';
        console.log(`   ${status} Line ${wh.lineId} - ${time} - ${wh.successful || 0} cruises`);
      });
    }

    // Check health
    console.log('\n3️⃣ Health Check:');
    const health = await makeRequest('/api/webhooks/traveltek/health');
    if (health.status === 'healthy') {
      console.log('   ✅ Webhook endpoint is healthy');
    } else {
      console.log('   ⚠️ Webhook endpoint issues detected');
    }

    // Check pending syncs
    console.log('\n4️⃣ Pending Syncs:');
    const pending = await makeRequest('/api/admin/pending-syncs');
    if (pending.summary) {
      console.log(`   Total pending: ${pending.summary.total_pending}`);
      console.log(`   Unique lines: ${pending.summary.unique_lines}`);
      if (pending.byLine && pending.byLine.length > 0) {
        console.log('   Top lines with pending updates:');
        pending.byLine.slice(0, 3).forEach(line => {
          console.log(`     - Line ${line.cruise_line_id}: ${line.count} cruises`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error fetching status:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 Tips:');
  console.log('   - Run a test webhook: node scripts/test-webhook-traveltek.js 21 production');
  console.log('   - Check Render logs: https://dashboard.render.com');
  console.log('   - View Slack: Check #zipsea channel for notifications');
}

// Run monitoring
monitor().then(() => {
  console.log('\n🔄 Monitoring complete. Run again to refresh.\n');
});
