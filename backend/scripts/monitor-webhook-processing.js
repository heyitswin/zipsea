#!/usr/bin/env node

const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');
const axios = require('axios');

const API_URL = process.env.ENV === 'production'
  ? 'https://zipsea-production.onrender.com'
  : 'https://zipsea-backend.onrender.com';

async function monitorWebhook() {
  console.log('🔍 Webhook Processing Monitor');
  console.log('============================================================\n');

  // 1. Check FTP status
  try {
    const ftpResponse = await axios.get(`${API_URL}/api/webhooks/traveltek/ftp-status`);
    console.log('📡 FTP Status:');
    console.log(`   Host: ${ftpResponse.data.ftpConfig.host}`);
    console.log(`   User: ${ftpResponse.data.ftpConfig.user}`);
    console.log(`   Connection: ${ftpResponse.data.connectionStatus}`);
    console.log('');
  } catch (error) {
    console.log('❌ Could not check FTP status\n');
  }

  // 2. Trigger a small test webhook
  const testLineId = 14; // Holland America - small line
  console.log(`📤 Triggering test webhook for line ${testLineId}...`);

  try {
    const webhookResponse = await axios.post(
      `${API_URL}/api/webhooks/traveltek/test`,
      { lineId: testLineId },
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log(`✅ Webhook triggered: ${webhookResponse.data.webhookId}`);
    console.log('');
  } catch (error) {
    console.log(`❌ Failed to trigger webhook: ${error.message}\n`);
    return;
  }

  // 3. Monitor for updates
  console.log('⏳ Monitoring for updates (30 seconds)...\n');

  let lastCount = 0;
  for (let i = 0; i < 6; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
      const result = await db.execute(sql`
        SELECT
          COUNT(*) as total_updated,
          COUNT(DISTINCT cruise_line_id) as lines_updated
        FROM cruises
        WHERE updated_at > NOW() - INTERVAL '2 minutes'
      `);

      const row = result[0];
      const currentCount = parseInt(row.total_updated) || 0;

      if (currentCount > lastCount) {
        console.log(`   ✅ Updates detected: ${currentCount} cruises from ${row.lines_updated} lines`);
        lastCount = currentCount;
      } else if (i === 5) {
        console.log(`   ⚠️ No updates detected after 30 seconds`);
      }
    } catch (error) {
      console.error(`   ❌ Database error: ${error.message}`);
    }
  }

  // 4. Check for webhook processing flags
  console.log('\n📊 Checking processing flags...');
  try {
    const flagResult = await db.execute(sql`
      SELECT
        cruise_line_id,
        COUNT(*) as flagged_count
      FROM cruises
      WHERE needs_price_update = true
        AND cruise_line_id = ${testLineId}
      GROUP BY cruise_line_id
    `);

    if (flagResult.length > 0) {
      console.log(`   ⚠️ ${flagResult[0].flagged_count} cruises flagged for update but not processed`);
    } else {
      console.log('   ✅ No cruises flagged for update');
    }
  } catch (error) {
    console.error(`   ❌ Could not check flags: ${error.message}`);
  }

  console.log('\n============================================================');
  console.log('💡 If no updates are detected:');
  console.log('   1. Check Slack for error notifications');
  console.log('   2. Check Render logs for detailed errors');
  console.log('   3. Verify FTP paths match current date structure');

  process.exit(0);
}

monitorWebhook();
