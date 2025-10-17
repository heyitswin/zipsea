#!/usr/bin/env node
/**
 * Quick sync - copy only pricing columns from production to staging
 */

const postgres = require('postgres');
require('dotenv').config();

async function syncPricing() {
  // On Render staging, DATABASE_URL is staging, we need to provide production URL
  const prodUrl =
    process.env.DATABASE_URL_PRODUCTION ||
    'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';
  const stagingUrl = process.env.DATABASE_URL_STAGING || process.env.DATABASE_URL;

  if (!prodUrl || !stagingUrl) {
    console.error('❌ Missing DATABASE_URL');
    console.error('Production URL:', prodUrl ? '✓' : '✗');
    console.error('Staging URL:', stagingUrl ? '✓' : '✗');
    process.exit(1);
  }

  console.log('🔗 Production: dpg-d2idqjjipnbc73abma3g-a');
  console.log(
    '🔗 Staging:',
    stagingUrl.includes('d2ii4d1r0fns738hchag')
      ? '✓ dpg-d2ii4d1r0fns738hchag-a'
      : stagingUrl.substring(0, 50)
  );

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
      // Get batch from production - simple query with ORDER BY for consistent pagination
      const batch = await prod`
        SELECT id, interior_price, oceanview_price, balcony_price, suite_price, cheapest_price
        FROM cruises
        ORDER BY id
        LIMIT ${batchSize} OFFSET ${updated}
      `;

      if (batch.length === 0) break;

      // Bulk update using transaction
      await staging.begin(async sql => {
        for (const cruise of batch) {
          if (!cruise.id) continue;

          await sql`
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
      });

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
