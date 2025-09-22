/**
 * FIXED VERSION - Sync cheapest_pricing table with cruises table
 * Fixes infinite loop issue by properly tracking processed cruises
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

  console.log('=' .repeat(80));
  console.log('SYNC CHEAPEST_PRICING TABLE (FIXED VERSION)');
  console.log('=' .repeat(80));
  console.log('Mode:', DRY_RUN ? '🔍 DRY RUN' : '⚠️  EXECUTE MODE');
  console.log();

  try {
    if (!DRY_RUN) {
      console.log('Strategy: Single bulk UPDATE using JOIN\n');

      // First, show what needs updating
      const preview = await sql`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN cp.cruise_id IS NULL THEN 1 END) as missing,
          COUNT(CASE WHEN
            ABS(COALESCE(c.cheapest_price::decimal, 0) - COALESCE(cp.cheapest_price, 0)) > 0.01
            THEN 1 END) as price_mismatch
        FROM cruises c
        LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
        WHERE c.is_active = true
      `;

      console.log('Current status:');
      console.log(`  Total active cruises: ${preview[0].total}`);
      console.log(`  Missing from cheapest_pricing: ${preview[0].missing}`);
      console.log(`  Price mismatches: ${preview[0].price_mismatch}`);
      console.log();

      // Delete entries for inactive cruises first
      console.log('Cleaning up inactive cruise entries...');
      const deleted = await sql`
        DELETE FROM cheapest_pricing
        WHERE cruise_id IN (
          SELECT cp.cruise_id
          FROM cheapest_pricing cp
          LEFT JOIN cruises c ON cp.cruise_id = c.id
          WHERE c.is_active = false OR c.id IS NULL
        )
      `;
      console.log(`  Removed ${deleted.count} inactive entries\n`);

      // Insert missing entries
      console.log('Inserting missing entries...');
      const inserted = await sql`
        INSERT INTO cheapest_pricing (
          cruise_id,
          interior_price,
          oceanview_price,
          balcony_price,
          suite_price,
          cheapest_price,
          last_updated
        )
        SELECT
          c.id,
          c.interior_price::decimal,
          c.oceanview_price::decimal,
          c.balcony_price::decimal,
          c.suite_price::decimal,
          c.cheapest_price::decimal,
          CURRENT_TIMESTAMP
        FROM cruises c
        LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
        WHERE c.is_active = true
        AND cp.cruise_id IS NULL
      `;
      console.log(`  Inserted ${inserted.count} new entries\n`);

      // Update mismatched prices in one go
      console.log('Updating mismatched prices...');
      const updated = await sql`
        UPDATE cheapest_pricing cp
        SET
          interior_price = c.interior_price::decimal,
          oceanview_price = c.oceanview_price::decimal,
          balcony_price = c.balcony_price::decimal,
          suite_price = c.suite_price::decimal,
          cheapest_price = c.cheapest_price::decimal,
          last_updated = CURRENT_TIMESTAMP
        FROM cruises c
        WHERE cp.cruise_id = c.id
        AND c.is_active = true
        AND (
          ABS(COALESCE(c.cheapest_price::decimal, 0) - COALESCE(cp.cheapest_price, 0)) > 0.01
          OR ABS(COALESCE(c.interior_price::decimal, 0) - COALESCE(cp.interior_price, 0)) > 0.01
          OR ABS(COALESCE(c.oceanview_price::decimal, 0) - COALESCE(cp.oceanview_price, 0)) > 0.01
          OR ABS(COALESCE(c.balcony_price::decimal, 0) - COALESCE(cp.balcony_price, 0)) > 0.01
          OR ABS(COALESCE(c.suite_price::decimal, 0) - COALESCE(cp.suite_price, 0)) > 0.01
        )
      `;
      console.log(`  Updated ${updated.count} entries with new prices\n`);

      // Final verification
      console.log('Verifying sync...');
      const final = await sql`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN
            ABS(COALESCE(c.cheapest_price::decimal, 0) - COALESCE(cp.cheapest_price, 0)) > 0.01
            THEN 1 END) as still_mismatched
        FROM cruises c
        LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
        WHERE c.is_active = true
      `;

      console.log('\n' + '=' .repeat(80));
      console.log('SYNC COMPLETE');
      console.log('=' .repeat(80));
      console.log(`Total processed: ${inserted.count + updated.count} cruises`);
      console.log(`  Inserted: ${inserted.count}`);
      console.log(`  Updated: ${updated.count}`);
      console.log(`  Deleted: ${deleted.count}`);

      if (final[0].still_mismatched === 0) {
        console.log('\n✅ SUCCESS: Tables are fully synchronized!');
      } else {
        console.log(`\n⚠️  WARNING: ${final[0].still_mismatched} cruises still have mismatches`);
      }

    } else {
      // Dry run - just show what would be done
      const stats = await sql`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN cp.cruise_id IS NULL THEN 1 END) as missing,
          COUNT(CASE WHEN
            ABS(COALESCE(c.cheapest_price::decimal, 0) - COALESCE(cp.cheapest_price, 0)) > 0.01
            OR ABS(COALESCE(c.interior_price::decimal, 0) - COALESCE(cp.interior_price, 0)) > 0.01
            OR ABS(COALESCE(c.oceanview_price::decimal, 0) - COALESCE(cp.oceanview_price, 0)) > 0.01
            OR ABS(COALESCE(c.balcony_price::decimal, 0) - COALESCE(cp.balcony_price, 0)) > 0.01
            OR ABS(COALESCE(c.suite_price::decimal, 0) - COALESCE(cp.suite_price, 0)) > 0.01
            THEN 1 END) as needs_update
        FROM cruises c
        LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
        WHERE c.is_active = true
      `;

      console.log('DRY RUN - What would be synced:');
      console.log(`  Total active cruises: ${stats[0].total}`);
      console.log(`  Missing entries to insert: ${stats[0].missing}`);
      console.log(`  Entries to update: ${stats[0].needs_update - stats[0].missing}`);
      console.log(`  Total operations: ${stats[0].needs_update}`);

      // Show examples
      const examples = await sql`
        SELECT
          c.id,
          c.name,
          c.cheapest_price::decimal as cruises_price,
          cp.cheapest_price as cp_price
        FROM cruises c
        LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
        WHERE c.is_active = true
        AND (
          cp.cruise_id IS NULL
          OR ABS(COALESCE(c.cheapest_price::decimal, 0) - COALESCE(cp.cheapest_price, 0)) > 0.01
        )
        LIMIT 5
      `;

      console.log('\nExample mismatches:');
      for (const ex of examples) {
        console.log(`  ${ex.id}: ${ex.name}`);
        console.log(`    Cruises table: $${ex.cruises_price || 'null'}`);
        console.log(`    Cheapest_pricing: $${ex.cp_price || 'null'}`);
      }

      console.log('\n' + '=' .repeat(80));
      console.log('To execute the sync, run:');
      console.log('  node scripts/sync-cheapest-pricing-fixed.js --execute');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
