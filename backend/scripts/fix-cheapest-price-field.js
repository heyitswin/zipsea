const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixCheapestPriceField() {
  try {
    await client.connect();
    console.log('🔧 FIXING cheapest_price FIELD');
    console.log('=' + '='.repeat(70));
    console.log('');
    console.log('This field is required for search filters to work properly.');
    console.log('It should contain the minimum price across all cabin types.\n');

    // First, check how many records need fixing
    const checkResult = await client.query(`
      SELECT COUNT(*) as count
      FROM cheapest_pricing
      WHERE cheapest_price IS NULL
        AND (interior_price IS NOT NULL
          OR oceanview_price IS NOT NULL
          OR balcony_price IS NOT NULL
          OR suite_price IS NOT NULL)
    `);

    const needsFixing = parseInt(checkResult.rows[0].count);
    console.log(`Found ${needsFixing} records that need cheapest_price populated.\n`);

    if (needsFixing === 0) {
      console.log('✅ All records already have cheapest_price set!');
      await client.end();
      return;
    }

    // Update cheapest_price to be the minimum of all available prices
    console.log('Updating cheapest_price to minimum of all cabin prices...');

    const updateResult = await client.query(`
      UPDATE cheapest_pricing
      SET cheapest_price = LEAST(
        COALESCE(interior_price, 999999),
        COALESCE(oceanview_price, 999999),
        COALESCE(balcony_price, 999999),
        COALESCE(suite_price, 999999)
      )
      WHERE cheapest_price IS NULL
        AND (interior_price IS NOT NULL
          OR oceanview_price IS NOT NULL
          OR balcony_price IS NOT NULL
          OR suite_price IS NOT NULL)
        AND LEAST(
          COALESCE(interior_price, 999999),
          COALESCE(oceanview_price, 999999),
          COALESCE(balcony_price, 999999),
          COALESCE(suite_price, 999999)
        ) < 999999
    `);

    console.log(`✅ Updated ${updateResult.rowCount} records with cheapest_price\n`);

    // Also set cheapest_cabin_type based on which price is cheapest
    console.log('Setting cheapest_cabin_type field...');

    const cabinTypeResult = await client.query(`
      UPDATE cheapest_pricing
      SET cheapest_cabin_type =
        CASE
          WHEN cheapest_price = interior_price THEN 'interior'
          WHEN cheapest_price = oceanview_price THEN 'oceanview'
          WHEN cheapest_price = balcony_price THEN 'balcony'
          WHEN cheapest_price = suite_price THEN 'suite'
          ELSE cheapest_cabin_type
        END
      WHERE cheapest_cabin_type IS NULL
        AND cheapest_price IS NOT NULL
    `);

    console.log(`✅ Updated ${cabinTypeResult.rowCount} records with cheapest_cabin_type\n`);

    // Check NCL December specifically
    console.log('Checking NCL December 2025 status...');

    const nclCheck = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN cp.cheapest_price IS NOT NULL THEN 1 END) as has_cheapest,
        COUNT(CASE WHEN cp.cheapest_price IS NOT NULL AND cp.cheapest_price > 0 THEN 1 END) as has_valid_price,
        MIN(cp.cheapest_price) as min_price,
        MAX(cp.cheapest_price) as max_price
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.cruise_line_id = 17
        AND c.sailing_date >= '2025-12-01'
        AND c.sailing_date < '2026-01-01'
    `);

    console.log('NCL December 2025 Results:');
    console.log(`  Total cruises: ${nclCheck.rows[0].total}`);
    console.log(`  Has cheapest_price: ${nclCheck.rows[0].has_cheapest}`);
    console.log(`  Has valid price (>0): ${nclCheck.rows[0].has_valid_price}`);
    console.log(`  Price range: $${nclCheck.rows[0].min_price} - $${nclCheck.rows[0].max_price}\n`);

    // Final verification
    const finalCheck = await client.query(`
      SELECT
        COUNT(*) as total_records,
        COUNT(CASE WHEN cheapest_price IS NOT NULL THEN 1 END) as has_cheapest,
        COUNT(CASE WHEN cheapest_price IS NULL
                    AND (interior_price IS NOT NULL OR oceanview_price IS NOT NULL
                         OR balcony_price IS NOT NULL OR suite_price IS NOT NULL) THEN 1 END) as still_missing
      FROM cheapest_pricing
    `);

    console.log('=' + '='.repeat(70));
    console.log('✅ FINAL STATUS:');
    console.log(`  Total pricing records: ${finalCheck.rows[0].total_records}`);
    console.log(`  Has cheapest_price: ${finalCheck.rows[0].has_cheapest}`);
    console.log(`  Still missing: ${finalCheck.rows[0].still_missing}`);

    const coverage = Math.round((finalCheck.rows[0].has_cheapest / finalCheck.rows[0].total_records) * 100);
    console.log(`  Coverage: ${coverage}%`);

    console.log('\n🎉 FIX COMPLETE!');
    console.log('The search should now show all cruises with prices.');
    console.log('Remember to clear the API cache if needed.');

  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  } finally {
    await client.end();
    process.exit(0);
  }
}

// Run the fix
fixCheapestPriceField();
