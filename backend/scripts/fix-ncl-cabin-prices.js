require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

async function fixNCLCabinPrices() {
  console.log('Fixing cabin prices for cruises with cheapest_price but missing individual prices...\n');

  try {
    // First, count affected cruises
    const countQuery = `
      SELECT COUNT(*) as total
      FROM cruises c
      WHERE c.cheapest_price IS NOT NULL
        AND c.cheapest_price > 99
        AND c.interior_price IS NULL
        AND c.oceanview_price IS NULL
        AND c.balcony_price IS NULL
        AND c.suite_price IS NULL
        AND c.raw_data IS NOT NULL
        AND c.is_active = true
    `;

    const countResult = await pool.query(countQuery);
    console.log(`Found ${countResult.rows[0].total} cruises to fix\n`);

    // Fix cabin prices from raw_data
    const updateQuery = `
      UPDATE cruises
      SET
        interior_price = CASE
          WHEN jsonb_typeof(raw_data -> 'cheapestinside') = 'string' THEN
            NULLIF((raw_data ->> 'cheapestinside')::numeric, 0)
          WHEN jsonb_typeof(raw_data -> 'cheapestinside') = 'number' THEN
            NULLIF((raw_data ->> 'cheapestinside')::numeric, 0)
          WHEN jsonb_typeof(raw_data -> 'cheapestinside') = 'object' AND raw_data -> 'cheapestinside' -> 'price' IS NOT NULL THEN
            NULLIF((raw_data -> 'cheapestinside' ->> 'price')::numeric, 0)
          ELSE NULL
        END,
        oceanview_price = CASE
          WHEN jsonb_typeof(raw_data -> 'cheapestoutside') = 'string' THEN
            NULLIF((raw_data ->> 'cheapestoutside')::numeric, 0)
          WHEN jsonb_typeof(raw_data -> 'cheapestoutside') = 'number' THEN
            NULLIF((raw_data ->> 'cheapestoutside')::numeric, 0)
          WHEN jsonb_typeof(raw_data -> 'cheapestoutside') = 'object' AND raw_data -> 'cheapestoutside' -> 'price' IS NOT NULL THEN
            NULLIF((raw_data -> 'cheapestoutside' ->> 'price')::numeric, 0)
          ELSE NULL
        END,
        balcony_price = CASE
          WHEN jsonb_typeof(raw_data -> 'cheapestbalcony') = 'string' THEN
            NULLIF((raw_data ->> 'cheapestbalcony')::numeric, 0)
          WHEN jsonb_typeof(raw_data -> 'cheapestbalcony') = 'number' THEN
            NULLIF((raw_data ->> 'cheapestbalcony')::numeric, 0)
          WHEN jsonb_typeof(raw_data -> 'cheapestbalcony') = 'object' AND raw_data -> 'cheapestbalcony' -> 'price' IS NOT NULL THEN
            NULLIF((raw_data -> 'cheapestbalcony' ->> 'price')::numeric, 0)
          ELSE NULL
        END,
        suite_price = CASE
          WHEN jsonb_typeof(raw_data -> 'cheapestsuite') = 'string' THEN
            NULLIF((raw_data ->> 'cheapestsuite')::numeric, 0)
          WHEN jsonb_typeof(raw_data -> 'cheapestsuite') = 'number' THEN
            NULLIF((raw_data ->> 'cheapestsuite')::numeric, 0)
          WHEN jsonb_typeof(raw_data -> 'cheapestsuite') = 'object' AND raw_data -> 'cheapestsuite' -> 'price' IS NOT NULL THEN
            NULLIF((raw_data -> 'cheapestsuite' ->> 'price')::numeric, 0)
          ELSE NULL
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE cheapest_price IS NOT NULL
        AND cheapest_price > 99
        AND interior_price IS NULL
        AND oceanview_price IS NULL
        AND balcony_price IS NULL
        AND suite_price IS NULL
        AND raw_data IS NOT NULL
        AND is_active = true
      RETURNING id, cruise_id, name, interior_price, oceanview_price, balcony_price, suite_price
    `;

    console.log('Updating cabin prices from raw_data...');
    console.time('Update');

    const result = await pool.query(updateQuery);
    console.timeEnd('Update');

    console.log(`\n✅ Successfully updated ${result.rows.length} cruises\n`);

    if (result.rows.length > 0) {
      console.log('Sample of fixed cruises:');
      console.log('========================');
      result.rows.slice(0, 5).forEach((cruise, i) => {
        console.log(`${i + 1}. ${cruise.name} (ID: ${cruise.id})`);
        console.log(`   Interior: $${cruise.interior_price || 'N/A'}`);
        console.log(`   Oceanview: $${cruise.oceanview_price || 'N/A'}`);
        console.log(`   Balcony: $${cruise.balcony_price || 'N/A'}`);
        console.log(`   Suite: $${cruise.suite_price || 'N/A'}\n`);
      });
    }

    // Verify the fix
    const verifyQuery = `
      SELECT
        cl.name as cruise_line,
        COUNT(*) as still_missing
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.cheapest_price IS NOT NULL
        AND c.cheapest_price > 99
        AND c.interior_price IS NULL
        AND c.oceanview_price IS NULL
        AND c.balcony_price IS NULL
        AND c.suite_price IS NULL
        AND c.is_active = true
      GROUP BY cl.id, cl.name
      ORDER BY still_missing DESC
    `;

    const verifyResult = await pool.query(verifyQuery);

    if (verifyResult.rows.length > 0) {
      console.log('⚠️ Cruises still missing cabin prices:');
      console.log('======================================');
      verifyResult.rows.forEach(row => {
        console.log(`${row.cruise_line}: ${row.still_missing} cruises`);
      });
    } else {
      console.log('✅ All cruises with cheapest_price now have cabin prices!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixNCLCabinPrices().catch(console.error);
