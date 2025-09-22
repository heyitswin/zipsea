/**
 * Diagnose why 63 cruises remain mismatched after sync
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
  console.log('=' .repeat(80));
  console.log('DIAGNOSING PERSISTENT SYNC MISMATCHES');
  console.log('=' .repeat(80));
  console.log();

  try {
    // Get the mismatched cruises
    const mismatched = await sql`
      SELECT
        c.id,
        c.name,
        c.cheapest_price::decimal as c_cheapest,
        c.interior_price::decimal as c_interior,
        c.oceanview_price::decimal as c_oceanview,
        c.balcony_price::decimal as c_balcony,
        c.suite_price::decimal as c_suite,
        cp.cheapest_price as cp_cheapest,
        cp.interior_price as cp_interior,
        cp.oceanview_price as cp_oceanview,
        cp.balcony_price as cp_balcony,
        cp.suite_price as cp_suite,
        cp.last_updated,
        c.updated_at as cruise_updated,
        pg_typeof(c.cheapest_price) as c_type,
        pg_typeof(cp.cheapest_price) as cp_type
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.is_active = true
      AND (
        ABS(COALESCE(c.cheapest_price::decimal, 0) - COALESCE(cp.cheapest_price, 0)) > 0.01
        OR ABS(COALESCE(c.interior_price::decimal, 0) - COALESCE(cp.interior_price, 0)) > 0.01
        OR ABS(COALESCE(c.oceanview_price::decimal, 0) - COALESCE(cp.oceanview_price, 0)) > 0.01
        OR ABS(COALESCE(c.balcony_price::decimal, 0) - COALESCE(cp.balcony_price, 0)) > 0.01
        OR ABS(COALESCE(c.suite_price::decimal, 0) - COALESCE(cp.suite_price, 0)) > 0.01
      )
      LIMIT 10
    `;

    console.log(`Found ${mismatched.length} mismatched cruises (showing first 10):\n`);

    for (const cruise of mismatched) {
      console.log(`Cruise ${cruise.id}: ${cruise.name}`);
      console.log('  Data types:');
      console.log(`    Cruises table type: ${cruise.c_type}`);
      console.log(`    Cheapest_pricing type: ${cruise.cp_type}`);
      console.log('  Values comparison:');

      // Compare each price field
      const fields = ['cheapest', 'interior', 'oceanview', 'balcony', 'suite'];
      for (const field of fields) {
        const cVal = cruise[`c_${field}`];
        const cpVal = cruise[`cp_${field}`];

        if (cVal !== null || cpVal !== null) {
          const diff = Math.abs((cVal || 0) - (cpVal || 0));
          const match = diff <= 0.01 ? '✅' : '❌';
          console.log(`    ${field.padEnd(10)}: cruises=$${cVal || 'null'} vs cp=$${cpVal || 'null'} ${match} (diff: $${diff.toFixed(2)})`);
        }
      }

      console.log('  Update times:');
      console.log(`    Cruise updated: ${cruise.cruise_updated}`);
      console.log(`    CP last updated: ${cruise.last_updated}`);
      console.log();
    }

    // Check if it's a TEXT vs NUMERIC issue
    console.log('Checking column data types in schema...\n');
    const schemaInfo = await sql`
      SELECT
        table_name,
        column_name,
        data_type,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns
      WHERE table_name IN ('cruises', 'cheapest_pricing')
      AND column_name IN ('cheapest_price', 'interior_price', 'oceanview_price', 'balcony_price', 'suite_price')
      ORDER BY table_name, column_name
    `;

    console.log('Column types:');
    for (const col of schemaInfo) {
      console.log(`  ${col.table_name}.${col.column_name}: ${col.data_type}(${col.numeric_precision || ''},${col.numeric_scale || ''})`);
    }

    // Check if cruises table has text type that needs conversion
    console.log('\n' + '=' .repeat(80));
    console.log('DIAGNOSIS:');
    console.log('=' .repeat(80));

    const cruisesTextColumns = schemaInfo.filter(s => s.table_name === 'cruises' && s.data_type === 'text');
    const cpNumericColumns = schemaInfo.filter(s => s.table_name === 'cheapest_pricing' && s.data_type === 'numeric');

    if (cruisesTextColumns.length > 0 && cpNumericColumns.length > 0) {
      console.log('❌ DATA TYPE MISMATCH DETECTED:');
      console.log('  - Cruises table stores prices as TEXT');
      console.log('  - Cheapest_pricing table stores prices as NUMERIC');
      console.log('  - This causes comparison issues even after sync');
      console.log('\n  Solution: Update query to cast both to same type for comparison');
    } else {
      console.log('⚠️  No obvious data type mismatch found');
      console.log('  The issue might be:');
      console.log('  - Floating point precision differences');
      console.log('  - NULL handling differences');
      console.log('  - Timing issue (cruises updated after sync)');
    }

    // Try a manual update on one cruise to see if it sticks
    if (mismatched.length > 0) {
      const testId = mismatched[0].id;
      console.log(`\nTesting manual update on cruise ${testId}...`);

      // Get current values
      const before = await sql`
        SELECT
          c.cheapest_price::decimal as c_price,
          cp.cheapest_price as cp_price
        FROM cruises c
        LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
        WHERE c.id = ${testId}
      `;

      console.log(`  Before: cruises=$${before[0].c_price}, cp=$${before[0].cp_price}`);

      // Force update
      await sql`
        UPDATE cheapest_pricing
        SET cheapest_price = (
          SELECT cheapest_price::decimal
          FROM cruises
          WHERE id = ${testId}
        )
        WHERE cruise_id = ${testId}
      `;

      // Check after
      const after = await sql`
        SELECT
          c.cheapest_price::decimal as c_price,
          cp.cheapest_price as cp_price
        FROM cruises c
        LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
        WHERE c.id = ${testId}
      `;

      console.log(`  After:  cruises=$${after[0].c_price}, cp=$${after[0].cp_price}`);

      if (Math.abs((after[0].c_price || 0) - (after[0].cp_price || 0)) > 0.01) {
        console.log('  ❌ Still mismatched after force update!');
      } else {
        console.log('  ✅ Manual update worked!');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
