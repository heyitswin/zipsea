#!/usr/bin/env node

require('dotenv').config();
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

(async () => {
  try {
    // Check webhook_events table for recent Royal Caribbean syncs
    const recentSyncs = await db.execute(sql`
      SELECT
        created_at,
        line_id,
        webhook_type,
        file_count,
        processing_result
      FROM webhook_events
      WHERE line_id = 22
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log('Recent Royal Caribbean (line 22) syncs:');
    console.log('=========================================');

    for (const sync of recentSyncs.rows) {
      console.log(`\nDate: ${sync.created_at}`);
      console.log(`Type: ${sync.webhook_type}`);
      console.log(`Files: ${sync.file_count}`);
      if (sync.processing_result) {
        const result = JSON.parse(sync.processing_result);
        console.log(`Status: ${result.status || 'unknown'}`);
        console.log(`Processed: ${result.filesProcessed || 0}`);
        console.log(`Updated: ${result.cruisesUpdated || 0}`);
        if (result.errors && result.errors.length > 0) {
          console.log(`Errors: ${result.errors.length}`);
          // Check if any errors mention cruise 2143102
          const cruise2143102Errors = result.errors.filter(
            e => e.includes('2143102') || e.includes('4439')
          );
          if (cruise2143102Errors.length > 0) {
            console.log('  ⚠️ Errors related to cruise 2143102 or ship 4439:');
            cruise2143102Errors.forEach(e => console.log('    - ' + e));
          }
        }
      }
    }

    // Check if cruise 2143102 file was included in recent batches
    console.log('\n\nChecking if cruise 2143102 was in recent batches...');
    console.log('====================================================');

    const recentWithDetails = await db.execute(sql`
      SELECT
        created_at,
        processing_result::text
      FROM webhook_events
      WHERE line_id = 22
        AND created_at > NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
    `);

    let found2143102 = false;
    for (const sync of recentWithDetails.rows) {
      if (sync.processing_result && sync.processing_result.includes('2143102')) {
        console.log(`\n✅ Found reference to cruise 2143102 in sync at ${sync.created_at}`);
        found2143102 = true;

        // Try to extract context around the cruise ID
        const resultStr = sync.processing_result;
        const index = resultStr.indexOf('2143102');
        const start = Math.max(0, index - 100);
        const end = Math.min(resultStr.length, index + 200);
        const context = resultStr.substring(start, end);
        console.log('Context:', context);
      }
    }

    if (!found2143102) {
      console.log('\n❌ Cruise 2143102 was NOT mentioned in any sync logs from the past 7 days');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
})();
