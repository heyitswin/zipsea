#!/usr/bin/env ts-node

/**
 * Investigation script for batch sync "0 pending lines" issue
 * 
 * This script analyzes:
 * 1. The exact query used by batch sync to count pending lines
 * 2. How webhooks set needs_price_update = true
 * 3. Any conditions that might prevent the batch sync from finding marked cruises
 * 4. Recent webhook activity and their effects
 */

import { db } from '../src/db/connection';
import { sql } from 'drizzle-orm';

interface WebhookEvent {
  id: number;
  event_type: string;
  line_id: number;
  created_at: string;
  processed: boolean;
  successful_count: number;
  failed_count: number;
  description: string;
}

interface CruiseLineStats {
  cruise_line_id: number;
  line_name: string;
  total_cruises: number;
  active_cruises: number;
  needs_update_count: number;
  active_needs_update: number;
  oldest_request: string;
  newest_request: string;
}

async function investigateBatchSyncIssue() {
  console.log('🔍 Investigating "0 pending lines" batch sync issue...\n');

  try {
    // 1. Test the exact query from batch sync endpoint (admin.routes.ts line 463-467)
    console.log('1️⃣ Testing exact query from trigger-batch-sync endpoint:');
    console.log('   Query: SELECT COUNT(DISTINCT cruise_line_id) as pending_lines FROM cruises WHERE needs_price_update = true\n');
    
    const batchSyncQuery = await db.execute(sql`
      SELECT COUNT(DISTINCT cruise_line_id) as pending_lines
      FROM cruises
      WHERE needs_price_update = true
    `);
    
    const pendingLines = batchSyncQuery[0]?.pending_lines || 0;
    console.log(`   Result: ${pendingLines} pending lines\n`);

    // 2. Test the exact query from price-sync-batch-v5.service.ts (lines 423-431)
    console.log('2️⃣ Testing exact query from V5 service getLinesToSync():');
    console.log('   Query: SELECT DISTINCT cruise_line_id FROM cruises WHERE needs_price_update = true AND sailing_date >= CURRENT_DATE\n');
    
    const v5ServiceQuery = await db.execute(sql`
      SELECT DISTINCT cruise_line_id
      FROM cruises
      WHERE needs_price_update = true
        AND sailing_date >= CURRENT_DATE
      ORDER BY cruise_line_id
    `);
    
    console.log(`   Result: ${v5ServiceQuery.length} lines need sync`);
    if (v5ServiceQuery.length > 0) {
      console.log(`   Line IDs: ${v5ServiceQuery.map(row => row.cruise_line_id).join(', ')}`);
    }
    console.log('');

    // 3. Detailed breakdown by cruise line
    console.log('3️⃣ Detailed breakdown of cruises needing price updates:');
    
    const detailedBreakdown = await db.execute(sql`
      SELECT 
        c.cruise_line_id,
        cl.name as line_name,
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN c.sailing_date >= CURRENT_DATE THEN 1 END) as active_cruises,
        COUNT(CASE WHEN c.needs_price_update = true THEN 1 END) as needs_update_count,
        COUNT(CASE WHEN c.needs_price_update = true AND c.sailing_date >= CURRENT_DATE THEN 1 END) as active_needs_update,
        MIN(c.price_update_requested_at) as oldest_request,
        MAX(c.price_update_requested_at) as newest_request
      FROM cruises c
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.needs_price_update = true
      GROUP BY c.cruise_line_id, cl.name
      ORDER BY needs_update_count DESC
    `) as CruiseLineStats[];

    if (detailedBreakdown.length === 0) {
      console.log('   ❌ No cruises found with needs_price_update = true');
    } else {
      console.log('   Cruise lines with pending updates:');
      detailedBreakdown.forEach(line => {
        console.log(`   📋 Line ${line.cruise_line_id} (${line.line_name || 'Unknown'}): ${line.needs_update_count} total, ${line.active_needs_update || 0} active`);
        console.log(`      Oldest request: ${line.oldest_request || 'N/A'}`);
        console.log(`      Newest request: ${line.newest_request || 'N/A'}`);
      });
    }
    console.log('');

    // 4. Recent webhook activity
    console.log('4️⃣ Recent webhook activity (last 24 hours):');
    
    const recentWebhooks = await db.execute(sql`
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
      WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 10
    `) as WebhookEvent[];

    if (recentWebhooks.length === 0) {
      console.log('   ❌ No recent webhook events found');
    } else {
      recentWebhooks.forEach(webhook => {
        const status = webhook.processed ? '✅ Processed' : '⏳ Pending';
        console.log(`   📡 ${webhook.created_at}: Line ${webhook.line_id} - ${webhook.event_type} (${status})`);
        console.log(`      Success: ${webhook.successful_count}, Failed: ${webhook.failed_count}`);
        if (webhook.description) {
          console.log(`      Description: ${webhook.description}`);
        }
      });
    }
    console.log('');

    // 5. Check for cruises marked for batch sync (from webhook service line 186-193)
    console.log('5️⃣ Checking for large webhook batches (>100 cruises) that were deferred:');
    
    const largeWebhookCheck = await db.execute(sql`
      SELECT 
        we.id,
        we.line_id,
        we.created_at,
        we.description,
        COUNT(c.id) as cruise_count,
        COUNT(CASE WHEN c.needs_price_update = true THEN 1 END) as marked_count,
        COUNT(CASE WHEN c.needs_price_update = true AND c.sailing_date >= CURRENT_DATE THEN 1 END) as active_marked_count
      FROM webhook_events we
      LEFT JOIN cruises c ON c.cruise_line_id = we.line_id
      WHERE we.created_at >= CURRENT_TIMESTAMP - INTERVAL '48 hours'
        AND we.event_type = 'cruiseline_pricing_updated'
      GROUP BY we.id, we.line_id, we.created_at, we.description
      HAVING COUNT(c.id) > 100
      ORDER BY we.created_at DESC
    `);

    if (largeWebhookCheck.length === 0) {
      console.log('   ❌ No large webhook batches found in last 48 hours');
    } else {
      largeWebhookCheck.forEach(batch => {
        console.log(`   📦 Webhook ${batch.id}: Line ${batch.line_id} at ${batch.created_at}`);
        console.log(`      Total cruises: ${batch.cruise_count}, Marked for update: ${batch.marked_count}`);
        console.log(`      Active marked: ${batch.active_marked_count}`);
      });
    }
    console.log('');

    // 6. Check for sync locks that might be blocking
    console.log('6️⃣ Checking for active sync locks:');
    
    try {
      const activeLocks = await db.execute(sql`
        SELECT 
          sl.id,
          sl.cruise_line_id,
          sl.status,
          sl.locked_at,
          cl.name as line_name
        FROM sync_locks sl
        LEFT JOIN cruise_lines cl ON cl.id = sl.cruise_line_id
        WHERE sl.status = 'processing'
        ORDER BY sl.locked_at DESC
      `);

      if (activeLocks.length === 0) {
        console.log('   ✅ No active sync locks found');
      } else {
        activeLocks.forEach(lock => {
          console.log(`   🔒 Lock ${lock.id}: Line ${lock.cruise_line_id} (${lock.line_name}) - ${lock.status} since ${lock.locked_at}`);
        });
      }
    } catch (error) {
      console.log('   ⚠️ sync_locks table may not exist yet');
    }
    console.log('');

    // 7. Test a sample webhook line ID mapping
    console.log('7️⃣ Testing webhook line ID mapping for recent webhooks:');
    
    if (recentWebhooks.length > 0) {
      const { getDatabaseLineId } = require('../src/config/cruise-line-mapping');
      
      for (const webhook of recentWebhooks.slice(0, 3)) {
        const mappedId = getDatabaseLineId(webhook.line_id);
        console.log(`   📋 Webhook Line ${webhook.line_id} maps to Database Line ${mappedId}`);
        
        // Check if cruises exist for this mapped line ID
        const cruisesForLine = await db.execute(sql`
          SELECT 
            COUNT(*) as total_cruises,
            COUNT(CASE WHEN needs_price_update = true THEN 1 END) as marked_count,
            COUNT(CASE WHEN needs_price_update = true AND sailing_date >= CURRENT_DATE THEN 1 END) as active_marked
          FROM cruises
          WHERE cruise_line_id = ${mappedId}
        `);
        
        const stats = cruisesForLine[0];
        console.log(`      Database stats: ${stats.total_cruises} total, ${stats.marked_count} marked, ${stats.active_marked} active marked`);
      }
    }
    console.log('');

    // 8. Summary and recommendations
    console.log('8️⃣ SUMMARY:');
    console.log(`   • Batch sync query finds: ${pendingLines} pending lines`);
    console.log(`   • V5 service query finds: ${v5ServiceQuery.length} lines to sync`);
    console.log(`   • Recent webhooks: ${recentWebhooks.length} in last 24 hours`);
    console.log('');

    if (pendingLines === 0 && v5ServiceQuery.length === 0) {
      console.log('🔍 DIAGNOSIS: No cruises are currently marked with needs_price_update = true');
      console.log('');
      console.log('💡 POSSIBLE CAUSES:');
      console.log('   1. Recent webhooks processed small updates directly (< 100 cruises)');
      console.log('   2. Previous batch sync already cleared all needs_price_update flags');
      console.log('   3. Webhook line ID mapping issues preventing proper marking');
      console.log('   4. Webhooks are being processed but not marking cruises correctly');
      console.log('');
      console.log('🔧 NEXT STEPS:');
      console.log('   1. Monitor next large webhook (>100 cruises) to verify marking works');
      console.log('   2. Check webhook logs for any line ID mapping issues');
      console.log('   3. Verify that webhook service is actually updating needs_price_update = true');
    }

  } catch (error) {
    console.error('❌ Error during investigation:', error);
    process.exit(1);
  }
}

// Run the investigation
investigateBatchSyncIssue()
  .then(() => {
    console.log('✅ Investigation complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Investigation failed:', error);
    process.exit(1);
  });