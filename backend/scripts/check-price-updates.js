#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION,
  ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});

async function checkPriceUpdates() {
  try {
    await client.connect();

    console.log('🔍 Checking Price Update Status in Database');
    console.log('=' .repeat(60));

    // 1. Check how many cruises have pricing data
    const pricingCoverage = await client.query(`
      SELECT
        COUNT(DISTINCT c.id) as total_cruises,
        COUNT(DISTINCT p.cruise_id) as cruises_with_pricing,
        ROUND(COUNT(DISTINCT p.cruise_id)::numeric / COUNT(DISTINCT c.id) * 100, 2) as coverage_percentage
      FROM cruises c
      LEFT JOIN pricing p ON c.id = p.cruise_id
      WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
    `);

    console.log('\n📊 Pricing Coverage:');
    console.log(`  Total active future cruises: ${pricingCoverage.rows[0].total_cruises}`);
    console.log(`  Cruises with pricing: ${pricingCoverage.rows[0].cruises_with_pricing}`);
    console.log(`  Coverage: ${pricingCoverage.rows[0].coverage_percentage}%`);

    // 2. Check recent price updates
    const recentUpdates = await client.query(`
      SELECT
        DATE(p.updated_at) as update_date,
        COUNT(DISTINCT p.cruise_id) as cruises_updated,
        COUNT(*) as price_records_updated
      FROM pricing p
      WHERE p.updated_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(p.updated_at)
      ORDER BY update_date DESC
    `);

    console.log('\n📅 Recent Price Updates (Last 7 Days):');
    if (recentUpdates.rows.length === 0) {
      console.log('  ⚠️ No price updates in the last 7 days!');
    } else {
      recentUpdates.rows.forEach(row => {
        console.log(`  ${row.update_date.toISOString().split('T')[0]}: ${row.cruises_updated} cruises, ${row.price_records_updated} price records`);
      });
    }

    // 3. Check cheapest_pricing table updates
    const cheapestUpdates = await client.query(`
      SELECT
        COUNT(*) as total_records,
        COUNT(CASE WHEN updated_at >= CURRENT_DATE - INTERVAL '1 day' THEN 1 END) as updated_today,
        COUNT(CASE WHEN updated_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as updated_week,
        MIN(updated_at) as oldest_update,
        MAX(updated_at) as newest_update
      FROM cheapest_pricing
    `);

    console.log('\n💰 Cheapest Pricing Table:');
    const cheap = cheapestUpdates.rows[0];
    console.log(`  Total records: ${cheap.total_records}`);
    console.log(`  Updated today: ${cheap.updated_today}`);
    console.log(`  Updated this week: ${cheap.updated_week}`);
    console.log(`  Oldest update: ${cheap.oldest_update ? new Date(cheap.oldest_update).toLocaleString() : 'N/A'}`);
    console.log(`  Newest update: ${cheap.newest_update ? new Date(cheap.newest_update).toLocaleString() : 'N/A'}`);

    // 4. Check webhook processing results
    const webhookStats = await client.query(`
      SELECT
        DATE(created_at) as webhook_date,
        COUNT(*) as total_webhooks,
        SUM(successful_count) as total_successful,
        SUM(failed_count) as total_failed,
        ROUND(AVG(processing_time_ms)) as avg_processing_ms
      FROM webhook_events
      WHERE created_at >= CURRENT_DATE - INTERVAL '3 days'
        AND event_type LIKE '%pricing%'
      GROUP BY DATE(created_at)
      ORDER BY webhook_date DESC
    `);

    console.log('\n🔄 Webhook Processing (Last 3 Days):');
    if (webhookStats.rows.length === 0) {
      console.log('  No webhook events found');
    } else {
      webhookStats.rows.forEach(row => {
        const successRate = row.total_successful && row.total_failed
          ? Math.round(row.total_successful / (row.total_successful + row.total_failed) * 100)
          : 0;
        console.log(`  ${row.webhook_date.toISOString().split('T')[0]}: ${row.total_webhooks} webhooks, ${successRate}% success rate, ${row.avg_processing_ms}ms avg`);
      });
    }

    // 5. Check specific cruise lines with recent webhooks
    const lineWebhooks = await client.query(`
      SELECT
        cl.name as cruise_line,
        cl.id as line_id,
        COUNT(DISTINCT c.id) as total_cruises,
        COUNT(DISTINCT p.cruise_id) as cruises_with_pricing,
        MAX(p.updated_at) as last_price_update,
        (
          SELECT COUNT(*)
          FROM webhook_events we
          WHERE we.payload->>'lineid' = cl.id::text
            AND we.created_at >= CURRENT_DATE - INTERVAL '7 days'
        ) as recent_webhooks
      FROM cruise_lines cl
      INNER JOIN cruises c ON c.cruise_line_id = cl.id
      LEFT JOIN pricing p ON p.cruise_id = c.id
      WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
      GROUP BY cl.id, cl.name
      HAVING COUNT(DISTINCT c.id) > 100
      ORDER BY recent_webhooks DESC, total_cruises DESC
      LIMIT 10
    `);

    console.log('\n🚢 Top Cruise Lines Status:');
    lineWebhooks.rows.forEach(row => {
      const coverage = Math.round(row.cruises_with_pricing / row.total_cruises * 100);
      const lastUpdate = row.last_price_update
        ? new Date(row.last_price_update).toLocaleDateString()
        : 'Never';
      console.log(`  ${row.cruise_line} (ID: ${row.line_id}):`);
      console.log(`    - Cruises: ${row.total_cruises}`);
      console.log(`    - With pricing: ${row.cruises_with_pricing} (${coverage}%)`);
      console.log(`    - Last update: ${lastUpdate}`);
      console.log(`    - Recent webhooks: ${row.recent_webhooks}`);
    });

    // 6. Sample check - get a few cruises and check their actual prices
    const sampleCruises = await client.query(`
      SELECT
        c.id,
        c.name,
        c.sailing_date,
        cl.name as cruise_line,
        COUNT(p.id) as price_count,
        MIN(p.base_price) as min_price,
        MAX(p.base_price) as max_price,
        MAX(p.updated_at) as last_updated,
        cp.cheapest_price,
        cp.interior_price,
        cp.oceanview_price,
        cp.balcony_price,
        cp.suite_price,
        cp.updated_at as cheapest_updated
      FROM cruises c
      INNER JOIN cruise_lines cl ON cl.id = c.cruise_line_id
      LEFT JOIN pricing p ON p.cruise_id = c.id
      LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE c.sailing_date >= CURRENT_DATE
        AND c.sailing_date <= CURRENT_DATE + INTERVAL '30 days'
        AND c.is_active = true
      GROUP BY c.id, c.name, c.sailing_date, cl.name, cp.cheapest_price,
               cp.interior_price, cp.oceanview_price, cp.balcony_price,
               cp.suite_price, cp.updated_at
      ORDER BY RANDOM()
      LIMIT 5
    `);

    console.log('\n🎲 Sample Cruise Price Check:');
    sampleCruises.rows.forEach(cruise => {
      console.log(`\n  ${cruise.name} (${cruise.cruise_line})`);
      console.log(`    ID: ${cruise.id}`);
      console.log(`    Sailing: ${new Date(cruise.sailing_date).toLocaleDateString()}`);
      console.log(`    Price records: ${cruise.price_count}`);
      if (cruise.price_count > 0) {
        console.log(`    Price range: $${cruise.min_price} - $${cruise.max_price}`);
        console.log(`    Last updated: ${cruise.last_updated ? new Date(cruise.last_updated).toLocaleString() : 'Never'}`);
      }
      if (cruise.cheapest_price) {
        console.log(`    Cheapest pricing:`);
        console.log(`      - Overall: $${cruise.cheapest_price}`);
        console.log(`      - Interior: $${cruise.interior_price || 'N/A'}`);
        console.log(`      - Oceanview: $${cruise.oceanview_price || 'N/A'}`);
        console.log(`      - Balcony: $${cruise.balcony_price || 'N/A'}`);
        console.log(`      - Suite: $${cruise.suite_price || 'N/A'}`);
        console.log(`      - Updated: ${cruise.cheapest_updated ? new Date(cruise.cheapest_updated).toLocaleString() : 'Never'}`);
      } else {
        console.log(`    ⚠️ No cheapest pricing data`);
      }
    });

    // 7. Check for stale data
    const staleData = await client.query(`
      SELECT
        COUNT(DISTINCT c.id) as stale_cruises
      FROM cruises c
      LEFT JOIN pricing p ON p.cruise_id = c.id
      WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
        AND c.sailing_date <= CURRENT_DATE + INTERVAL '90 days'
        AND (p.updated_at IS NULL OR p.updated_at < CURRENT_DATE - INTERVAL '7 days')
    `);

    console.log('\n⚠️ Data Quality Issues:');
    console.log(`  Cruises sailing in next 90 days with stale/no pricing: ${staleData.rows[0].stale_cruises}`);

  } catch (error) {
    console.error('❌ Error checking price updates:', error.message);
  } finally {
    await client.end();
  }
}

checkPriceUpdates().catch(console.error);
