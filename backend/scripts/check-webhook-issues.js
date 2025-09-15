const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

async function checkWebhookIssues() {
  console.log('=== Webhook Processing Analysis ===\n');

  try {
    // 1. Check if webhooks are coming in too frequently
    const webhookTiming = await db.execute(sql`
      WITH webhook_gaps AS (
        SELECT
          line_id,
          received_at,
          LAG(received_at) OVER (PARTITION BY line_id ORDER BY received_at) as prev_received,
          EXTRACT(EPOCH FROM (received_at - LAG(received_at) OVER (PARTITION BY line_id ORDER BY received_at))) / 60 as minutes_apart
        FROM webhook_events
        WHERE received_at > NOW() - INTERVAL '12 hours'
      )
      SELECT
        line_id,
        COUNT(*) as webhook_count,
        MIN(minutes_apart) as min_gap_minutes,
        AVG(minutes_apart)::NUMERIC(10,1) as avg_gap_minutes,
        MAX(minutes_apart) as max_gap_minutes
      FROM webhook_gaps
      WHERE minutes_apart IS NOT NULL
      GROUP BY line_id
      HAVING COUNT(*) > 5
      ORDER BY webhook_count DESC
      LIMIT 10
    `);

    console.log('📊 Webhook Frequency Analysis (12 hours):');
    console.log('========================================');
    if (webhookTiming && webhookTiming.rows) {
      webhookTiming.rows.forEach(row => {
        console.log(`Line ${row.line_id}: ${row.webhook_count} webhooks`);
        console.log(`  Gap: ${row.min_gap_minutes?.toFixed(1)}-${row.max_gap_minutes?.toFixed(1)} mins (avg: ${row.avg_gap_minutes} mins)`);
      });
    }

    // 2. Check for stuck processing jobs
    const stuckJobs = await db.execute(sql`
      SELECT
        line_id,
        webhook_type,
        status,
        received_at,
        processed_at,
        EXTRACT(EPOCH FROM (NOW() - received_at)) / 60 as minutes_ago
      FROM webhook_events
      WHERE status IN ('processing', 'pending')
        AND received_at < NOW() - INTERVAL '30 minutes'
      ORDER BY received_at DESC
      LIMIT 10
    `);

    console.log('\n⚠️  Potentially Stuck Webhooks (>30 mins old):');
    console.log('==============================================');
    if (stuckJobs && stuckJobs.rows && stuckJobs.rows.length > 0) {
      stuckJobs.rows.forEach(row => {
        console.log(`Line ${row.line_id}: ${row.status} for ${row.minutes_ago?.toFixed(0)} minutes`);
      });
    } else {
      console.log('No stuck webhooks found');
    }

    // 3. Check for price changes
    const priceChanges = await db.execute(sql`
      SELECT
        c.cruise_line_id,
        cl.name as line_name,
        COUNT(DISTINCT c.id) as cruises_checked,
        COUNT(DISTINCT CASE
          WHEN c.interior_price IS NOT NULL AND c.interior_price != ''
          THEN c.id
        END) as cruises_with_prices,
        MIN(c.updated_at) as first_update,
        MAX(c.updated_at) as last_update
      FROM cruises c
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.updated_at > NOW() - INTERVAL '3 hours'
      GROUP BY c.cruise_line_id, cl.name
      ORDER BY cruises_checked DESC
      LIMIT 10
    `);

    console.log('\n💰 Cruise Pricing Updates (3 hours):');
    console.log('===================================');
    if (priceChanges && priceChanges.rows) {
      priceChanges.rows.forEach(row => {
        const pct = row.cruises_checked > 0
          ? ((row.cruises_with_prices / row.cruises_checked) * 100).toFixed(1)
          : '0';
        console.log(`${row.line_name || 'Line ' + row.cruise_line_id}: ${row.cruises_checked} cruises, ${row.cruises_with_prices} with prices (${pct}%)`);
      });
    }

    // 4. Check what's actually in raw_data
    const rawDataSample = await db.execute(sql`
      SELECT
        id,
        name,
        LENGTH(raw_data::text) as data_size,
        raw_data->'lastcached' as last_cached,
        raw_data->'cacheddate' as cached_date,
        raw_data->'cheapest'->'combined'->>'inside' as combined_inside,
        raw_data->'prices' IS NOT NULL as has_prices,
        raw_data->'cabins' IS NOT NULL as has_cabins,
        raw_data->'itinerary' IS NOT NULL as has_itinerary,
        updated_at
      FROM cruises
      WHERE raw_data IS NOT NULL
        AND raw_data::text != 'null'
        AND raw_data::text != '{}'
      ORDER BY updated_at DESC
      LIMIT 5
    `);

    console.log('\n📦 Raw Data Content Sample:');
    console.log('==========================');
    if (rawDataSample && rawDataSample.rows) {
      rawDataSample.rows.forEach(row => {
        console.log(`${row.name}:`);
        console.log(`  Size: ${(row.data_size / 1024).toFixed(1)} KB`);
        console.log(`  Has: ${row.has_prices ? 'prices' : ''} ${row.has_cabins ? 'cabins' : ''} ${row.has_itinerary ? 'itinerary' : ''}`);
        console.log(`  Combined inside price: $${row.combined_inside || 'N/A'}`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkWebhookIssues();
