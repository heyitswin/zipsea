require('dotenv').config();
const { Client } = require('pg');

async function cleanupStuckWebhooks() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('📊 Checking for stuck webhook events...\n');

    // First, get count of stuck events
    const countResult = await client.query(`
      SELECT
        status,
        COUNT(*) as count,
        MIN(received_at) as oldest,
        MAX(received_at) as newest
      FROM webhook_events
      WHERE status IN ('processing', 'pending')
      GROUP BY status
      ORDER BY status
    `);

    console.log('Current status distribution:');
    countResult.rows.forEach(row => {
      console.log(`  ${row.status}: ${row.count} events`);
      console.log(`    Oldest: ${row.oldest}`);
      console.log(`    Newest: ${row.newest}\n`);
    });

    // Find events stuck in 'processing' for more than 1 hour
    const stuckResult = await client.query(`
      SELECT COUNT(*) as count
      FROM webhook_events
      WHERE status = 'processing'
      AND received_at < NOW() - INTERVAL '1 hour'
    `);

    const stuckCount = stuckResult.rows[0].count;

    if (stuckCount > 0) {
      console.log(`\n⚠️  Found ${stuckCount} events stuck in 'processing' for over 1 hour`);

      // Ask for confirmation
      console.log('\nOptions:');
      console.log('1. Reset old stuck events to "pending" (will be reprocessed)');
      console.log('2. Mark old stuck events as "failed" (won\'t be reprocessed)');
      console.log('3. Do nothing (exit)');
      console.log('\nRun with argument: reset, fail, or nothing');

      const action = process.argv[2];

      if (action === 'reset') {
        console.log('\n🔄 Resetting stuck events to pending...');
        const updateResult = await client.query(`
          UPDATE webhook_events
          SET status = 'pending',
              error_message = 'Reset from stuck processing state',
              retry_count = COALESCE(retry_count, 0) + 1
          WHERE status = 'processing'
          AND received_at < NOW() - INTERVAL '1 hour'
          RETURNING id
        `);

        console.log(`✅ Reset ${updateResult.rows.length} events to pending`);

      } else if (action === 'fail') {
        console.log('\n❌ Marking stuck events as failed...');
        const updateResult = await client.query(`
          UPDATE webhook_events
          SET status = 'failed',
              processed_at = NOW(),
              error_message = 'Stuck in processing for over 1 hour'
          WHERE status = 'processing'
          AND received_at < NOW() - INTERVAL '1 hour'
          RETURNING id
        `);

        console.log(`✅ Marked ${updateResult.rows.length} events as failed`);

      } else {
        console.log('\nNo action taken. Run with "reset" or "fail" to update stuck events.');
        console.log('Example: node scripts/cleanup-stuck-webhooks.js reset');
      }
    } else {
      console.log('\n✅ No stuck events found (all processing events are less than 1 hour old)');
    }

    // Show updated counts
    if (action === 'reset' || action === 'fail') {
      console.log('\n📊 Updated status distribution:');
      const newCount = await client.query(`
        SELECT status, COUNT(*) as count
        FROM webhook_events
        GROUP BY status
        ORDER BY count DESC
      `);

      newCount.rows.forEach(row => {
        const icon = row.status === 'completed' ? '✅' :
                     row.status === 'failed' ? '❌' :
                     row.status === 'processing' ? '🔄' : '⏳';
        console.log(`  ${icon} ${row.status}: ${row.count}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

cleanupStuckWebhooks();
