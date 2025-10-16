#!/usr/bin/env node

/**
 * Simple Production to Staging Cruise Data Sync
 *
 * Copies only cruise-related core tables from production to staging
 * Focuses on reliability over performance
 */

const postgres = require('postgres');
require('dotenv').config();

// Core cruise tables only - in dependency order
const TABLES = [
  'cruise_lines',
  'ships',
  'ports',
  'regions',
  'cruises',
  'itineraries',
  'cabin_categories',
];

async function main() {
  const prodUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
  const stagingUrl = process.env.DATABASE_URL_STAGING;

  if (!prodUrl || !stagingUrl) {
    console.error('❌ Missing DATABASE_URL_PRODUCTION or DATABASE_URL_STAGING');
    process.exit(1);
  }

  const prod = postgres(prodUrl, { max: 2, ssl: 'require' });
  const staging = postgres(stagingUrl, { max: 2, ssl: 'require' });

  console.log('🚀 Starting cruise data sync: Production → Staging');
  console.log('📋 Tables:', TABLES.join(', '));

  const stats = { succeeded: [], failed: [], totalRows: 0 };

  try {
    for (const table of TABLES) {
      console.log(`\n🔄 Syncing: ${table}`);

      try {
        // Get common columns
        console.log(`  🔍 Fetching production columns...`);
        const prodCols = await prod`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = ${table} ORDER BY ordinal_position
        `;
        console.log(`  🔍 Fetching staging columns...`);
        const stagingCols = await staging`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = ${table} ORDER BY ordinal_position
        `;

        const prodSet = new Set(prodCols.map(c => c.column_name));
        const stagingSet = new Set(stagingCols.map(c => c.column_name));
        const common = prodCols.map(c => c.column_name).filter(c => stagingSet.has(c));

        if (common.length === 0) {
          console.log('  ⚠️  No common columns, skipping');
          continue;
        }

        console.log(`  📋 ${common.length} columns`);

        // Get row count
        const [{ count: prodCount }] = await prod.unsafe(
          `SELECT COUNT(*)::int as count FROM ${table}`
        );
        console.log(`  📊 ${prodCount} rows in production`);

        if (prodCount === 0) {
          console.log('  ✅ Empty table, nothing to sync');
          stats.succeeded.push(table);
          continue;
        }

        // Clear staging table
        await staging.unsafe(`TRUNCATE TABLE ${table} CASCADE`);

        // Stream rows in batches directly from production to staging
        const batchSize = 500;
        let inserted = 0;
        let offset = 0;

        console.log(`  🔄 Starting batch sync...`);

        while (true) {
          const batch = await prod.unsafe(
            `SELECT ${common.map(c => `"${c}"`).join(', ')} FROM ${table} LIMIT ${batchSize} OFFSET ${offset}`
          );

          if (batch.length === 0) break;

          try {
            await staging`INSERT INTO ${staging(table)} ${staging(batch, ...common)}`;
            inserted += batch.length;
          } catch (err) {
            // Try row-by-row if batch fails
            for (const row of batch) {
              try {
                await staging`INSERT INTO ${staging(table)} ${staging([row], ...common)}`;
                inserted++;
              } catch (rowErr) {
                console.log(`    ⚠️  Row skipped: ${rowErr.message.substring(0, 80)}`);
              }
            }
          }

          if (inserted % 5000 === 0) {
            console.log(`    ... ${inserted} rows inserted`);
          }

          offset += batchSize;
          if (batch.length < batchSize) break; // Last batch
        }

        // Reset sequences
        const seqs = await staging`
          SELECT column_name, column_default
          FROM information_schema.columns
          WHERE table_name = ${table} AND column_default LIKE 'nextval%'
        `;

        for (const { column_name, column_default } of seqs) {
          const seqName = column_default.match(/nextval\('(.+?)'/)?.[1];
          if (seqName) {
            await staging.unsafe(`
              SELECT setval(
                '${seqName}'::regclass,
                COALESCE((SELECT MAX("${column_name}") FROM ${table}), 1)
              )
            `);
          }
        }

        console.log(`  ✅ Synced ${inserted} rows`);
        stats.succeeded.push(table);
        stats.totalRows += inserted;
      } catch (err) {
        console.error(`  ❌ Failed: ${err.message}`);
        stats.failed.push(table);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log(`  ✅ Succeeded: ${stats.succeeded.length} tables`);
    console.log(`  ❌ Failed: ${stats.failed.length} tables`);
    console.log(`  📝 Total rows: ${stats.totalRows.toLocaleString()}`);

    if (stats.failed.length > 0) {
      console.log(`  ❌ Failed tables: ${stats.failed.join(', ')}`);
      process.exit(1);
    }

    console.log('\n✅ Sync complete!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  } finally {
    await prod.end();
    await staging.end();
  }
}

main();
