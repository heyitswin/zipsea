/**
 * Monitor for raw_data corruption after syncs
 * Run this after a sync to verify no corruption is being introduced
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

function isCorruptedRawData(rawData) {
  // Check if it's a string (PostgreSQL returns corrupted JSONB as string)
  if (typeof rawData === 'string') {
    try {
      const parsed = JSON.parse(rawData);
      // If it parses and has numeric keys, it's corrupted
      if (typeof parsed === 'object' && parsed !== null) {
        const keys = Object.keys(parsed);
        return keys.some(key => /^\d+$/.test(key));
      }
    } catch (e) {
      // If it doesn't parse, it's corrupted
      return true;
    }
  }

  // Check if it's an object with numeric keys
  if (typeof rawData === 'object' && rawData !== null) {
    const keys = Object.keys(rawData);
    if (keys.some(key => /^\d+$/.test(key))) {
      return true;
    }
  }

  return false;
}

async function main() {
  const args = process.argv.slice(2);
  const minutesAgo = parseInt(args[0]) || 10;  // Default to checking last 10 minutes

  console.log('=' .repeat(80));
  console.log('SYNC CORRUPTION MONITORING');
  console.log('=' .repeat(80));
  console.log(`Checking cruises updated in the last ${minutesAgo} minutes...`);
  console.log(`Current time: ${new Date().toISOString()}\n`);

  try {
    // Get recently updated cruises
    const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000);
    console.log(`Checking cruises updated since: ${cutoffTime.toISOString()}\n`);

    const recentCruises = await sql`
      SELECT
        id,
        name,
        raw_data,
        updated_at,
        cruise_line_id
      FROM cruises
      WHERE updated_at >= ${cutoffTime}
      AND is_active = true
      ORDER BY updated_at DESC
    `;

    console.log(`Found ${recentCruises.length} recently updated cruises\n`);

    if (recentCruises.length === 0) {
      console.log('No cruises have been updated in the specified timeframe.');
      return;
    }

    // Check for corruption
    const corrupted = [];
    const byLine = {};

    for (const cruise of recentCruises) {
      if (isCorruptedRawData(cruise.raw_data)) {
        corrupted.push(cruise);

        // Track by cruise line
        const lineId = cruise.cruise_line_id || 'unknown';
        if (!byLine[lineId]) {
          byLine[lineId] = [];
        }
        byLine[lineId].push(cruise);
      }
    }

    // Report results
    console.log('=' .repeat(80));
    console.log('MONITORING RESULTS');
    console.log('=' .repeat(80));

    if (corrupted.length === 0) {
      console.log('✅ SUCCESS: No corruption detected in recent syncs!');
      console.log(`   All ${recentCruises.length} recently synced cruises have valid raw_data\n`);

      // Show some stats
      const lineStats = {};
      for (const cruise of recentCruises) {
        const lineId = cruise.cruise_line_id || 'unknown';
        lineStats[lineId] = (lineStats[lineId] || 0) + 1;
      }

      console.log('Sync Statistics by Cruise Line:');
      for (const [lineId, count] of Object.entries(lineStats)) {
        console.log(`  Line ${lineId}: ${count} cruises`);
      }

    } else {
      console.log('❌ ALERT: Corruption detected in recent syncs!');
      console.log(`   Found ${corrupted.length} corrupted cruises out of ${recentCruises.length} synced\n`);

      // Show details
      console.log('Corrupted Cruises by Cruise Line:');
      for (const [lineId, cruises] of Object.entries(byLine)) {
        console.log(`\n  Cruise Line ${lineId}: ${cruises.length} corrupted`);
        for (let i = 0; i < Math.min(3, cruises.length); i++) {
          const cruise = cruises[i];
          console.log(`    - ${cruise.id}: ${cruise.name}`);
          console.log(`      Updated: ${cruise.updated_at.toISOString()}`);
          console.log(`      Raw data type: ${typeof cruise.raw_data}`);
          if (typeof cruise.raw_data === 'string') {
            console.log(`      First 100 chars: ${cruise.raw_data.substring(0, 100)}...`);
          }
        }
      }

      console.log('\n⚠️  IMMEDIATE ACTION REQUIRED:');
      console.log('1. Check webhook processor logs for errors');
      console.log('2. Verify ensureValidRawData() is being called');
      console.log('3. Check if specific cruise lines are causing issues');
      console.log('4. Run fix script: node scripts/fix-remaining-json-strings-final.js --execute');
    }

    // Check for other potential issues
    console.log('\n' + '=' .repeat(80));
    console.log('ADDITIONAL CHECKS');
    console.log('=' .repeat(80));

    // Check for NULL prices in recent syncs
    const nullPrices = await sql`
      SELECT COUNT(*) as count
      FROM cruises
      WHERE updated_at >= ${cutoffTime}
      AND is_active = true
      AND cheapest_price IS NULL
      AND (
        interior_price IS NOT NULL
        OR oceanview_price IS NOT NULL
        OR balcony_price IS NOT NULL
        OR suite_price IS NOT NULL
      )
    `;

    if (nullPrices[0].count > 0) {
      console.log(`⚠️  Found ${nullPrices[0].count} cruises with NULL cheapest_price but valid cabin prices`);
      console.log('   Fix: node scripts/fix-null-cheapest-price.js --execute');
    } else {
      console.log('✅ All synced cruises have proper cheapest_price values');
    }

    // Check for suspiciously low prices
    const suspiciouslyLow = await sql`
      SELECT id, name, cheapest_price::decimal as price
      FROM cruises
      WHERE updated_at >= ${cutoffTime}
      AND is_active = true
      AND cheapest_price IS NOT NULL
      AND cheapest_price::decimal > 0
      AND cheapest_price::decimal < 50
      LIMIT 5
    `;

    if (suspiciouslyLow.length > 0) {
      console.log(`\n⚠️  Found ${suspiciouslyLow.length} cruises with suspiciously low prices (<$50):`);
      for (const cruise of suspiciouslyLow) {
        console.log(`   - ${cruise.id}: ${cruise.name} - $${cruise.price}`);
      }
      console.log('   These might indicate a pricing extraction issue');
    }

  } catch (error) {
    console.error('Error during monitoring:', error);
  } finally {
    await sql.end();
  }
}

main();
