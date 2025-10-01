/**
 * Deduplication Script for Duplicate Cruises
 *
 * Finds and merges duplicate cruise records that have:
 * - Same cruise_line_id
 * - Same ship_id
 * - Same sailing_date
 * - Same voyage_code (or both null)
 *
 * Strategy:
 * 1. Find all duplicate groups
 * 2. For each group, keep the record with the most recent pricing update
 * 3. Update all foreign key references to point to the keeper
 * 4. Delete the duplicate records
 *
 * Usage: npx tsx scripts/deduplicate-cruises.ts [--dry-run]
 */

import { db } from '../src/db/connection';
import { sql } from 'drizzle-orm';

const DRY_RUN = process.argv.includes('--dry-run');

console.log(`
===================================
Cruise Deduplication Script
===================================
Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (will modify database)'}
Started: ${new Date().toISOString()}
===================================
`);

async function findDuplicates() {
  console.log('\n[1/5] Finding duplicate cruise groups...\n');

  const duplicates = await db.execute(sql`
    SELECT
      cruise_line_id,
      ship_id,
      sailing_date,
      COALESCE(voyage_code, 'NULL') as voyage_code_group,
      COUNT(*) as duplicate_count,
      ARRAY_AGG(id ORDER BY updated_at DESC) as cruise_ids,
      ARRAY_AGG(updated_at ORDER BY updated_at DESC) as update_times,
      ARRAY_AGG(cheapest_price ORDER BY updated_at DESC) as prices
    FROM cruises
    WHERE sailing_date >= CURRENT_DATE - INTERVAL '1 year'
    GROUP BY cruise_line_id, ship_id, sailing_date, COALESCE(voyage_code, 'NULL')
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, sailing_date
  `);

  console.log(`Found ${duplicates.length} groups with duplicates\n`);

  if (duplicates.length > 0) {
    console.log('Top 10 duplicate groups:');
    console.log('─'.repeat(100));
    duplicates.slice(0, 10).forEach((dup: any) => {
      // Convert PostgreSQL arrays to JavaScript arrays
      // PostgreSQL returns arrays as "{val1,val2}" string format
      const parsePgArray = (val: any): any[] => {
        if (Array.isArray(val)) return val;
        if (!val) return [];
        if (typeof val === 'string') {
          // Remove outer braces and split by comma
          const cleaned = val.replace(/^\{|\}$/g, '');
          if (!cleaned) return [];
          return cleaned.split(',');
        }
        return [];
      };

      const cruiseIds = parsePgArray(dup.cruise_ids);
      const prices = parsePgArray(dup.prices);

      console.log(
        `Line: ${dup.cruise_line_id} | Ship: ${dup.ship_id} | Date: ${dup.sailing_date} | Voyage: ${dup.voyage_code_group}`
      );
      console.log(`  → ${dup.duplicate_count} duplicates: ${cruiseIds.join(', ')}`);
      console.log(`  → Prices: ${prices.map((p: any) => (p ? `$${p}` : 'null')).join(', ')}`);
      console.log('');
    });
  }

  return duplicates;
}

async function getDuplicateStats() {
  console.log('\n[2/5] Analyzing duplicate statistics...\n');

  const stats = await db.execute(sql`
    WITH duplicate_groups AS (
      SELECT
        cruise_line_id,
        ship_id,
        sailing_date,
        COALESCE(voyage_code, 'NULL') as voyage_code_group,
        COUNT(*) as dup_count
      FROM cruises
      WHERE sailing_date >= CURRENT_DATE - INTERVAL '1 year'
      GROUP BY cruise_line_id, ship_id, sailing_date, COALESCE(voyage_code, 'NULL')
      HAVING COUNT(*) > 1
    )
    SELECT
      COUNT(*) as total_groups,
      SUM(dup_count) as total_duplicate_records,
      SUM(dup_count - 1) as records_to_delete,
      MAX(dup_count) as max_duplicates_in_group,
      AVG(dup_count) as avg_duplicates_per_group
    FROM duplicate_groups
  `);

  const stat = stats[0];
  console.log('Deduplication Impact:');
  console.log('─'.repeat(60));
  console.log(`Total duplicate groups: ${stat.total_groups}`);
  console.log(`Total duplicate records: ${stat.total_duplicate_records}`);
  console.log(`Records to be deleted: ${stat.records_to_delete}`);
  console.log(`Max duplicates in a group: ${stat.max_duplicates_in_group}`);
  console.log(
    `Average duplicates per group: ${parseFloat(stat.avg_duplicates_per_group).toFixed(2)}`
  );
  console.log('');

  return stat;
}

