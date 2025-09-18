require('dotenv').config();
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { sql } = require('drizzle-orm');

const dbUrl = process.env.DATABASE_URL;
const sqlClient = postgres(dbUrl, {
  ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
});
const db = drizzle(sqlClient);

async function checkNCLPriceIssue() {
  console.log('Checking NCL price data issue...\n');

  try {
    // Check NCL December cruises with cheapest_price but missing cabin prices
    const result = await db.execute(sql`
      SELECT
        c.id,
        c.cruise_id,
        c.name,
        c.sailing_date,
        c.cheapest_price,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        jsonb_typeof(c.raw_data) as raw_data_type,
        CASE
          WHEN c.raw_data IS NOT NULL THEN
            jsonb_typeof(c.raw_data -> 'cheapestinside')
          ELSE NULL
        END as cheapestinside_type,
        c.raw_data -> 'cheapestinside' as raw_cheapestinside,
        c.raw_data -> 'cheapestoutside' as raw_cheapestoutside,
        c.raw_data -> 'cheapestbalcony' as raw_cheapestbalcony,
        c.raw_data -> 'cheapestsuite' as raw_cheapestsuite
      FROM cruises c
      WHERE c.cruise_line_id = 17
        AND c.sailing_date >= '2025-12-01'
        AND c.sailing_date <= '2025-12-31'
        AND c.is_active = true
        AND c.cheapest_price IS NOT NULL
        AND c.cheapest_price > 99
        AND (
          c.interior_price IS NULL
          AND c.oceanview_price IS NULL
          AND c.balcony_price IS NULL
          AND c.suite_price IS NULL
        )
      LIMIT 5
    `);

    console.log('NCL cruises with cheapest_price but NO cabin prices:');
    console.log('=====================================================');
    console.log(`Found ${result.length} affected cruises\n`);

    result.forEach((cruise, i) => {
      console.log(`${i + 1}. ${cruise.name} (ID: ${cruise.id})`);
      console.log(`   Cruise ID: ${cruise.cruise_id}`);
      console.log(`   Sailing: ${cruise.sailing_date}`);
      console.log(`   cheapest_price: $${cruise.cheapest_price}`);
      console.log(`   Cabin prices: ALL NULL`);
      console.log(`   Raw data type: ${cruise.raw_data_type}`);
      console.log(`   Raw cheapestinside: ${cruise.raw_cheapestinside}`);
      console.log(`   Raw cheapestoutside: ${cruise.raw_cheapestoutside}`);
      console.log(`   Raw cheapestbalcony: ${cruise.raw_cheapestbalcony}`);
      console.log(`   Raw cheapestsuite: ${cruise.raw_cheapestsuite}`);
      console.log('');
    });

    // Count total affected cruises
    const countResult = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN c.cheapest_price IS NOT NULL THEN 1 END) as with_cheapest,
        COUNT(CASE WHEN c.interior_price IS NULL AND c.oceanview_price IS NULL
                    AND c.balcony_price IS NULL AND c.suite_price IS NULL THEN 1 END) as no_cabin_prices
      FROM cruises c
      WHERE c.cruise_line_id = 17
        AND c.sailing_date >= '2025-12-01'
        AND c.sailing_date <= '2025-12-31'
        AND c.is_active = true
    `);

    console.log('\nSummary for NCL December 2025:');
    console.log('===============================');
    console.log(`Total cruises: ${countResult[0].total}`);
    console.log(`With cheapest_price: ${countResult[0].with_cheapest}`);
    console.log(`Missing ALL cabin prices: ${countResult[0].no_cabin_prices}`);

    // Check if this affects other cruise lines
    const otherLinesResult = await db.execute(sql`
      SELECT
        cl.name as cruise_line,
        COUNT(*) as total_cruises,
        COUNT(CASE WHEN c.cheapest_price IS NOT NULL AND c.cheapest_price > 99
                    AND c.interior_price IS NULL AND c.oceanview_price IS NULL
                    AND c.balcony_price IS NULL AND c.suite_price IS NULL THEN 1 END) as affected
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.sailing_date >= '2025-12-01'
        AND c.sailing_date <= '2025-12-31'
        AND c.is_active = true
      GROUP BY cl.id, cl.name
      HAVING COUNT(CASE WHEN c.cheapest_price IS NOT NULL AND c.cheapest_price > 99
                         AND c.interior_price IS NULL AND c.oceanview_price IS NULL
                         AND c.balcony_price IS NULL AND c.suite_price IS NULL THEN 1 END) > 0
      ORDER BY affected DESC
    `);

    console.log('\nCruise lines affected by missing cabin prices:');
    console.log('===============================================');
    otherLinesResult.forEach(line => {
      console.log(`${line.cruise_line}: ${line.affected}/${line.total_cruises} cruises affected`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await sqlClient.end();
  }
}

checkNCLPriceIssue();
