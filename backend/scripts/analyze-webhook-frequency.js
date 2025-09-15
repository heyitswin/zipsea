const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

async function analyzeWebhookFrequency() {
  console.log('=== Webhook Processing Analysis ===\n');

  try {
    // 1. Check webhook frequency by line ID in the last 24 hours
    const webhookFrequency = await db.execute(sql`
      SELECT
        line_id,
        COUNT(*) as webhook_count,
        COUNT(DISTINCT DATE_TRUNC('hour', received_at)) as unique_hours,
        MIN(received_at) as first_webhook,
        MAX(received_at) as last_webhook,
        ROUND(EXTRACT(EPOCH FROM (MAX(received_at) - MIN(received_at))) / 3600, 2) as span_hours
      FROM webhook_events
      WHERE received_at > NOW() - INTERVAL '24 hours'
      GROUP BY line_id
      ORDER BY webhook_count DESC
      LIMIT 20
    `);

    console.log('📊 Webhook Frequency (Last 24 Hours):');
    console.log('=====================================');
    if (webhookFrequency && webhookFrequency.rows) {
      webhookFrequency.rows.forEach(row => {
        const avgPerHour =
          row.span_hours > 0 ? (row.webhook_count / row.span_hours).toFixed(2) : 'N/A';
        console.log(`Line ${row.line_id}: ${row.webhook_count} webhooks, ${avgPerHour} per hour`);
      });
    } else {
      console.log('No webhook data found');
    }

    // 2. Check for rapid-fire webhooks (multiple webhooks within 1 minute)
    const rapidFireWebhooks = await db.execute(sql`
      WITH webhook_intervals AS (
        SELECT
          line_id,
          received_at,
          LAG(received_at) OVER (PARTITION BY line_id ORDER BY received_at) as prev_received_at,
          EXTRACT(EPOCH FROM (received_at - LAG(received_at) OVER (PARTITION BY line_id ORDER BY received_at))) as seconds_between
        FROM webhook_events
        WHERE received_at > NOW() - INTERVAL '24 hours'
      )
      SELECT
        line_id,
        COUNT(*) as rapid_fire_count
      FROM webhook_intervals
      WHERE seconds_between < 60  -- Within 1 minute
      GROUP BY line_id
      HAVING COUNT(*) > 0
      ORDER BY rapid_fire_count DESC
      LIMIT 10
    `);

    console.log('\n⚡ Rapid-Fire Webhooks (Within 1 Minute):');
    console.log('=========================================');
    if (rapidFireWebhooks && rapidFireWebhooks.rows) {
      rapidFireWebhooks.rows.forEach(row => {
        console.log(`Line ${row.line_id}: ${row.rapid_fire_count} rapid webhooks`);
      });
    } else {
      console.log('No rapid-fire webhooks detected');
    }

    // 3. Count unique cruises processed today vs total files
    const cruiseProcessingStats = await db.execute(sql`
      SELECT
        COUNT(DISTINCT c.id) as unique_cruises,
        COUNT(DISTINCT c.cruise_id) as unique_cruise_ids,
        COUNT(*) as total_updates,
        COUNT(DISTINCT DATE_TRUNC('hour', c.updated_at)) as update_hours
      FROM cruises c
      WHERE c.updated_at > NOW() - INTERVAL '24 hours'
    `);

    console.log('\n📈 Cruise Processing Stats (Last 24 Hours):');
    console.log('===========================================');
    if (cruiseProcessingStats && cruiseProcessingStats.rows && cruiseProcessingStats.rows[0]) {
      const stats = cruiseProcessingStats.rows[0];
      console.log(`Unique Cruises (by id): ${stats.unique_cruises}`);
      console.log(`Unique Cruises (by cruise_id): ${stats.unique_cruise_ids}`);
      console.log(`Total Updates: ${stats.total_updates}`);
      console.log(
        `Updates Per Cruise: ${stats.unique_cruises > 0 ? (stats.total_updates / stats.unique_cruises).toFixed(2) : 'N/A'}`
      );
    } else {
      console.log('No cruise processing data available');
    }

    // 4. Check how many times the same cruise was updated
    const duplicateUpdates = await db.execute(sql`
      WITH cruise_updates AS (
        SELECT
          id as cruise_id,
          COUNT(*) as update_count
        FROM (
          SELECT DISTINCT id, DATE_TRUNC('minute', updated_at) as update_minute
          FROM cruises
          WHERE updated_at > NOW() - INTERVAL '24 hours'
        ) t
        GROUP BY id
      )
      SELECT
        update_count,
        COUNT(*) as cruise_count
      FROM cruise_updates
      GROUP BY update_count
      ORDER BY update_count DESC
      LIMIT 10
    `);

    console.log('\n🔄 Duplicate Update Distribution:');
    console.log('=================================');
    duplicateUpdates.rows.forEach(row => {
      if (row.update_count > 1) {
        console.log(`${row.cruise_count} cruises updated ${row.update_count} times`);
      }
    });

    // 5. Check memory-heavy operations
    const largeDataOperations = await db.execute(sql`
      SELECT
        DATE_TRUNC('hour', updated_at) as hour,
        COUNT(*) as cruises_updated,
        AVG(LENGTH(raw_data::text)) as avg_raw_data_size,
        MAX(LENGTH(raw_data::text)) as max_raw_data_size,
        SUM(LENGTH(raw_data::text)) / 1024 / 1024 as total_mb_processed
      FROM cruises
      WHERE updated_at > NOW() - INTERVAL '6 hours'
      GROUP BY hour
      ORDER BY hour DESC
    `);

    console.log('\n💾 Memory Usage by Hour (Last 6 Hours):');
    console.log('=======================================');
    largeDataOperations.rows.forEach(row => {
      const hour = new Date(row.hour).toLocaleTimeString();
      console.log(
        `${hour}: ${row.cruises_updated} cruises, ${row.total_mb_processed?.toFixed(2) || 0} MB processed`
      );
    });

    // 6. Check cruise lines being processed most frequently
    const lineProcessingFrequency = await db.execute(sql`
      SELECT
        cl.name as cruise_line,
        cl.id as line_id,
        COUNT(DISTINCT c.id) as cruises_in_db,
        COUNT(DISTINCT CASE WHEN c.updated_at > NOW() - INTERVAL '24 hours' THEN c.id END) as cruises_updated_24h,
        COUNT(DISTINCT CASE WHEN c.updated_at > NOW() - INTERVAL '1 hour' THEN c.id END) as cruises_updated_1h
      FROM cruise_lines cl
      LEFT JOIN cruises c ON c.cruise_line_id = cl.id
      GROUP BY cl.id, cl.name
      HAVING COUNT(DISTINCT CASE WHEN c.updated_at > NOW() - INTERVAL '24 hours' THEN c.id END) > 0
      ORDER BY cruises_updated_24h DESC
      LIMIT 15
    `);

    console.log('\n🚢 Cruise Lines Processing Frequency:');
    console.log('=====================================');
    lineProcessingFrequency.rows.forEach(row => {
      console.log(
        `${row.cruise_line} (${row.line_id}): ${row.cruises_updated_24h}/${row.cruises_in_db} cruises updated (24h), ${row.cruises_updated_1h} in last hour`
      );
    });
  } catch (error) {
    console.error('Error analyzing webhook frequency:', error);
  } finally {
    process.exit(0);
  }
}

analyzeWebhookFrequency();
