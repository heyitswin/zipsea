#!/usr/bin/env node

/**
 * MONITOR WEBHOOK EVENTS
 * 
 * This script monitors incoming webhook events and price snapshots
 * to ensure the system is receiving and processing updates correctly.
 */

require('dotenv').config();
const postgres = require('postgres');

const DATABASE_URL = process.env.DATABASE_URL;

const sql = postgres(DATABASE_URL, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function monitorWebhooks() {
  console.log('📊 WEBHOOK MONITORING DASHBOARD');
  console.log('=================================\n');
  
  // 1. Webhook Events Summary
  console.log('📨 WEBHOOK EVENTS (Last 24 hours)');
  const webhookStats = await sql`
    SELECT 
      event_type,
      status,
      COUNT(*) as count
    FROM webhook_events
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY event_type, status
    ORDER BY event_type, status
  `;
  
  if (webhookStats.length > 0) {
    webhookStats.forEach(stat => {
      const icon = stat.status === 'success' ? '✅' : '❌';
      console.log(`   ${icon} ${stat.event_type}: ${stat.count} (${stat.status})`);
    });
  } else {
    console.log('   No webhook events in the last 24 hours');
  }
  console.log('');
  
  // 2. Recent Webhook Events
  console.log('📝 RECENT WEBHOOK EVENTS (Last 10)');
  const recentEvents = await sql`
    SELECT 
      id,
      event_type,
      status,
      error,
      created_at
    FROM webhook_events
    ORDER BY created_at DESC
    LIMIT 10
  `;
  
  recentEvents.forEach(event => {
    const icon = event.status === 'success' ? '✅' : '❌';
    const time = new Date(event.created_at).toLocaleString();
    console.log(`   ${icon} [${time}] ${event.event_type}`);
    if (event.error) {
      console.log(`      Error: ${event.error}`);
    }
  });
  console.log('');
  
  // 3. Price Snapshots
  console.log('💰 PRICE SNAPSHOTS (Last 24 hours)');
  const snapshotStats = await sql`
    SELECT 
      COUNT(*) as total_snapshots,
      COUNT(DISTINCT cruise_id) as unique_cruises,
      MIN(created_at) as earliest,
      MAX(created_at) as latest
    FROM price_snapshots
    WHERE created_at >= NOW() - INTERVAL '24 hours'
  `;
  
  if (snapshotStats[0].total_snapshots > 0) {
    console.log(`   Total Snapshots: ${snapshotStats[0].total_snapshots}`);
    console.log(`   Unique Cruises: ${snapshotStats[0].unique_cruises}`);
    console.log(`   Time Range: ${snapshotStats[0].earliest} to ${snapshotStats[0].latest}`);
  } else {
    console.log('   No price snapshots in the last 24 hours');
  }
  console.log('');
  
  // 4. Recent Price Changes
  console.log('📈 RECENT PRICE CHANGES (Last 5)');
  const recentPriceChanges = await sql`
    SELECT 
      ps.cruise_id,
      c.name as cruise_name,
      ps.inside_price,
      ps.oceanview_price,
      ps.balcony_price,
      ps.suite_price,
      ps.created_at
    FROM price_snapshots ps
    JOIN cruises c ON c.id = ps.cruise_id
    ORDER BY ps.created_at DESC
    LIMIT 5
  `;
  
  recentPriceChanges.forEach(snapshot => {
    const time = new Date(snapshot.created_at).toLocaleString();
    console.log(`   [${time}] ${snapshot.cruise_name}`);
    console.log(`      Inside: $${snapshot.inside_price || 'N/A'} | Ocean: $${snapshot.oceanview_price || 'N/A'} | Balcony: $${snapshot.balcony_price || 'N/A'} | Suite: $${snapshot.suite_price || 'N/A'}`);
  });
  console.log('');
  
  // 5. System Health
  console.log('🏥 SYSTEM HEALTH');
  
  // Check for failed webhooks
  const failedWebhooks = await sql`
    SELECT COUNT(*) as count
    FROM webhook_events
    WHERE status = 'failed'
      AND created_at >= NOW() - INTERVAL '1 hour'
  `;
  
  if (failedWebhooks[0].count > 0) {
    console.log(`   ⚠️  ${failedWebhooks[0].count} failed webhooks in the last hour`);
  } else {
    console.log('   ✅ No failed webhooks in the last hour');
  }
  
  // Check for recent activity
  const lastWebhook = await sql`
    SELECT MAX(created_at) as last_event
    FROM webhook_events
  `;
  
  if (lastWebhook[0].last_event) {
    const hoursSince = (Date.now() - new Date(lastWebhook[0].last_event)) / (1000 * 60 * 60);
    if (hoursSince > 24) {
      console.log(`   ⚠️  No webhooks received in ${Math.round(hoursSince)} hours`);
    } else {
      console.log(`   ✅ Last webhook: ${Math.round(hoursSince * 60)} minutes ago`);
    }
  }
  
  console.log('\n' + '='.repeat(40));
  console.log('📋 WEBHOOK CONFIGURATION');
  console.log('='.repeat(40));
  console.log('\nTo receive webhook updates from Traveltek:');
  console.log('1. Log into Traveltek iSell platform');
  console.log('2. Navigate to Settings > Webhooks');
  console.log('3. Add webhook URL:');
  console.log('   Staging: https://zipsea-staging.onrender.com/api/webhooks/traveltek');
  console.log('   Production: https://zipsea.onrender.com/api/webhooks/traveltek');
  console.log('4. Select event types: price_update, availability_update');
  console.log('5. Save and test the webhook');
  
  await sql.end();
}

// Run monitoring
monitorWebhooks().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});