/**
 * Sync cheapest_pricing table with corrected prices from cruises table
 * The cruises table was fixed but cheapest_pricing still has old/stale data
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const sql = postgres(dbUrl, {
  ssl: { rejectUnauthorized: false },
  max: 5,
  idle_timeout: 20,
  connect_timeout: 30
});

async function main() {
  const args = process.argv.slice(2);
  const DRY_RUN = !args.includes('--execute');
  const BATCH_SIZE = 100;

  console.log('=' .repeat(80));
  console.log('SYNC CHEAPEST_PRICING TABLE WITH CRUISES TABLE');
  console.log('=' .repeat(80));
  console.log('Mode:', DRY_RUN ? '🔍 DRY RUN' : '⚠️  EXECUTE MODE');
  console.log('Issue: cheapest_pricing table has stale data from before corruption fix');
  console.log('Fix: Update cheapest_pricing with corrected prices from cruises table\n');

  try {
    // First, check how many are out of sync
    console.log('Checking for mismatches between tables...\n');

    const mismatchCount = await sql`
      SELECT COUNT(*) as count
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.is_active = true
      AND (
        ABS(COALESCE(c.cheapest_price::decimal, 0) - COALESCE(cp.cheapest_price, 0)) > 0.01
        OR ABS(COALESCE(c.interior_price::decimal, 0) - COALESCE(cp.interior_price, 0)) > 0.01
        OR ABS(COALESCE(c.oceanview_price::decimal, 0) - COALESCE(cp.oceanview_price, 0)) > 0.01
        OR ABS(COALESCE(c.balcony_price::decimal, 0) - COALESCE(cp.balcony_price, 0)) > 0.01
        OR ABS(COALESCE(c.suite_price::decimal, 0) - COALESCE(cp.suite_price, 0)) > 0.01
        OR cp.cruise_id IS NULL
      )
    `;

    console.log(`Found ${mismatchCount[0].count} cruises needing sync\n`);

    if (mismatchCount[0].count === 0) {
      console.log('✅ Tables are already in sync!');
      return;
    }

    // Show some examples
    console.log('Examples of mismatches:');
    const examples = await sql`
      SELECT
        c.id,
        c.name,
        c.cheapest_price::decimal as cruises_cheapest,
        c.interior_price::decimal as cruises_interior,
        cp.cheapest_price as cp_cheapest,
        cp.interior_price as cp_interior,
        cp.last_updated
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.is_active = true
      AND (
        ABS(COALESCE(c.cheapest_price::decimal, 0) - COALESCE(cp.cheapest_price, 0)) > 0.01
        OR cp.cruise_id IS NULL
      )
      LIMIT 5
    `;

    for (const ex of examples) {
      console.log(`\nCruise ${ex.id}: ${ex.name}`);
      console.log(`  Cruises table: $${ex.cruises_cheapest || 'null'}`);
      console.log(`  Cheapest_pricing table: $${ex.cp_cheapest || 'null'}`);
      if (ex.last_updated) {
        console.log(`  Last updated in CP: ${ex.last_updated}`);
      }
    }

    if (!DRY_RUN) {
      console.log('\n' + '=' .repeat(80));
      console.log('STARTING SYNC...');
      console.log('=' .repeat(80) + '\n');

      let offset = 0;
      let totalSynced = 0;
      let hasMore = true;

      while (hasMore) {
        // Get batch of mismatched cruises
        const batch = await sql`
          SELECT
            c.id,
            c.cruise_id,
            c.interior_price::decimal as interior_price,
            c.oceanview_price::decimal as oceanview_price,
            c.balcony_price::decimal as balcony_price,
            c.suite_price::decimal as suite_price,
            c.cheapest_price::decimal as cheapest_price
          FROM cruises c
          LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
          WHERE c.is_active = true
          AND (
            ABS(COALESCE(c.cheapest_price::decimal, 0) - COALESCE(cp.cheapest_price, 0)) > 0.01
            OR ABS(COALESCE(c.interior_price::decimal, 0) - COALESCE(cp.interior_price, 0)) > 0.01
            OR ABS(COALESCE(c.oceanview_price::decimal, 0) - COALESCE(cp.oceanview_price, 0)) > 0.01
            OR ABS(COALESCE(c.balcony_price::decimal, 0) - COALESCE(cp.balcony_price, 0)) > 0.01
            OR ABS(COALESCE(c.suite_price::decimal, 0) - COALESCE(cp.suite_price, 0)) > 0.01
            OR cp.cruise_id IS NULL
          )
          LIMIT ${BATCH_SIZE}
        `;

        if (batch.length === 0) {
          hasMore = false;
          break;
        }

        console.log(`Processing batch of ${batch.length} cruises...`);

        // Upsert each cruise into cheapest_pricing
        for (const cruise of batch) {
          try {
            await sql`
              INSERT INTO cheapest_pricing (
                cruise_id,
                interior_price,
                oceanview_price,
                balcony_price,
                suite_price,
                cheapest_price,
                last_updated
              ) VALUES (
                ${cruise.id},
                ${cruise.interior_price},
                ${cruise.oceanview_price},
                ${cruise.balcony_price},
                ${cruise.suite_price},
                ${cruise.cheapest_price},
                CURRENT_TIMESTAMP
              )
              ON CONFLICT (cruise_id) DO UPDATE SET
                interior_price = EXCLUDED.interior_price,
                oceanview_price = EXCLUDED.oceanview_price,
                balcony_price = EXCLUDED.balcony_price,
                suite_price = EXCLUDED.suite_price,
                cheapest_price = EXCLUDED.cheapest_price,
                last_updated = CURRENT_TIMESTAMP
            `;
            totalSynced++;
          } catch (error) {
            console.error(`Error syncing cruise ${cruise.id}:`, error.message);
          }
        }

        if (totalSynced % 1000 === 0) {
          console.log(`Progress: Synced ${totalSynced} cruises...`);
        }

        // Small delay to avoid overloading
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log('\n' + '=' .repeat(80));
      console.log('SYNC COMPLETE');
      console.log('=' .repeat(80));
      console.log(`Total cruises synced: ${totalSynced}`);

      // Verify sync
      console.log('\nVerifying sync...');
      const remaining = await sql`
        SELECT COUNT(*) as count
        FROM cruises c
        LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
        WHERE c.is_active = true
        AND (
          ABS(COALESCE(c.cheapest_price::decimal, 0) - COALESCE(cp.cheapest_price, 0)) > 0.01
          OR cp.cruise_id IS NULL
        )
      `;

      if (remaining[0].count === 0) {
        console.log('✅ SUCCESS: All tables are now in sync!');
      } else {
        console.log(`⚠️  WARNING: ${remaining[0].count} cruises still have mismatches`);
      }

    } else {
      console.log('\n' + '=' .repeat(80));
      console.log('DRY RUN SUMMARY');
      console.log('=' .repeat(80));
      console.log(`Would sync ${mismatchCount[0].count} cruises`);
      console.log('\nTo execute the sync, run:');
      console.log('  node scripts/sync-cheapest-pricing-table.js --execute');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
