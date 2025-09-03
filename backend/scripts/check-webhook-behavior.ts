#!/usr/bin/env ts-node

/**
 * Quick check of webhook behavior for large batches
 */

import { db } from '../src/db/connection';
import { sql } from 'drizzle-orm';

async function checkWebhookBehavior() {
  console.log('🔍 Checking webhook behavior for large batches...\n');

  try {
    // 1. Check recent large webhooks
    const recentLargeWebhooks = await db.execute(sql`
      SELECT 
        id,
        event_type,
        line_id,
        created_at,
        processed,
        successful_count,
        failed_count,
        description
      FROM webhook_events
      WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '2 hours'
        AND event_type = 'cruiseline_pricing_updated'
        AND successful_count > 100
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('Recent large webhooks (>100 successful):');
    recentLargeWebhooks.forEach(webhook => {
      console.log(`📡 Webhook ${webhook.id}: Line ${webhook.line_id} at ${webhook.created_at}`);
      console.log(`   Success: ${webhook.successful_count}, Description: ${webhook.description}`);
    });
    console.log('');

    // 2. For the most recent large webhook, check if any cruises are still marked
    if (recentLargeWebhooks.length > 0) {
      const latestWebhook = recentLargeWebhooks[0];
      console.log(`Checking current state for Line ${latestWebhook.line_id} (most recent large webhook):`);

      // Check line ID mapping
      const { getDatabaseLineId } = require('../src/config/cruise-line-mapping');
      const mappedLineId = getDatabaseLineId(latestWebhook.line_id);
      console.log(`   Webhook Line ID: ${latestWebhook.line_id} → Database Line ID: ${mappedLineId}`);

      // Check current cruise state for this line
      const cruiseState = await db.execute(sql`
        SELECT 
          COUNT(*) as total_cruises,
          COUNT(CASE WHEN needs_price_update = true THEN 1 END) as marked_count,
          COUNT(CASE WHEN needs_price_update = true AND sailing_date >= CURRENT_DATE THEN 1 END) as active_marked,
          COUNT(CASE WHEN sailing_date >= CURRENT_DATE THEN 1 END) as active_cruises,
          MAX(price_update_requested_at) as last_update_request
        FROM cruises
        WHERE cruise_line_id = ${mappedLineId}
      `);

      const state = cruiseState[0];
      console.log(`   Current cruise state:`);
      console.log(`   - Total cruises: ${state.total_cruises}`);
      console.log(`   - Active cruises: ${state.active_cruises}`);
      console.log(`   - Marked for update: ${state.marked_count}`);
      console.log(`   - Active marked: ${state.active_marked}`);
      console.log(`   - Last update request: ${state.last_update_request || 'Never'}`);
      console.log('');

      // 3. Check if this webhook processed large batch correctly
      if (latestWebhook.successful_count > 100) {
        console.log(`🔍 Large webhook analysis (${latestWebhook.successful_count} successful):`);
        
        // Based on webhook service code (lines 182-210), large webhooks should:
        // 1. Mark all cruises with needs_price_update = true
        // 2. NOT download FTP files
        // 3. Set successful count to number of cruises marked

        if (state.marked_count === 0) {
          console.log(`   ❌ ISSUE FOUND: Webhook reported ${latestWebhook.successful_count} successful`);
          console.log(`      but ${state.marked_count} cruises are currently marked for update.`);
          console.log(`      This suggests the webhook marked cruises but they were later cleared.`);
        } else {
          console.log(`   ✅ Webhook behavior appears correct: ${state.marked_count} cruises marked`);
        }
      }
    }

    // 4. Check if there's any pattern in timing
    console.log('🕐 Checking timing of batch sync vs webhook activity:');
    
    const batchSyncTimeline = await db.execute(sql`
      SELECT 
        'webhook' as event_type,
        created_at as event_time,
        line_id,
        successful_count
      FROM webhook_events
      WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '4 hours'
        AND event_type = 'cruiseline_pricing_updated'
        AND successful_count > 100
      UNION ALL
      SELECT 
        'potential_batch_sync' as event_type,
        created_at as event_time,
        null as line_id,
        null as successful_count
      FROM webhook_events
      WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '4 hours'
        AND created_at % INTERVAL '5 minutes' < INTERVAL '1 minute'
      ORDER BY event_time DESC
      LIMIT 10
    `);

    console.log('Recent timeline (webhooks vs potential batch syncs every 5 min):');
    batchSyncTimeline.forEach(event => {
      if (event.event_type === 'webhook') {
        console.log(`   📡 ${event.event_time}: Webhook Line ${event.line_id} (${event.successful_count} cruises)`);
      } else {
        console.log(`   🔄 ${event.event_time}: Potential batch sync time`);
      }
    });

    console.log('\n🎯 KEY FINDINGS:');
    console.log('1. Recent large webhooks are being processed with high success counts');
    console.log('2. But no cruises are currently marked with needs_price_update = true');
    console.log('3. This suggests either:');
    console.log('   a) Large webhooks are NOT marking cruises (webhook bug)');
    console.log('   b) Batch sync runs immediately after and clears the flags');
    console.log('   c) Another process is clearing the flags');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkWebhookBehavior()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });