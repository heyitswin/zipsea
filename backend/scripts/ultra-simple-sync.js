#!/usr/bin/env node
/**
 * Ultra-simple sync - minimal dependencies, just copy data
 * Run on Render staging: node scripts/ultra-simple-sync.js
 */

const { Client } = require('pg');
require('dotenv').config();

async function ultraSimpleSync() {
  console.log('🚀 Ultra-Simple Sync Starting...\n');

  // Production connection
  const prod = new Client({
    connectionString:
      process.env.DATABASE_URL_PRODUCTION ||
      'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  // Staging connection
  const staging = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔌 Connecting to databases...');
    await Promise.all([prod.connect(), staging.connect()]);
    console.log('✅ Connected\n');

    // Get count
    const {
      rows: [{ count: prodCount }],
    } = await prod.query('SELECT COUNT(*)::int as count FROM cruises');
    console.log(`📊 Production: ${prodCount} cruises\n`);

    // Truncate staging
    console.log('🗑️  Truncating staging...');
    await staging.query('TRUNCATE TABLE cruises CASCADE');
    console.log('✅ Truncated\n');

    // Copy in small batches
    const batchSize = 100; // Smaller batches
    let offset = 0;
    let total = 0;

    // Get common columns
    console.log('🔍 Finding common columns...');
    const { rows: prodCols } = await prod.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'cruises' ORDER BY ordinal_position
    `);
    const { rows: stagingCols } = await staging.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'cruises' ORDER BY ordinal_position
    `);

    const stagingColSet = new Set(stagingCols.map(c => c.column_name));
    const commonCols = prodCols.map(c => c.column_name).filter(c => stagingColSet.has(c));

    console.log(`✅ Found ${commonCols.length} common columns\n`);

    console.log('🔄 Copying data...\n');

    while (offset < prodCount) {
      // Fetch batch - only common columns
      const { rows } = await prod.query(
        `
        SELECT ${commonCols.map(c => `"${c}"`).join(', ')}
        FROM cruises
        ORDER BY id
        LIMIT $1 OFFSET $2
      `,
        [batchSize, offset]
      );

      if (rows.length === 0) break;

      // Insert one by one (slower but more reliable)
      for (const row of rows) {
        const values = commonCols.map(col => row[col]);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

        await staging.query(
          `
          INSERT INTO cruises (${commonCols.map(c => `"${c}"`).join(', ')})
          VALUES (${placeholders})
          ON CONFLICT (id) DO NOTHING
        `,
          values
        );

        total++;
      }

      offset += batchSize;
      const percent = ((total / prodCount) * 100).toFixed(1);
      console.log(`✅ ${total}/${prodCount} (${percent}%)`);
    }

    // Verify
    const {
      rows: [{ count: stagingCount }],
    } = await staging.query('SELECT COUNT(*)::int as count FROM cruises');
    const {
      rows: [{ count: withPrices }],
    } = await staging.query(`
      SELECT COUNT(*)::int as count
      FROM cruises
      WHERE cheapest_price IS NOT NULL AND cheapest_price > 99
    `);

    console.log('\n📊 Results:');
    console.log(`  Staging: ${stagingCount} cruises`);
    console.log(`  With prices: ${withPrices}`);
    console.log(stagingCount > 0 ? '\n✅ SUCCESS!' : '\n❌ FAILED');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await prod.end();
    await staging.end();
  }
}

ultraSimpleSync().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
