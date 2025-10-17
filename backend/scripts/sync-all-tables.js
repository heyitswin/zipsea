#!/usr/bin/env node
/**
 * Sync all cruise-related tables from production to staging
 * Handles dependencies in correct order
 */

const { Client } = require('pg');
require('dotenv').config();

// Tables in dependency order
const TABLES = ['cruise_lines', 'ships', 'ports', 'regions', 'cruises', 'itineraries'];

async function syncAllTables() {
  console.log('🚀 Full Multi-Table Sync Starting...\n');

  const prod = new Client({
    connectionString: process.env.DATABASE_URL_PRODUCTION ||
      'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db',
    ssl: { rejectUnauthorized: false },
  });

  const staging = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔌 Connecting...');
    await Promise.all([prod.connect(), staging.connect()]);
    console.log('✅ Connected\n');

    for (const table of TABLES) {
      console.log(`\n📋 Syncing: ${table}`);
      console.log('='.repeat(50));

      // Get common columns
      const { rows: prodCols } = await prod.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = $1 ORDER BY ordinal_position
      `, [table]);

      const { rows: stagingCols } = await staging.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = $1 ORDER BY ordinal_position
      `, [table]);

      if (prodCols.length === 0 || stagingCols.length === 0) {
        console.log('⚠️  Table not found, skipping');
        continue;
      }

      const stagingColSet = new Set(stagingCols.map(c => c.column_name));
      const commonCols = prodCols
        .map(c => c.column_name)
        .filter(c => stagingColSet.has(c));

      console.log(`📋 ${commonCols.length} common columns`);

      // Get count
      const { rows: [{ count: prodCount }] } = await prod.query(`SELECT COUNT(*)::int as count FROM ${table}`);
      console.log(`📊 ${prodCount} rows in production`);

      if (prodCount === 0) {
        console.log('✅ Empty table');
        continue;
      }

      // Truncate staging
      await staging.query(`TRUNCATE TABLE ${table} CASCADE`);

      // Copy in batches
      const batchSize = table === 'cruises' ? 100 : 500;
      let offset = 0;
      let total = 0;

      while (offset < prodCount) {
        const { rows } = await prod.query(`
          SELECT ${commonCols.map(c => `"${c}"`).join(', ')}
          FROM ${table}
          ORDER BY id
          LIMIT $1 OFFSET $2
        `, [batchSize, offset]);

        if (rows.length === 0) break;

        // Bulk insert
        for (const row of rows) {
          const values = commonCols.map(col => row[col]);
          const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

          await staging.query(`
            INSERT INTO ${table} (${commonCols.map(c => `"${c}"`).join(', ')})
            VALUES (${placeholders})
            ON CONFLICT (id) DO NOTHING
          `, values);

          total++;
        }

        offset += batchSize;
        const percent = ((total / prodCount) * 100).toFixed(1);
        process.stdout.write(`\r✅ ${total}/${prodCount} (${percent}%)`);
      }

      console.log(`\n✅ Synced ${total} rows`);
    }

    // Final verification
    console.log('\n\n📊 Final Verification:');
    console.log('='.repeat(50));

    for (const table of TABLES) {
      const { rows: [{ count }] } = await staging.query(`SELECT COUNT(*)::int as count FROM ${table}`);
      console.log(`  ${table}: ${count} rows`);
    }

    const { rows: [{ count: withPrices }] } = await staging.query(`
      SELECT COUNT(*)::int as count
      FROM cruises
      WHERE cheapest_price IS NOT NULL AND cheapest_price > 99
    `);
    console.log(`  cruises with prices: ${withPrices}`);

    console.log('\n✅ SYNC COMPLETE!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await prod.end();
    await staging.end();
  }
}

syncAllTables().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
