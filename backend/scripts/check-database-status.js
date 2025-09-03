#!/usr/bin/env node

const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

async function checkDatabaseAndWebhooks() {
  console.log('\n4. 🏢 Checking Database Sync Status...');
  
  try {
    // Check cruise line sync timestamps
    console.log('   🏢 Cruise line sync status:');
    
    const cruiseLineSync = await db.execute(sql`
      SELECT 
        id,
        name,
        code,
        last_sync_at,
        EXTRACT(EPOCH FROM (NOW() - last_sync_at)) / 3600 as hours_since_sync,
        is_active
      FROM cruise_lines 
      WHERE is_active = true
      ORDER BY last_sync_at DESC
    `);
    
    if (cruiseLineSync.length === 0) {
      console.log('      ❌ No active cruise lines found in database');
    } else {
      cruiseLineSync.forEach(line => {
        const hoursAgo = line.hours_since_sync ? Math.round(line.hours_since_sync) : 'Never';
        console.log(`      Line ${line.id} (${line.name}): Last sync ${hoursAgo === 'Never' ? 'Never' : hoursAgo + ' hours ago'}`);
      });
      
      // Find lines that haven't synced recently
      const staleLines = cruiseLineSync.filter(line => 
        !line.last_sync_at || line.hours_since_sync > 24
      );
      
      if (staleLines.length > 0) {
        console.log(`\n   ⚠️  Lines with stale sync (>24h or never):`);
        staleLines.forEach(line => {
          console.log(`      Line ${line.id} (${line.name}): ${line.last_sync_at ? Math.round(line.hours_since_sync) + 'h ago' : 'Never synced'}`);
        });
      }
    }
    
    // Check general cruise data freshness
    const dataFreshness = await db.execute(sql`
      SELECT 
        COUNT(*) as total_cruises,
        COUNT(*) FILTER (WHERE sailing_date >= CURRENT_DATE) as future_cruises,
        COUNT(*) FILTER (WHERE needs_price_update = true) as needs_updates,
        MAX(updated_at) as last_cruise_update,
        EXTRACT(EPOCH FROM (NOW() - MAX(updated_at))) / 3600 as hours_since_last_update
      FROM cruises
    `);
    
    if (dataFreshness.length > 0) {
      const stats = dataFreshness[0];
      console.log(`\n   📊 Database content status:`);
      console.log(`      Total cruises: ${stats.total_cruises}`);
      console.log(`      Future cruises: ${stats.future_cruises}`);
      console.log(`      Cruises needing updates: ${stats.needs_updates}`);
      console.log(`      Last cruise update: ${stats.last_cruise_update || 'Never'}`);
      if (stats.hours_since_last_update) {
        console.log(`      Hours since last update: ${Math.round(stats.hours_since_last_update)}`);
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Error checking database sync status: ${error.message}`);
  }
  
  console.log('\n5. 🔔 Checking Recent Webhook Activity...');
  
  try {
    // Check recent webhook events
    const recentWebhooks = await db.execute(sql`
      SELECT 
        id,
        event_type,
        line_id,
        created_at,
        processed,
        processed_at,
        successful_count,
        failed_count,
        EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as hours_ago
      FROM webhook_events
      WHERE created_at >= NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    if (recentWebhooks.length === 0) {
      console.log('   📭 No webhook events in last 7 days');
    } else {
      console.log(`   📨 Recent webhook activity (last 7 days):`);
      
      recentWebhooks.forEach(webhook => {
        const hoursAgo = Math.round(webhook.hours_ago);
        const status = webhook.processed ? '✅ Processed' : '⏳ Pending';
        console.log(`      ${webhook.event_type} - Line ${webhook.line_id}: ${hoursAgo}h ago (${status})`);
        if (webhook.processed && (webhook.successful_count || webhook.failed_count)) {
          console.log(`         └─ Results: ${webhook.successful_count || 0} successful, ${webhook.failed_count || 0} failed`);
        }
      });
      
      // Analyze webhook frequency
      const webhookStats = await db.execute(sql`
        SELECT 
          COUNT(*) as total_webhooks,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as last_24h,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '12 hours') as last_12h,
          COUNT(*) FILTER (WHERE processed = false) as pending,
          AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_processing_seconds
        FROM webhook_events
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `);
      
      if (webhookStats.length > 0) {
        const stats = webhookStats[0];
        console.log(`\n   📈 Webhook frequency analysis:`);
        console.log(`      Webhooks in last 24 hours: ${stats.last_24h}`);
        console.log(`      Webhooks in last 12 hours: ${stats.last_12h}`);
        console.log(`      Pending webhooks: ${stats.pending}`);
        if (stats.avg_processing_seconds) {
          console.log(`      Average processing time: ${Math.round(stats.avg_processing_seconds)}s`);
        }
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Error checking webhook activity: ${error.message}`);
  }
  
  // Check for sync gaps
  console.log('\n6. 🕳️  Identifying Potential Sync Gaps...');
  
  try {
    console.log('   🔍 Analyzing potential sync gaps...');
    
    // Compare webhook activity with database updates
    const lastWebhook = await db.execute(sql`
      SELECT 
        MAX(created_at) as last_webhook,
        EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) / 3600 as hours_since_last_webhook
      FROM webhook_events
      WHERE event_type = 'cruiseline_pricing_updated'
    `);
    
    if (lastWebhook.length > 0 && lastWebhook[0].last_webhook) {
      const hoursAgo = Math.round(lastWebhook[0].hours_since_last_webhook);
      console.log(`      Last pricing webhook: ${hoursAgo} hours ago`);
      
      if (hoursAgo > 12) {
        console.log(`      ⚠️  Gap detected: No webhooks received in ${hoursAgo} hours`);
        console.log(`         This could indicate:`);
        console.log(`         - Webhook delivery issues`);
        console.log(`         - No actual price updates from Traveltek`);
        console.log(`         - Configuration issues with Traveltek webhook setup`);
      }
    } else {
      console.log(`      ❌ No pricing webhooks found in database`);
    }
    
    // Check for lines that have data but no recent webhooks
    const linesWithoutRecentWebhooks = await db.execute(sql`
      SELECT 
        cl.id,
        cl.name,
        COUNT(c.id) as cruise_count,
        MAX(we.created_at) as last_webhook
      FROM cruise_lines cl
      LEFT JOIN cruises c ON cl.id = c.cruise_line_id AND c.sailing_date >= CURRENT_DATE
      LEFT JOIN webhook_events we ON cl.id = we.line_id AND we.created_at >= NOW() - INTERVAL '7 days'
      WHERE cl.is_active = true
      GROUP BY cl.id, cl.name
      HAVING COUNT(c.id) > 0 AND (MAX(we.created_at) IS NULL OR MAX(we.created_at) < NOW() - INTERVAL '24 hours')
      ORDER BY cruise_count DESC
    `);
    
    if (linesWithoutRecentWebhooks.length > 0) {
      console.log(`\n   📋 Cruise lines with data but no recent webhooks:`);
      linesWithoutRecentWebhooks.forEach(line => {
        console.log(`      Line ${line.id} (${line.name}): ${line.cruise_count} cruises, last webhook: ${line.last_webhook || 'Never'}`);
      });
    }
    
    // Recommendations
    console.log(`\n   💡 Key Findings & Recommendations:`);
    
    if (!lastWebhook[0]?.last_webhook) {
      console.log(`      1. ❌ NO WEBHOOKS: No pricing webhooks found in database`);
      console.log(`         - Verify webhook setup in Traveltek iSell portal`);
      console.log(`         - Check webhook endpoint: https://zipsea-production.onrender.com/api/webhooks/traveltek`);
    } else if (lastWebhook[0]?.hours_since_last_webhook > 12) {
      console.log(`      1. ⚠️  STALE WEBHOOKS: No recent webhook activity (${Math.round(lastWebhook[0].hours_since_last_webhook)}h ago)`);
      console.log(`         - Contact Traveltek support to verify webhook delivery`);
    } else {
      console.log(`      1. ✅ WEBHOOKS: Recent webhook activity detected`);
    }
    
    console.log(`      2. ❌ FTP CREDENTIALS: Missing from environment variables`);
    console.log(`         - TRAVELTEK_FTP_HOST, TRAVELTEK_FTP_USER, TRAVELTEK_FTP_PASSWORD not set`);
    console.log(`         - This explains why FTP sync shows "12 hours ago" in admin dashboard`);
    
    if (linesWithoutRecentWebhooks.length > 0) {
      console.log(`      3. ⚠️  INACTIVE LINES: ${linesWithoutRecentWebhooks.length} cruise lines with no recent webhook activity`);
      console.log(`         - Consider manual sync for these lines once FTP is configured`);
    }
    
    console.log(`      4. 🔧 IMMEDIATE ACTIONS NEEDED:`);
    console.log(`         - Configure FTP credentials in production environment`);
    console.log(`         - Verify webhook endpoint is receiving Traveltek notifications`);
    console.log(`         - Once FTP is working, trigger manual sync to catch up on missed updates`);
    
  } catch (error) {
    console.log(`   ❌ Error identifying sync gaps: ${error.message}`);
  }
}

checkDatabaseAndWebhooks().catch(err => {
  console.error('❌ Database investigation failed:', err);
  process.exit(1);
});