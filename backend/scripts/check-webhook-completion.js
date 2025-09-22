#!/usr/bin/env node

/**
 * Check webhook completion rates and status
 * Verifies if webhooks are properly marking as completed
 */

require('dotenv').config();
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

async function checkWebhookCompletion() {
  console.log('📊 Checking Webhook Completion Status...\n');

  try {
    // Get overall webhook stats
    const statsQuery = sql`
      SELECT
        status,
        COUNT(*) as count
      FROM webhook_events
      WHERE received_at > NOW() - INTERVAL '24 hours'
      GROUP BY status
      ORDER BY count DESC
    `;

    const stats = await db.execute(statsQuery);

    console.log('Last 24 Hours Webhook Status Distribution:');
    console.log('='.repeat(50));

    let total = 0;
    const statusCounts = {};

    for (const row of stats) {
      const count = parseInt(row.count);
      total += count;
      statusCounts[row.status] = count;
      console.log(`  ${row.status}: ${count} webhooks`);
    }

    console.log(`  TOTAL: ${total} webhooks`);

    // Calculate completion rate
    const completed = statusCounts['completed'] || 0;
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(2) : 0;

    console.log(`\n📈 Completion Rate: ${completionRate}%`);

    if (completionRate < 50) {
      console.log('⚠️  WARNING: Low completion rate detected!');
    } else if (completionRate > 90) {
      console.log('✅ Excellent completion rate!');
    } else {
      console.log('🔶 Moderate completion rate');
    }

    // Check for stuck webhooks
    const stuckQuery = sql`
      SELECT
        line_id,
        COUNT(*) as stuck_count,
        MIN(received_at) as oldest,
        MAX(received_at) as newest
      FROM webhook_events
      WHERE status = 'processing'
        AND received_at < NOW() - INTERVAL '1 hour'
      GROUP BY line_id
      ORDER BY stuck_count DESC
      LIMIT 10
    `;

    const stuck = await db.execute(stuckQuery);

    if (stuck.length > 0) {
      console.log('\n⚠️  Stuck Webhooks (processing > 1 hour):');
      console.log('='.repeat(50));

      for (const row of stuck) {
        console.log(`  Line ${row.line_id}: ${row.stuck_count} stuck`);
        console.log(`    Oldest: ${row.oldest}`);
        console.log(`    Newest: ${row.newest}`);
      }
    } else {
      console.log('\n✅ No stuck webhooks found (all processing < 1 hour)');
    }

    // Check recent completions by cruise line
    const completionByLineQuery = sql`
      SELECT
        cl.name as cruise_line,
        we.line_id,
        COUNT(*) as total,
        SUM(CASE WHEN we.status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN we.status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN we.status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN we.status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM webhook_events we
      LEFT JOIN cruise_lines cl ON cl.id = we.line_id
      WHERE we.received_at > NOW() - INTERVAL '24 hours'
      GROUP BY we.line_id, cl.name
      HAVING COUNT(*) > 0
      ORDER BY total DESC
      LIMIT 10
    `;

    const byLine = await db.execute(completionByLineQuery);

    console.log('\n📊 Top Cruise Lines by Webhook Activity (24h):');
    console.log('='.repeat(70));
    console.log('Cruise Line                     | Total | Complete | Failed | Processing | Pending');
    console.log('-'.repeat(70));

    for (const row of byLine) {
      const name = (row.cruise_line || `Line ${row.line_id}`).padEnd(30);
      const completionPct = row.total > 0 ? ((row.completed / row.total) * 100).toFixed(0) : 0;
      console.log(`${name} | ${String(row.total).padStart(5)} | ${String(row.completed).padStart(8)} | ${String(row.failed).padStart(6)} | ${String(row.processing).padStart(10)} | ${String(row.pending).padStart(7)} (${completionPct}%)`);
    }

    // Check if Riviera (329) is processing correctly
    const rivieraQuery = sql`
      SELECT
        status,
        COUNT(*) as count
      FROM webhook_events
      WHERE line_id = 329
        AND received_at > NOW() - INTERVAL '7 days'
      GROUP BY status
    `;

    const riviera = await db.execute(rivieraQuery);

    if (riviera.length > 0) {
      console.log('\n🚢 Riviera Travel (Line 329) Status (7 days):');
      console.log('='.repeat(50));

      for (const row of riviera) {
        console.log(`  ${row.status}: ${row.count}`);
      }
    }

    // Check for any error patterns
    const errorsQuery = sql`
      SELECT
        error_message,
        COUNT(*) as count
      FROM webhook_events
      WHERE status = 'failed'
        AND received_at > NOW() - INTERVAL '24 hours'
        AND error_message IS NOT NULL
      GROUP BY error_message
      ORDER BY count DESC
      LIMIT 5
    `;

    const errors = await db.execute(errorsQuery);

    if (errors.length > 0) {
      console.log('\n❌ Common Error Messages (24h):');
      console.log('='.repeat(50));

      for (const row of errors) {
        const msg = row.error_message.substring(0, 100);
        console.log(`  ${row.count}x: ${msg}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('WEBHOOK HEALTH SUMMARY');
    console.log('='.repeat(70));

    if (completionRate > 80 && stuck.length === 0) {
      console.log('✅ Webhook processing system appears healthy');
    } else if (completionRate > 50) {
      console.log('🔶 Webhook system operational but needs attention');
    } else {
      console.log('❌ Webhook system has significant issues');
    }

    console.log(`\nKey Metrics:`);
    console.log(`  - Completion Rate: ${completionRate}%`);
    console.log(`  - Stuck Webhooks: ${stuck.length > 0 ? stuck.reduce((sum, s) => sum + parseInt(s.stuck_count), 0) : 0}`);
    console.log(`  - Failed Webhooks: ${statusCounts['failed'] || 0}`);
    console.log(`  - Processing: ${statusCounts['processing'] || 0}`);
    console.log(`  - Pending: ${statusCounts['pending'] || 0}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkWebhookCompletion();
