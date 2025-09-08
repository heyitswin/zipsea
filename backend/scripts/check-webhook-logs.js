const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

async function checkWebhookLogs() {
  console.log('📋 Checking Recent Webhook Processing');
  console.log('=' .repeat(60));

  try {
    // Check recent cruise updates
    const recentUpdates = await db.execute(sql`
      SELECT
        cl.name as cruise_line,
        COUNT(c.id) as updated_count,
        MAX(c.updated_at) as last_update
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.updated_at > NOW() - INTERVAL '10 minutes'
      GROUP BY cl.name
      ORDER BY last_update DESC
      LIMIT 10
    `);

    if (recentUpdates.length > 0) {
      console.log('✅ WEBHOOKS ARE WORKING! Recent updates found:');
      console.log('-'.repeat(40));
      recentUpdates.forEach(row => {
        console.log(`${row.cruise_line}: ${row.updated_count} cruises updated at ${row.last_update}`);
      });
    } else {
      console.log('⚠️  No cruise updates in the last 10 minutes');
      console.log('This means either:');
      console.log('1. FTP connection is failing (from production too)');
      console.log('2. Webhook processing is stuck');
      console.log('3. No webhooks have been triggered');
    }

    // Check if there are any cruise updates today
    const todayUpdates = await db.execute(sql`
      SELECT
        DATE_TRUNC('hour', updated_at) as hour,
        COUNT(*) as count
      FROM cruises
      WHERE updated_at > CURRENT_DATE
      GROUP BY hour
      ORDER BY hour DESC
      LIMIT 24
    `);

    if (todayUpdates.length > 0) {
      console.log('\n📊 Updates by hour today:');
      console.log('-'.repeat(40));
      todayUpdates.forEach(row => {
        console.log(`${row.hour}: ${row.count} updates`);
      });
    }

  } catch (error) {
    console.error('Error checking logs:', error);
  }

  process.exit(0);
}

checkWebhookLogs();
