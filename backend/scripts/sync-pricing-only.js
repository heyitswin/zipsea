#!/usr/bin/env node
/**
 * Quick sync - copy only pricing columns from production to staging
 */

const postgres = require('postgres');
require('dotenv').config();

async function syncPricing() {
  const prodUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
  const stagingUrl = process.env.DATABASE_URL_STAGING;

  if (!prodUrl || !stagingUrl) {
    console.error('❌ Missing DATABASE_URL');
    process.exit(1);
  }

  const prod = postgres(prodUrl, { max: 2, ssl: 'require' });
  const staging = postgres(stagingUrl, { max: 2, ssl: 'require' });

  console.log('🚀 Syncing pricing data: Production → Staging');

  try {
    // Get count
    const [{ count }] = await staging`SELECT COUNT(*)::int as count FROM cruises`;
    console.log(`📊 ${count} cruises in staging`);

    // Copy pricing in batches
    const batchSize = 1000;
    let updated = 0;

    console.log('🔄 Starting pricing sync...\n');

    while (true) {
      const batch = await prod`
        SELECT id, interior_price, oceanview_price, balcony_price, suite_price, cheapest_price
        FROM cruises
        WHERE id IN (
          SELECT id FROM cruises LIMIT ${batchSize} OFFSET ${updated}
        )
      `;

      if (batch.length === 0) break;

      // Update each cruise
      for (const cruise of batch) {
        await staging`
          UPDATE cruises
          SET
            interior_price = ${cruise.interior_price},
            oceanview_price = ${cruise.oceanview_price},
            balcony_price = ${cruise.balcony_price},
            suite_price = ${cruise.suite_price},
            cheapest_price = ${cruise.cheapest_price}
          WHERE id = ${cruise.id}
        `;
      }

      updated += batch.length;
      console.log(`✅ Updated ${updated} cruises...`);
    }

    console.log(`\n✅ Complete! Updated ${updated} cruises with pricing data`);

    // Verify
    const [{ withPrices }] = await staging`
      SELECT COUNT(*)::int as withPrices
      FROM cruises
      WHERE cheapest_price IS NOT NULL AND cheapest_price > 99
    `;
    console.log(`✅ ${withPrices} cruises now have valid pricing`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prod.end();
    await staging.end();
  }
}

syncPricing().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
