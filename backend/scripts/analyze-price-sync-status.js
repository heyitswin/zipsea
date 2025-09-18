require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

async function analyzePriceSyncStatus() {
  console.log('=== CRUISE PRICE SYNC STATUS ANALYSIS ===\n');
  console.log('Analyzing sync patterns and price data completeness...\n');

  try {
    // 1. Overall sync status
    const overallQuery = `
      SELECT
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '24 hours' THEN 1 END) as synced_24h,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '7 days' THEN 1 END) as synced_7d,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '30 days' THEN 1 END) as synced_30d,
        COUNT(CASE WHEN updated_at <= NOW() - INTERVAL '30 days' THEN 1 END) as older_than_30d,
        COUNT(CASE WHEN cheapest_price IS NOT NULL AND cheapest_price > 99 THEN 1 END) as with_valid_price,
        COUNT(CASE WHEN cheapest_price IS NULL OR cheapest_price <= 99 THEN 1 END) as invalid_price
      FROM cruises
      WHERE is_active = true
        AND sailing_date >= CURRENT_DATE
        AND sailing_date <= CURRENT_DATE + INTERVAL '6 months'
    `;

    const overall = await pool.query(overallQuery);
    const stats = overall.rows[0];

    console.log('OVERALL SYNC STATUS (Next 6 months):');
    console.log('=====================================');
    console.log(`Total active cruises: ${stats.total_cruises}`);
    console.log(`Synced in last 24h: ${stats.synced_24h} (${(stats.synced_24h/stats.total_cruises*100).toFixed(1)}%)`);
    console.log(`Synced in last 7d: ${stats.synced_7d} (${(stats.synced_7d/stats.total_cruises*100).toFixed(1)}%)`);
    console.log(`Synced in last 30d: ${stats.synced_30d} (${(stats.synced_30d/stats.total_cruises*100).toFixed(1)}%)`);
    console.log(`Not synced >30d: ${stats.older_than_30d} (${(stats.older_than_30d/stats.total_cruises*100).toFixed(1)}%)`);
    console.log(`\nWith valid prices: ${stats.with_valid_price} (${(stats.with_valid_price/stats.total_cruises*100).toFixed(1)}%)`);
    console.log(`Missing/invalid prices: ${stats.invalid_price} (${(stats.invalid_price/stats.total_cruises*100).toFixed(1)}%)`);

    // 2. By cruise line analysis with sampling
    const byLineQuery = `
      WITH cruise_samples AS (
        SELECT
          c.*,
          cl.name as cruise_line,
          ROW_NUMBER() OVER (PARTITION BY cl.id ORDER BY RANDOM()) as rn
        FROM cruises c
        JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        WHERE c.is_active = true
          AND c.sailing_date >= CURRENT_DATE
          AND c.sailing_date <= CURRENT_DATE + INTERVAL '6 months'
      ),
      line_stats AS (
        SELECT
          cruise_line,
          COUNT(*) as total,
          COUNT(CASE WHEN updated_at > NOW() - INTERVAL '24 hours' THEN 1 END) as synced_24h,
          COUNT(CASE WHEN updated_at > NOW() - INTERVAL '7 days' THEN 1 END) as synced_7d,
          COUNT(CASE WHEN cheapest_price IS NOT NULL AND cheapest_price > 99 THEN 1 END) as with_price,
          COUNT(CASE WHEN interior_price IS NOT NULL OR oceanview_price IS NOT NULL
                      OR balcony_price IS NOT NULL OR suite_price IS NOT NULL THEN 1 END) as with_cabin_prices,
          AVG(EXTRACT(EPOCH FROM (NOW() - updated_at))/3600)::INT as avg_hours_since_sync
        FROM cruise_samples
        GROUP BY cruise_line
        HAVING COUNT(*) >= 10
      )
      SELECT * FROM line_stats
      ORDER BY total DESC
      LIMIT 15
    `;

    const byLine = await pool.query(byLineQuery);

    console.log('\n\nBY CRUISE LINE (Top 15 by volume):');
    console.log('====================================');
    console.log('Cruise Line                    | Total | <24h | <7d  | Valid$ | Cabin$ | Avg Age');
    console.log('-------------------------------|-------|------|------|--------|--------|--------');

    byLine.rows.forEach(row => {
      const name = row.cruise_line.padEnd(30).substring(0, 30);
      const total = String(row.total).padStart(5);
      const day1 = String(row.synced_24h).padStart(4);
      const day7 = String(row.synced_7d).padStart(4);
      const withPrice = String(row.with_price).padStart(6);
      const withCabin = String(row.with_cabin_prices).padStart(6);
      const avgAge = row.avg_hours_since_sync ? `${row.avg_hours_since_sync}h` : 'N/A';

      console.log(`${name} | ${total} | ${day1} | ${day7} | ${withPrice} | ${withCabin} | ${avgAge.padStart(7)}`);
    });

    // 3. Sample recent syncs to check data quality
    const recentSampleQuery = `
      SELECT
        cl.name as cruise_line,
        c.id,
        c.cruise_id,
        c.name,
        c.sailing_date,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        c.cheapest_price,
        c.updated_at,
        EXTRACT(EPOCH FROM (NOW() - c.updated_at))/3600 as hours_since_sync,
        jsonb_typeof(c.raw_data) as raw_data_type,
        CASE
          WHEN c.raw_data IS NOT NULL AND jsonb_typeof(c.raw_data) = 'object' THEN
            jsonb_build_object(
              'cheapestinside', c.raw_data->'cheapestinside',
              'cheapestoutside', c.raw_data->'cheapestoutside',
              'cheapestbalcony', c.raw_data->'cheapestbalcony',
              'cheapestsuite', c.raw_data->'cheapestsuite'
            )
          ELSE NULL
        END as raw_prices
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
        AND c.sailing_date <= CURRENT_DATE + INTERVAL '6 months'
        AND c.updated_at > NOW() - INTERVAL '48 hours'
      ORDER BY c.updated_at DESC
      LIMIT 20
    `;

    const recentSamples = await pool.query(recentSampleQuery);

    console.log('\n\nRECENT SYNC SAMPLES (Last 48h):');
    console.log('=================================');

    let syncIssues = 0;
    recentSamples.rows.forEach((cruise, i) => {
      const hasDbPrices = cruise.interior_price || cruise.oceanview_price ||
                         cruise.balcony_price || cruise.suite_price;

      let rawPricesExist = false;
      if (cruise.raw_prices) {
        const raw = cruise.raw_prices;
        rawPricesExist = raw.cheapestinside || raw.cheapestoutside ||
                        raw.cheapestbalcony || raw.cheapestsuite;
      }

      const syncAge = Math.round(cruise.hours_since_sync);

      if (!hasDbPrices && rawPricesExist) {
        console.log(`\n⚠️  SYNC ISSUE - ${cruise.cruise_line}`);
        console.log(`   ${cruise.name} (${cruise.cruise_id})`);
        console.log(`   Synced ${syncAge}h ago but DB prices not extracted!`);
        console.log(`   Raw has prices: ${JSON.stringify(cruise.raw_prices)}`);
        console.log(`   DB prices: Interior=$${cruise.interior_price || 'NULL'}, Ocean=$${cruise.oceanview_price || 'NULL'}, Balcony=$${cruise.balcony_price || 'NULL'}, Suite=$${cruise.suite_price || 'NULL'}`);
        syncIssues++;
      } else if (i < 5) {
        console.log(`\n✅ ${cruise.cruise_line} - ${cruise.name}`);
        console.log(`   Synced ${syncAge}h ago`);
        console.log(`   DB: Interior=$${cruise.interior_price || 'N/A'}, Ocean=$${cruise.oceanview_price || 'N/A'}, Balcony=$${cruise.balcony_price || 'N/A'}, Suite=$${cruise.suite_price || 'N/A'}`);
        if (cruise.raw_prices) {
          const raw = cruise.raw_prices;
          console.log(`   Raw: Inside=${raw.cheapestinside || 'null'}, Outside=${raw.cheapestoutside || 'null'}, Balcony=${raw.cheapestbalcony || 'null'}, Suite=${raw.cheapestsuite || 'null'}`);
        }
      }
    });

    if (syncIssues > 0) {
      console.log(`\n🚨 Found ${syncIssues} cruises with sync extraction issues!`);
    }

    // 4. Check for stale high-volume cruise lines
    const staleCheckQuery = `
      SELECT
        cl.name as cruise_line,
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN c.updated_at <= NOW() - INTERVAL '7 days' THEN 1 END) as stale_cruises,
        MIN(c.updated_at) as oldest_sync,
        MAX(c.updated_at) as newest_sync
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
        AND c.sailing_date <= CURRENT_DATE + INTERVAL '3 months'
      GROUP BY cl.id, cl.name
      HAVING COUNT(*) >= 50
        AND COUNT(CASE WHEN c.updated_at <= NOW() - INTERVAL '7 days' THEN 1 END) > COUNT(*) * 0.5
      ORDER BY stale_cruises DESC
      LIMIT 10
    `;

    const staleLines = await pool.query(staleCheckQuery);

    if (staleLines.rows.length > 0) {
      console.log('\n\n⚠️  CRUISE LINES NEEDING SYNC (>50% stale):');
      console.log('============================================');
      console.log('Cruise Line                    | Total | Stale | % Stale | Oldest Sync');
      console.log('-------------------------------|-------|-------|---------|------------');

      staleLines.rows.forEach(row => {
        const name = row.cruise_line.padEnd(30).substring(0, 30);
        const total = String(row.total_cruises).padStart(5);
        const stale = String(row.stale_cruises).padStart(5);
        const pct = ((row.stale_cruises / row.total_cruises) * 100).toFixed(1).padStart(7);
        const oldest = new Date(row.oldest_sync).toISOString().split('T')[0];

        console.log(`${name} | ${total} | ${stale} | ${pct}% | ${oldest}`);
      });
    }

    // 5. Summary recommendations
    console.log('\n\nRECOMMENDATIONS:');
    console.log('================');

    if (syncIssues > 0) {
      console.log('🚨 CRITICAL: Found recent syncs where prices exist in raw_data but were not extracted to DB.');
      console.log('   ACTION: Check webhook processor for extraction issues.');
    }

    if (stats.older_than_30d > stats.total_cruises * 0.2) {
      console.log(`⚠️  WARNING: ${(stats.older_than_30d/stats.total_cruises*100).toFixed(1)}% of cruises haven't been synced in 30+ days.`);
      console.log('   ACTION: Review sync job scheduling and ensure it covers all cruise lines.');
    }

    if (staleLines.rows.length > 0) {
      console.log(`📅 SYNC NEEDED: ${staleLines.rows.length} cruise lines have >50% stale data (7+ days old).`);
      console.log(`   ACTION: Prioritize sync for: ${staleLines.rows.slice(0, 3).map(r => r.cruise_line).join(', ')}`);
    }

    const priceCompleteness = (stats.with_valid_price / stats.total_cruises * 100);
    if (priceCompleteness < 80) {
      console.log(`💰 PRICE DATA: Only ${priceCompleteness.toFixed(1)}% of cruises have valid prices.`);
      console.log('   ACTION: Investigate why cruises are missing price data.');
    } else {
      console.log(`✅ PRICE DATA: ${priceCompleteness.toFixed(1)}% of cruises have valid prices.`);
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  } finally {
    await pool.end();
  }
}

analyzePriceSyncStatus().catch(console.error);
