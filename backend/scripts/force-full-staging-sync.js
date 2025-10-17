#!/usr/bin/env node
/**
 * Force full sync - truncate staging cruises and copy ALL from production
 * Run this from Render staging shell
 */

const postgres = require('postgres');
require('dotenv').config();

async function forceFullSync() {
  const prodUrl = process.env.DATABASE_URL_PRODUCTION || 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';
  const stagingUrl = process.env.DATABASE_URL;

  console.log('🚀 Force Full Sync: Production → Staging (cruises table)');
  console.log('⚠️  This will TRUNCATE staging cruises and copy all from production\n');

  const prod = postgres(prodUrl, { max: 5, ssl: 'require', idle_timeout: 20, connect_timeout: 10 });
  const staging = postgres(stagingUrl, { max: 5, ssl: 'require', idle_timeout: 20, connect_timeout: 10 });

  try {
    // Get production count
    const [{ prodCount }] = await prod`SELECT COUNT(*)::int as prodCount FROM cruises`;
    console.log(`📊 Production: ${prodCount} cruises`);

    // Truncate staging
    console.log('🗑️  Truncating staging cruises...');
    await staging`TRUNCATE TABLE cruises CASCADE`;
    console.log('✅ Truncated\n');

    // Copy in batches
    const batchSize = 500;
    let copied = 0;

    console.log('🔄 Copying data in batches...\n');

    while (copied < prodCount) {
      const batch = await prod`
        SELECT * FROM cruises
        ORDER BY id
        LIMIT ${batchSize} OFFSET ${copied}
      `;

      if (batch.length === 0) break;

      // Insert batch
      await staging`INSERT INTO cruises ${staging(batch)}`;

      copied += batch.length;
      const percent = ((copied / prodCount) * 100).toFixed(1);
      console.log(`✅ ${copied}/${prodCount} (${percent}%)`);
    }

    // Verify
    const [{ stagingCount }] = await staging`SELECT COUNT(*)::int as stagingCount FROM cruises`;
    const [{ withPrices }] = await staging`
      SELECT COUNT(*)::int as withPrices
      FROM cruises
      WHERE cheapest_price IS NOT NULL AND cheapest_price > 99
    `;

    console.log('\n📊 Final Results:');
    console.log(`  Production: ${prodCount} cruises`);
    console.log(`  Staging:    ${stagingCount} cruises`);
    console.log(`  With prices: ${withPrices} cruises`);
    console.log(stagingCount === prodCount ? '\n✅ SUCCESS!' : '\n⚠️  Count mismatch!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prod.end();
    await staging.end();
  }
}

forceFullSync().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