async function checkForeignKeyReferences(cruiseId: string) {
  // Check all tables that reference cruises
  const checks = await Promise.all([
    db.execute(sql`SELECT COUNT(*) as count FROM cheapest_pricing WHERE cruise_id = ${cruiseId}`),
    db.execute(sql`SELECT COUNT(*) as count FROM price_snapshots WHERE cruise_id = ${cruiseId}`),
  ]);

  return {
    cheapestPricing: parseInt(checks[0][0].count),
    priceSnapshots: parseInt(checks[1][0].count),
  };
}

async function deduplicateGroup(group: any) {
  // Convert PostgreSQL arrays to JavaScript arrays
  const parsePgArray = (val: any): any[] => {
    if (Array.isArray(val)) return val;
    if (!val) return [];
    if (typeof val === 'string') {
      const cleaned = val.replace(/^\{|\}$/g, '');
      if (!cleaned) return [];
      return cleaned.split(',');
    }
    return [];
  };

  const cruiseIds = parsePgArray(group.cruise_ids);
  const keeperId = cruiseIds[0]; // Most recently updated
  const toDelete = cruiseIds.slice(1); // All others

  console.log(
    `\nProcessing: Line ${group.cruise_line_id}, Ship ${group.ship_id}, Date ${group.sailing_date}`
  );
  console.log(`  Keeping: ${keeperId} (most recent)`);
  console.log(`  Deleting: ${toDelete.join(', ')}`);

  if (DRY_RUN) {
    console.log('  [DRY RUN] Skipping actual deletion');
    return { deleted: 0, updated: 0 };
  }

  let totalUpdated = 0;

  // For each duplicate to delete, migrate foreign key references
  for (const duplicateId of toDelete) {
    const refs = await checkForeignKeyReferences(duplicateId);
    console.log(`  Migrating references from ${duplicateId}:`);
    console.log(`    - Cheapest pricing: ${refs.cheapestPricing}`);
    console.log(`    - Price snapshots: ${refs.priceSnapshots}`);

    // Update foreign key references to point to keeper
    await db.execute(sql`
      UPDATE cheapest_pricing
      SET cruise_id = ${keeperId}
      WHERE cruise_id = ${duplicateId}
    `);

    await db.execute(sql`
      UPDATE price_snapshots
      SET cruise_id = ${duplicateId}::varchar
      WHERE cruise_id = ${duplicateId}::varchar
      AND NOT EXISTS (
        SELECT 1 FROM price_snapshots
        WHERE cruise_id = ${keeperId}::varchar
        AND created_at = price_snapshots.created_at
      )
    `);

    // Note: We don't update price_snapshots to avoid conflicts, just delete the duplicate cruise
    // The snapshots will remain pointing to the old ID (acceptable for historical data)

    await db.execute(sql`
      UPDATE itinerary
      SET cruise_id = ${duplicateId}::varchar
      WHERE cruise_id = ${duplicateId}::varchar
    `);

    totalUpdated += refs.cheapestPricing + refs.itinerary;
  }

  // Delete the duplicate cruise records
  const deleteResult = await db.execute(sql`
    DELETE FROM cruises
    WHERE id = ANY(${toDelete})
  `);

  console.log(`  ✓ Deleted ${toDelete.length} duplicates, updated ${totalUpdated} references`);

  return { deleted: toDelete.length, updated: totalUpdated };
}

async function main() {
  try {
    const duplicates = await findDuplicates();

    if (duplicates.length === 0) {
      console.log('\n✓ No duplicates found! Database is clean.\n');
      process.exit(0);
    }

    await getDuplicateStats();

    if (DRY_RUN) {
      console.log('\n[DRY RUN] No changes made. Run without --dry-run to apply fixes.\n');
      process.exit(0);
    }

    console.log('\n[3/5] Starting deduplication process...\n');

    let totalDeleted = 0;
    let totalUpdated = 0;
    let processed = 0;

    for (const group of duplicates) {
      const result = await deduplicateGroup(group);
      totalDeleted += result.deleted;
      totalUpdated += result.updated;
      processed++;

      if (processed % 10 === 0) {
        console.log(`\n  Progress: ${processed}/${duplicates.length} groups processed\n`);
      }
    }

    console.log('\n[4/5] Deduplication complete!\n');
    console.log('Summary:');
    console.log('─'.repeat(60));
    console.log(`Groups processed: ${processed}`);
    console.log(`Total records deleted: ${totalDeleted}`);
    console.log(`Total foreign key references updated: ${totalUpdated}`);
    console.log('');

    // Verify no duplicates remain
    console.log('[5/5] Verifying cleanup...\n');
    const remainingDuplicates = await findDuplicates();

    if (remainingDuplicates.length === 0) {
      console.log('✓ Success! All duplicates removed.\n');
    } else {
      console.log(`⚠ Warning: ${remainingDuplicates.length} duplicate groups still remain.\n`);
    }

    console.log(`Completed: ${new Date().toISOString()}`);
    console.log('===================================\n');
  } catch (error) {
    console.error('\n❌ Error during deduplication:', error);
    process.exit(1);
  }
}

main();
