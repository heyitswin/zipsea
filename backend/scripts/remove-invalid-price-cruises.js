require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

async function removeInvalidPriceCruises() {
  console.log('Removing cruises with no valid cabin prices from search results...\n');

  try {
    // First, identify cruises with cheapest_price but NO cabin prices
    const identifyQuery = `
      SELECT
        cl.name as cruise_line,
        COUNT(*) as count
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.cheapest_price IS NOT NULL
        AND c.cheapest_price > 0
        AND (c.interior_price IS NULL OR c.interior_price = 0)
        AND (c.oceanview_price IS NULL OR c.oceanview_price = 0)
        AND (c.balcony_price IS NULL OR c.balcony_price = 0)
        AND (c.suite_price IS NULL OR c.suite_price = 0)
        AND c.is_active = true
      GROUP BY cl.id, cl.name
      ORDER BY count DESC
    `;

    const result = await pool.query(identifyQuery);

    console.log('Cruises with invalid pricing (cheapest_price but no cabin prices):');
    console.log('===================================================================');
    let totalToRemove = 0;
    result.rows.forEach(row => {
      console.log(`${row.cruise_line}: ${row.count} cruises`);
      totalToRemove += parseInt(row.count);
    });
    console.log(`\nTotal cruises to remove from search: ${totalToRemove}\n`);

    // Set cheapest_price to NULL for these cruises
    const updateQuery = `
      UPDATE cruises
      SET
        cheapest_price = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE cheapest_price IS NOT NULL
        AND cheapest_price > 0
        AND (interior_price IS NULL OR interior_price = 0)
        AND (oceanview_price IS NULL OR oceanview_price = 0)
        AND (balcony_price IS NULL OR balcony_price = 0)
        AND (suite_price IS NULL OR suite_price = 0)
        AND is_active = true
      RETURNING id, cruise_id, name, cruise_line_id
    `;

    console.log('Removing invalid cruises from search results...');
    console.time('Update');

    const updateResult = await pool.query(updateQuery);
    console.timeEnd('Update');

    console.log(`\n✅ Successfully removed ${updateResult.rows.length} cruises from search results\n`);

    // Show sample of removed cruises
    if (updateResult.rows.length > 0) {
      console.log('Sample of removed cruises:');
      console.log('==========================');
      updateResult.rows.slice(0, 5).forEach((cruise, i) => {
        console.log(`${i + 1}. ${cruise.name} (ID: ${cruise.id}, Cruise ID: ${cruise.cruise_id})`);
      });
    }

    // Verify the fix
    const verifyQuery = `
      SELECT COUNT(*) as remaining
      FROM cruises
      WHERE cheapest_price IS NOT NULL
        AND cheapest_price > 0
        AND (interior_price IS NULL OR interior_price = 0)
        AND (oceanview_price IS NULL OR oceanview_price = 0)
        AND (balcony_price IS NULL OR balcony_price = 0)
        AND (suite_price IS NULL OR suite_price = 0)
        AND is_active = true
    `;

    const verifyResult = await pool.query(verifyQuery);

    if (verifyResult.rows[0].remaining > 0) {
      console.log(`\n⚠️ Warning: ${verifyResult.rows[0].remaining} cruises still have invalid pricing`);
    } else {
      console.log('\n✅ All cruises with invalid pricing have been removed from search results!');
      console.log('   Cruises now either have valid prices or don\'t appear in search at all.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

removeInvalidPriceCruises().catch(console.error);
