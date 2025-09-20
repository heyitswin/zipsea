const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
  query_timeout: 60000
});

async function checkAndFixCorrupted() {
  console.log('🔍 Checking for corrupted raw_data...\n');

  try {
    // Quick check for corrupted data pattern
    console.log('Checking for corrupted records (character-by-character storage)...');

    const checkResult = await pool.query(`
      SELECT
        c.id,
        c.cruise_id,
        cl.name as cruise_line_name,
        LENGTH(c.raw_data::text) as json_length,
        c.updated_at
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.raw_data IS NOT NULL
        AND c.raw_data::text LIKE '%"0":%'
        AND c.raw_data::text LIKE '%"1":%'
        AND c.raw_data::text LIKE '%"2":%'
        AND c.raw_data::text LIKE '%"3":%'
        AND c.raw_data::text LIKE '%"4":%'
      LIMIT 10
    `);

    if (checkResult.rows.length === 0) {
      console.log('✅ No corrupted records found! All raw_data appears to be valid JSON.');

      // Run final validation
      console.log('\n📊 Running final validation across all cruise lines...\n');

      const validationResult = await pool.query(`
        SELECT
          cl.name as cruise_line,
          COUNT(c.id) as total_cruises,
          COUNT(cp.cruise_id) as with_prices,
          COUNT(CASE WHEN cp.interior_price IS NOT NULL OR
                          cp.oceanview_price IS NOT NULL OR
                          cp.balcony_price IS NOT NULL OR
                          cp.suite_price IS NOT NULL THEN 1 END) as with_any_price,
          AVG(CASE WHEN cp.interior_price IS NOT NULL THEN cp.interior_price END) as avg_interior,
          AVG(CASE WHEN cp.oceanview_price IS NOT NULL THEN cp.oceanview_price END) as avg_oceanview,
          AVG(CASE WHEN cp.balcony_price IS NOT NULL THEN cp.balcony_price END) as avg_balcony,
          AVG(CASE WHEN cp.suite_price IS NOT NULL THEN cp.suite_price END) as avg_suite
        FROM cruise_lines cl
        LEFT JOIN cruises c ON c.cruise_line_id = cl.id
        LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
        WHERE c.updated_at > CURRENT_DATE - INTERVAL '30 days'
        GROUP BY cl.id, cl.name
        HAVING COUNT(c.id) > 0
        ORDER BY cl.name
      `);

      console.log('Cruise Line Price Coverage Report:');
      console.log('=' .repeat(80));

      let totalCruises = 0;
      let cruisesWithPrices = 0;

      for (const row of validationResult.rows) {
        const coverage = row.with_any_price > 0 ?
          ((row.with_any_price / row.total_cruises) * 100).toFixed(1) : '0.0';

        totalCruises += parseInt(row.total_cruises);
        cruisesWithPrices += parseInt(row.with_any_price);

        console.log(`${row.cruise_line.padEnd(30)} | Cruises: ${row.total_cruises.toString().padStart(4)} | Coverage: ${coverage.padStart(5)}%`);

        if (parseFloat(coverage) < 90) {
          console.log(`  ⚠️  Low coverage - may need investigation`);
        }
      }

      const overallCoverage = totalCruises > 0 ?
        ((cruisesWithPrices / totalCruises) * 100).toFixed(1) : '0.0';

      console.log('=' .repeat(80));
      console.log(`TOTAL: ${totalCruises} cruises | Overall Coverage: ${overallCoverage}%`);

      if (parseFloat(overallCoverage) >= 90) {
        console.log('\n✨ EXCELLENT! Overall price coverage is above 90%!');
      } else {
        console.log('\n📈 Price coverage could be improved. Consider investigating cruise lines with low coverage.');
      }

    } else {
      console.log(`\n⚠️  Found ${checkResult.rows.length} corrupted records:`);

      for (const row of checkResult.rows) {
        console.log(`  - ${row.cruise_line_name}: Cruise ${row.cruise_id} (JSON length: ${row.json_length} chars)`);
      }

      console.log('\n❌ There are still corrupted records in the database.');
      console.log('These need to be fixed before running the final validation.');
      console.log('\nTo fix these, you may need to:');
      console.log('1. Run a more aggressive fix script');
      console.log('2. Manually investigate specific cruise lines');
      console.log('3. Consider re-syncing data from the source');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === '57014') {
      console.log('Query timeout - the database may have too many records to process at once.');
    }
  } finally {
    await pool.end();
  }
}

checkAndFixCorrupted();
