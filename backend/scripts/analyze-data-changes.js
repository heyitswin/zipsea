const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

async function analyzeDataChanges() {
  console.log('=== Analyzing Data Changes Between Syncs ===\n');

  try {
    // 1. Check cruises that were updated multiple times today
    const multiUpdateCruises = await db.execute(sql`
      WITH cruise_versions AS (
        SELECT
          id,
          cruise_id,
          name,
          updated_at,
          raw_data,
          interior_price,
          oceanview_price,
          balcony_price,
          suite_price,
          LAG(updated_at) OVER (PARTITION BY id ORDER BY updated_at) as prev_updated_at,
          LAG(interior_price) OVER (PARTITION BY id ORDER BY updated_at) as prev_interior,
          LAG(oceanview_price) OVER (PARTITION BY id ORDER BY updated_at) as prev_oceanview,
          LAG(balcony_price) OVER (PARTITION BY id ORDER BY updated_at) as prev_balcony,
          LAG(suite_price) OVER (PARTITION BY id ORDER BY updated_at) as prev_suite
        FROM cruises
        WHERE updated_at > NOW() - INTERVAL '6 hours'
      )
      SELECT
        id,
        cruise_id,
        name,
        updated_at,
        prev_updated_at,
        interior_price != prev_interior as interior_changed,
        oceanview_price != prev_oceanview as oceanview_changed,
        balcony_price != prev_balcony as balcony_changed,
        suite_price != prev_suite as suite_changed,
        EXTRACT(EPOCH FROM (updated_at - prev_updated_at)) / 60 as minutes_between
      FROM cruise_versions
      WHERE prev_updated_at IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 20
    `);

    console.log('📊 Recent Cruise Updates (Multiple Updates):');
    console.log('===========================================');
    if (multiUpdateCruises && multiUpdateCruises.rows && multiUpdateCruises.rows.length > 0) {
      multiUpdateCruises.rows.forEach(row => {
        const changes = [];
        if (row.interior_changed) changes.push('interior');
        if (row.oceanview_changed) changes.push('oceanview');
        if (row.balcony_changed) changes.push('balcony');
        if (row.suite_changed) changes.push('suite');

        const changeStr = changes.length > 0 ? `Changed: ${changes.join(', ')}` : 'No price changes';
        console.log(`${row.name} (${row.id}): ${changeStr} - ${row.minutes_between?.toFixed(1)} mins apart`);
      });
    } else {
      console.log('No multiple updates found in last 6 hours');
    }

    // 2. Sample a few cruises to check what fields typically change
    const sampleCruise = await db.execute(sql`
      SELECT
        id,
        cruise_id,
        name,
        updated_at,
        LENGTH(raw_data::text) as raw_data_size,
        jsonb_typeof(raw_data) as raw_data_type,
        raw_data->>'lastcached' as last_cached,
        raw_data->>'cacheddate' as cached_date,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price
      FROM cruises
      WHERE raw_data IS NOT NULL
        AND updated_at > NOW() - INTERVAL '1 hour'
      ORDER BY updated_at DESC
      LIMIT 5
    `);

    console.log('\n🔍 Sample Cruise Raw Data Info:');
    console.log('================================');
    if (sampleCruise && sampleCruise.rows) {
      sampleCruise.rows.forEach(row => {
        console.log(`${row.name} (${row.id}):`);
        console.log(`  Raw data size: ${(row.raw_data_size / 1024).toFixed(1)} KB`);
        console.log(`  Last cached: ${row.last_cached || 'N/A'}`);
        console.log(`  Cached date: ${row.cached_date || 'N/A'}`);
        console.log(`  Prices: I:$${row.interior_price || 0} O:$${row.oceanview_price || 0} B:$${row.balcony_price || 0} S:$${row.suite_price || 0}`);
      });
    }

    // 3. Check if we're storing identical data
    const identicalCheck = await db.execute(sql`
      WITH cruise_hashes AS (
        SELECT
          id,
          cruise_id,
          name,
          updated_at,
          MD5(COALESCE(interior_price, '') || COALESCE(oceanview_price, '') ||
              COALESCE(balcony_price, '') || COALESCE(suite_price, '')) as price_hash
        FROM cruises
        WHERE updated_at > NOW() - INTERVAL '3 hours'
      ),
      duplicates AS (
        SELECT
          c1.id,
          c1.name,
          c1.updated_at as update1,
          c2.updated_at as update2,
          c1.price_hash
        FROM cruise_hashes c1
        JOIN cruise_hashes c2 ON c1.id = c2.id
          AND c1.updated_at < c2.updated_at
          AND c1.price_hash = c2.price_hash
      )
      SELECT COUNT(DISTINCT id) as cruises_with_identical_updates
      FROM duplicates
    `);

    console.log('\n🔄 Duplicate Data Analysis:');
    console.log('===========================');
    if (identicalCheck && identicalCheck.rows && identicalCheck.rows[0]) {
      console.log(`Cruises with identical price updates: ${identicalCheck.rows[0].cruises_with_identical_updates}`);
    }

    // 4. Check webhook processing patterns
    const webhookPatterns = await db.execute(sql`
      SELECT
        line_id,
        COUNT(*) as webhook_count,
        COUNT(DISTINCT DATE_TRUNC('hour', received_at)) as unique_hours,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as still_processing,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        MAX(received_at) as last_webhook
      FROM webhook_events
      WHERE received_at > NOW() - INTERVAL '6 hours'
      GROUP BY line_id
      HAVING COUNT(*) > 1
      ORDER BY webhook_count DESC
      LIMIT 10
    `);

    console.log('\n📡 Webhook Processing Status (6 hours):');
    console.log('======================================');
    if (webhookPatterns && webhookPatterns.rows) {
      webhookPatterns.rows.forEach(row => {
        console.log(`Line ${row.line_id}: ${row.webhook_count} webhooks, ${row.still_processing} processing, ${row.pending} pending`);
      });
    }

  } catch (error) {
    console.error('Error analyzing data changes:', error);
  } finally {
    process.exit(0);
  }
}

analyzeDataChanges();
