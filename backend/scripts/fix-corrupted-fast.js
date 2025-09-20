#!/usr/bin/env node
require('dotenv').config();
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { sql } = require('drizzle-orm');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const client = postgres(DATABASE_URL, {
  ssl: 'require',
});
const db = drizzle(client);

async function fixCruises(cruiseIds) {
  const results = { fixed: [], failed: [] };

  for (const id of cruiseIds) {
    try {
      // Get the corrupted raw_data
      const result = await db.execute(sql`
        SELECT id, raw_data
        FROM cruises
        WHERE id = ${id}
      `);

      if (!result.rows || result.rows.length === 0) continue;

      const cruise = result.rows[0];
      let rawData = cruise.raw_data;

      // Parse if it's a string
      if (typeof rawData === 'string') {
        rawData = JSON.parse(rawData);
      }

      // Extract prices from top-level fields
      const prices = {
        interior: parseFloat(rawData.cheapestinside?.replace(/[^0-9.-]/g, '') || 0) || null,
        oceanview: parseFloat(rawData.cheapestoutside?.replace(/[^0-9.-]/g, '') || 0) || null,
        balcony: parseFloat(rawData.cheapestbalcony?.replace(/[^0-9.-]/g, '') || 0) || null,
        suite: parseFloat(rawData.cheapestsuite?.replace(/[^0-9.-]/g, '') || 0) || null,
      };

      // Calculate cheapest price
      const validPrices = Object.values(prices).filter(p => p && p > 0);
      const cheapestPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

      // Update the cruise
      await db.execute(sql`
        UPDATE cruises
        SET
          raw_data = ${JSON.stringify(rawData)}::jsonb,
          interior_price = ${prices.interior},
          oceanview_price = ${prices.oceanview},
          balcony_price = ${prices.balcony},
          suite_price = ${prices.suite},
          cheapest_price = ${cheapestPrice},
          updated_at = NOW()
        WHERE id = ${id}
      `);

      results.fixed.push(id);
      console.log(`✅ Fixed cruise ${id}: interior=$${prices.interior}`);
    } catch (error) {
      console.error(`❌ Failed to fix cruise ${id}:`, error.message);
      results.failed.push(id);
    }
  }

  return results;
}

async function main() {
  console.log('🔧 FAST FIX FOR SPECIFIC CRUISES');
  console.log('=====================================\n');

  // Fix the two problem cruises first
  const targetCruises = ['2145865', '2190299'];

  console.log(`Fixing cruises: ${targetCruises.join(', ')}\n`);

  const results = await fixCruises(targetCruises);

  console.log(`\n✅ Fixed: ${results.fixed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);

  if (results.fixed.includes('2145865')) {
    // Verify the fix
    const check = await db.execute(sql`
      SELECT id, interior_price, oceanview_price, balcony_price, suite_price, cheapest_price
      FROM cruises
      WHERE id = '2145865'
    `);

    if (check.rows && check.rows.length > 0) {
      const cruise = check.rows[0];
      console.log('\n📊 Cruise 2145865 after fix:');
      console.log(`  Interior:  $${cruise.interior_price}`);
      console.log(`  Oceanview: $${cruise.oceanview_price}`);
      console.log(`  Balcony:   $${cruise.balcony_price}`);
      console.log(`  Suite:     $${cruise.suite_price}`);
      console.log(`  Cheapest:  $${cruise.cheapest_price}`);
    }
  }

  await client.end();
}

main().catch(console.error);
