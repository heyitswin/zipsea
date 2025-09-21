require('dotenv').config();
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { sql } = require('drizzle-orm');

const connectionString = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL or DATABASE_URL_PRODUCTION environment variable is required');
  process.exit(1);
}

const client = postgres(connectionString, {
  ssl: 'require',
});
const db = drizzle(client);

async function testWebhookStatusFix() {
  console.log('\n=== Testing Webhook Status Fix ===\n');

  try {
    // Check recent webhook events
    const recentEvents = await db.execute(sql`
      SELECT
        id,
        line_id,
        status,
        received_at,
        processed_at,
        EXTRACT(EPOCH FROM (NOW() - received_at))::INT as seconds_ago,
        CASE
          WHEN processed_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (processed_at - received_at))::INT
          ELSE NULL
        END as processing_time_seconds
      FROM webhook_events
      ORDER BY received_at DESC
      LIMIT 20
    `);

    console.log('📊 Recent Webhook Events:');
    console.log('─'.repeat(80));

    const statusCounts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    if (!recentEvents || !recentEvents.rows) {
      console.log('No webhook events found');
      await client.end();
      return;
    }

    for (const event of recentEvents.rows) {
      const status = event.status;
      statusCounts[status]++;

      const statusEmoji = {
        pending: '⏳',
        processing: '🔄',
        completed: '✅',
        failed: '❌',
      }[status];

      const timeAgo =
        event.seconds_ago < 60
          ? `${event.seconds_ago}s ago`
          : event.seconds_ago < 3600
            ? `${Math.floor(event.seconds_ago / 60)}m ago`
            : `${Math.floor(event.seconds_ago / 3600)}h ago`;

      const processingTime = event.processing_time_seconds
        ? ` (took ${event.processing_time_seconds}s)`
        : '';

      console.log(
        `${statusEmoji} Event ${event.id}: ${status.padEnd(10)} | Created ${timeAgo}${processingTime}`
      );
    }

    console.log('─'.repeat(80));
    console.log('\n📈 Status Distribution:');
    console.log(`  ✅ Completed: ${statusCounts.completed}`);
    console.log(`  🔄 Processing: ${statusCounts.processing}`);
    console.log(`  ⏳ Pending: ${statusCounts.pending}`);
    console.log(`  ❌ Failed: ${statusCounts.failed}`);

    // Check for stuck processing events (older than 5 minutes)
    const stuckEvents = await db.execute(sql`
      SELECT
        id,
        line_id,
        received_at,
        EXTRACT(EPOCH FROM (NOW() - received_at))::INT / 60 as minutes_ago
      FROM webhook_events
      WHERE status = 'processing'
      AND received_at < NOW() - INTERVAL '5 minutes'
      ORDER BY received_at DESC
      LIMIT 10
    `);

    if (stuckEvents.rows.length > 0) {
      console.log('\n⚠️  Potentially Stuck Events (processing > 5 minutes):');
      for (const event of stuckEvents.rows) {
        console.log(`  - Event ${event.id}: stuck for ${Math.floor(event.minutes_ago)} minutes`);
      }
    } else {
      console.log('\n✅ No stuck events detected (all processing < 5 minutes)');
    }

    // Check job completion rate in last hour
    const completionStats = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) as total
      FROM webhook_events
      WHERE received_at > NOW() - INTERVAL '1 hour'
    `);

    const stats = completionStats.rows[0];
    if (stats.total > 0) {
      const completionRate = ((stats.completed / stats.total) * 100).toFixed(1);
      console.log('\n📊 Last Hour Statistics:');
      console.log(`  Total events: ${stats.total}`);
      console.log(`  Completion rate: ${completionRate}%`);
      console.log(
        `  Breakdown: ${stats.completed} completed, ${stats.processing} processing, ${stats.pending} pending, ${stats.failed} failed`
      );
    }

    // Check if the fix is working (recent events should be completing)
    const recentCompletions = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM webhook_events
      WHERE status = 'completed'
      AND processed_at > NOW() - INTERVAL '10 minutes'
    `);

    const recentCount = recentCompletions.rows[0].count;
    if (recentCount > 0) {
      console.log(`\n✅ FIX IS WORKING: ${recentCount} events completed in the last 10 minutes!`);
    } else {
      console.log(
        '\n⚠️  No completions in the last 10 minutes - the fix might not be deployed yet'
      );
    }
  } catch (error) {
    console.error('❌ Error testing webhook status:', error.message);
  } finally {
    await client.end();
  }
}

testWebhookStatusFix();
