/**
 * Fix the 8 specific cruises with price mismatches
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prodUrl = process.env.DATABASE_URL_PRODUCTION || 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';
const sql = postgres(prodUrl, { ssl: { rejectUnauthorized: false } });

// The 8 cruises with mismatches identified
const mismatches = [
  { id: '2164416', interior: 325, oceanview: 385, balcony: 385, suite: 735 },
  { id: '2167816', interior: 373.64, oceanview: 433.64, balcony: 493.64, suite: 873.64 },
  { id: '2167824', interior: 425.64, oceanview: 495.64, balcony: 565.64, suite: 985.64 },
  { id: '2167817', interior: 404.64, oceanview: 464.64, balcony: 524.64, suite: 804.64 },
  { id: '2167818', interior: 423.64, oceanview: 483.64, balcony: 533.64, suite: 958.64 },
  { id: '2164254', interior: null, oceanview: 680.6, balcony: 850.6, suite: null },
  { id: '2164423', interior: 326.65, oceanview: 406.65, balcony: 466.65, suite: 916.65 },
  { id: '2167825', interior: 445.64, oceanview: 515.64, balcony: 585.64, suite: null }
];

async function main() {
  const args = process.argv.slice(2);
  const EXECUTE = args.includes('--execute');

  console.log('=' .repeat(80));
  console.log('FIXING 8 CRUISES WITH PRICE MISMATCHES');
  console.log('=' .repeat(80));
  console.log('Mode:', EXECUTE ? '⚠️  EXECUTE MODE' : '🔍 DRY RUN');
  console.log();

  try {
    for (const fix of mismatches) {
      // Get current data
      const current = await sql`
        SELECT
          id, name,
          interior_price, oceanview_price, balcony_price, suite_price, cheapest_price,
          sailing_date
        FROM cruises
        WHERE id = ${fix.id}
      `;

      if (current.length === 0) {
        console.log(`❌ Cruise ${fix.id} not found`);
        continue;
      }

      const cruise = current[0];
      console.log(`\n${cruise.id}: ${cruise.name}`);
      console.log(`  Sailing: ${new Date(cruise.sailing_date).toISOString().split('T')[0]}`);
      console.log(`  Current prices: Interior=$${cruise.interior_price}, Ocean=$${cruise.oceanview_price}, Balcony=$${cruise.balcony_price}, Suite=$${cruise.suite_price}`);
      console.log(`  Correct prices: Interior=$${fix.interior || 'N/A'}, Ocean=$${fix.oceanview || 'N/A'}, Balcony=$${fix.balcony || 'N/A'}, Suite=$${fix.suite || 'N/A'}`);

      // Calculate new cheapest
      const prices = [fix.interior, fix.oceanview, fix.balcony, fix.suite].filter(p => p && p > 0);
      const newCheapest = prices.length > 0 ? Math.min(...prices) : null;

      console.log(`  New cheapest: $${newCheapest}`);

      if (EXECUTE) {
        await sql`
          UPDATE cruises
          SET
            interior_price = ${fix.interior?.toString() || null},
            oceanview_price = ${fix.oceanview?.toString() || null},
            balcony_price = ${fix.balcony?.toString() || null},
            suite_price = ${fix.suite?.toString() || null},
            cheapest_price = ${newCheapest?.toString()},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${fix.id}
        `;
        console.log(`  ✅ FIXED`);
      } else {
        console.log(`  Would update to correct prices`);
      }
    }

    console.log();
    console.log('=' .repeat(80));
    console.log('SUMMARY');
    console.log('=' .repeat(80));
    console.log(`${EXECUTE ? 'Fixed' : 'Would fix'} ${mismatches.length} cruises`);

    if (!EXECUTE) {
      console.log('\nRun with --execute to apply fixes');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
