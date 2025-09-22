/**
 * Fix NULL cheapest_price in cruises table
 * Calculate from existing cabin prices
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

async function main() {
  const args = process.argv.slice(2);
  const DRY_RUN = !args.includes('--execute');

  console.log('=' .repeat(80));
  console.log('FIX NULL CHEAPEST_PRICE IN CRUISES TABLE');
  console.log('=' .repeat(80));
  console.log('Mode:', DRY_RUN ? '🔍 DRY RUN' : '⚠️  EXECUTE MODE');
  console.log();

  try {
    // Find cruises with NULL cheapest_price but valid cabin prices
    console.log('Finding cruises with NULL cheapest_price...\n');

    const nullCheapest = await sql`
      SELECT
        id,
        name,
        interior_price::decimal as interior,
        oceanview_price::decimal as oceanview,
        balcony_price::decimal as balcony,
        suite_price::decimal as suite,
        cheapest_price::decimal as cheapest
      FROM cruises
      WHERE cheapest_price IS NULL
      AND (
        interior_price IS NOT NULL
        OR oceanview_price IS NOT NULL
        OR balcony_price IS NOT NULL
        OR suite_price IS NOT NULL
      )
      AND is_active = true
      ORDER BY id
    `;

    console.log(`Found ${nullCheapest.length} cruises with NULL cheapest_price\n`);

    if (nullCheapest.length === 0) {
      console.log('✅ No cruises need fixing!');
      return;
    }

    // Show examples
    console.log('Examples:');
    for (let i = 0; i < Math.min(5, nullCheapest.length); i++) {
      const cruise = nullCheapest[i];
      const prices = [cruise.interior, cruise.oceanview, cruise.balcony, cruise.suite]
        .filter(p => p !== null && p > 0);
      const calculatedCheapest = prices.length > 0 ? Math.min(...prices) : null;

      console.log(`  ${cruise.id}: ${cruise.name}`);
      console.log(`    Interior: $${cruise.interior || 'null'}`);
      console.log(`    Oceanview: $${cruise.oceanview || 'null'}`);
      console.log(`    Balcony: $${cruise.balcony || 'null'}`);
      console.log(`    Suite: $${cruise.suite || 'null'}`);
      console.log(`    Current cheapest: $${cruise.cheapest || 'null'}`);
      console.log(`    Should be: $${calculatedCheapest || 'null'}`);
      console.log();
    }

    if (!DRY_RUN) {
      console.log('FIXING...\n');

      let fixed = 0;
      let errors = 0;

      for (const cruise of nullCheapest) {
        try {
          // Calculate cheapest from cabin prices
          const prices = [cruise.interior, cruise.oceanview, cruise.balcony, cruise.suite]
            .filter(p => p !== null && p > 0);

          if (prices.length > 0) {
            const calculatedCheapest = Math.min(...prices);

            // Update cruises table
            await sql`
              UPDATE cruises
              SET cheapest_price = ${calculatedCheapest}
              WHERE id = ${cruise.id}
            `;

            fixed++;

            if (fixed <= 5) {
              console.log(`  Fixed ${cruise.id}: set cheapest_price to $${calculatedCheapest}`);
            }
          }
        } catch (error) {
          console.error(`  Error fixing cruise ${cruise.id}:`, error.message);
          errors++;
        }
      }

      console.log('\n' + '=' .repeat(80));
      console.log('COMPLETE');
      console.log('=' .repeat(80));
      console.log(`Total fixed: ${fixed}`);
      console.log(`Total errors: ${errors}`);

      // Verify
      console.log('\nVerifying...');
      const remaining = await sql`
        SELECT COUNT(*) as count
        FROM cruises
        WHERE cheapest_price IS NULL
        AND (
          interior_price IS NOT NULL
          OR oceanview_price IS NOT NULL
          OR balcony_price IS NOT NULL
          OR suite_price IS NOT NULL
        )
        AND is_active = true
      `;

      if (remaining[0].count === 0) {
        console.log('✅ SUCCESS: All NULL cheapest_price values have been fixed!');

        // Now check if sync is needed
        console.log('\nChecking if sync with cheapest_pricing is needed...');
        const needsSync = await sql`
          SELECT COUNT(*) as count
          FROM cruises c
          LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
          WHERE c.is_active = true
          AND ABS(COALESCE(c.cheapest_price::decimal, 0) - COALESCE(cp.cheapest_price, 0)) > 0.01
        `;

        if (needsSync[0].count > 0) {
          console.log(`⚠️  ${needsSync[0].count} cruises still need sync with cheapest_pricing table`);
          console.log('   Run: node scripts/sync-cheapest-pricing-fixed.js --execute');
        } else {
          console.log('✅ Tables are now in sync!');
        }
      } else {
        console.log(`⚠️  WARNING: ${remaining[0].count} cruises still have NULL cheapest_price`);
      }

    } else {
      console.log('\n' + '=' .repeat(80));
      console.log('DRY RUN SUMMARY');
      console.log('=' .repeat(80));
      console.log(`Would fix ${nullCheapest.length} cruises with NULL cheapest_price`);
      console.log('\nTo execute the fix, run:');
      console.log('  node scripts/fix-null-cheapest-price.js --execute');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
