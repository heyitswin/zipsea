#!/usr/bin/env node

/**
 * Verify Riviera Travel (line 329) pricing is correctly divided by 1000
 * This script checks if the fix is working in production
 */

require('dotenv').config();
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

async function verifyRivieraPrices() {
  console.log('🔍 Verifying Riviera Travel (Line 329) Pricing...\n');

  try {
    // Get sample Riviera cruises with pricing
    const query = sql`
      SELECT
        c.id,
        c.name,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        c.cheapest_price,
        c.raw_data,
        c.updated_at
      FROM cruises c
      WHERE c.cruise_line_id = 329
        AND c.cheapest_price IS NOT NULL
        AND c.raw_data IS NOT NULL
        AND c.sailing_date > NOW()
      ORDER BY c.updated_at DESC
      LIMIT 5
    `;

    const results = await db.execute(query);

    if (results.length === 0) {
      console.log('❌ No Riviera cruises found with pricing data');
      process.exit(1);
    }

    console.log(`Found ${results.length} Riviera cruises to verify:\n`);

    let correctCount = 0;
    let issues = [];

    for (const cruise of results) {
      console.log(`\nCruise: ${cruise.name}`);
      console.log(`ID: ${cruise.id}`);
      console.log(`Updated: ${cruise.updated_at}`);

      // Parse raw data to check original values
      const rawData = typeof cruise.raw_data === 'string'
        ? JSON.parse(cruise.raw_data)
        : cruise.raw_data;

      // Check if prices look reasonable (should be in hundreds/thousands, not hundreds of thousands)
      const prices = {
        interior: parseFloat(cruise.interior_price) || null,
        oceanview: parseFloat(cruise.oceanview_price) || null,
        balcony: parseFloat(cruise.balcony_price) || null,
        suite: parseFloat(cruise.suite_price) || null,
        cheapest: parseFloat(cruise.cheapest_price) || null
      };

      console.log('\nStored Prices:');
      console.log(`  Interior:  $${prices.interior || 'N/A'}`);
      console.log(`  Oceanview: $${prices.oceanview || 'N/A'}`);
      console.log(`  Balcony:   $${prices.balcony || 'N/A'}`);
      console.log(`  Suite:     $${prices.suite || 'N/A'}`);
      console.log(`  Cheapest:  $${prices.cheapest || 'N/A'}`);

      // Check if prices are in reasonable range (not inflated by 1000x)
      let hasIssue = false;
      for (const [type, price] of Object.entries(prices)) {
        if (price !== null) {
          if (price > 100000) {
            console.log(`  ⚠️  ${type} price seems inflated: $${price}`);
            hasIssue = true;
            issues.push(`Cruise ${cruise.id}: ${type} price = $${price}`);
          } else if (price < 100) {
            console.log(`  ⚠️  ${type} price seems too low: $${price}`);
            hasIssue = true;
            issues.push(`Cruise ${cruise.id}: ${type} price = $${price}`);
          }
        }
      }

      if (!hasIssue) {
        console.log('  ✅ Prices appear to be in correct range');
        correctCount++;
      }

      // Show raw data prices for comparison
      if (rawData.cheapestinside || rawData.cheapestbalcony) {
        console.log('\nRaw Data Prices (from FTP):');
        if (rawData.cheapestinside?.price) {
          console.log(`  Raw Interior: ${rawData.cheapestinside.price}`);
        }
        if (rawData.cheapestoutside?.price) {
          console.log(`  Raw Oceanview: ${rawData.cheapestoutside.price}`);
        }
        if (rawData.cheapestbalcony?.price) {
          console.log(`  Raw Balcony: ${rawData.cheapestbalcony.price}`);
        }
        if (rawData.cheapestsuite?.price) {
          console.log(`  Raw Suite: ${rawData.cheapestsuite.price}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Cruises with correct pricing: ${correctCount}/${results.length}`);

    if (issues.length > 0) {
      console.log('\n⚠️  Potential Issues Found:');
      issues.forEach(issue => console.log(`  - ${issue}`));
      console.log('\nThe divide-by-1000 fix may not be applied correctly.');
    } else {
      console.log('\n✅ All checked Riviera cruises have reasonable pricing!');
      console.log('The divide-by-1000 fix appears to be working correctly.');
    }

    // Check when the last successful webhook was processed
    const webhookQuery = sql`
      SELECT
        id,
        status,
        received_at,
        processed_at
      FROM webhook_events
      WHERE line_id = 329
      ORDER BY received_at DESC
      LIMIT 5
    `;

    const webhooks = await db.execute(webhookQuery);

    console.log('\n📊 Recent Riviera Webhook Events:');
    for (const webhook of webhooks) {
      console.log(`  ID: ${webhook.id}, Status: ${webhook.status}, Received: ${webhook.received_at}`);
    }

    process.exit(issues.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyRivieraPrices();
