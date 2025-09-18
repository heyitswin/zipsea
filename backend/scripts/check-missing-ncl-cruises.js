require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkMissingCruises() {
  console.log('Checking NCL December 2025 cruises...\n');

  // Count total NCL December cruises
  const totalQuery = `
    SELECT COUNT(*) as total
    FROM cruises
    WHERE cruise_line_id = 17
      AND sailing_date >= '2025-12-01'
      AND sailing_date <= '2025-12-31'
      AND is_active = true
  `;

  // Count with different price filters
  const priceCheckQuery = `
    SELECT
      COUNT(*) as total_active,
      COUNT(CASE WHEN cheapest_price IS NOT NULL THEN 1 END) as with_cheapest_price,
      COUNT(CASE WHEN cheapest_price > 99 THEN 1 END) as above_99,
      COUNT(CASE WHEN cheapest_price IS NULL THEN 1 END) as null_cheapest_price,
      COUNT(CASE WHEN cheapest_price <= 99 THEN 1 END) as below_or_equal_99
    FROM cruises
    WHERE cruise_line_id = 17
      AND sailing_date >= '2025-12-01'
      AND sailing_date <= '2025-12-31'
      AND is_active = true
  `;

  // Get the missing cruises details
  const missingQuery = `
    SELECT
      id,
      cruise_id,
      name,
      sailing_date,
      cheapest_price,
      interior_price,
      oceanview_price,
      balcony_price,
      suite_price
    FROM cruises
    WHERE cruise_line_id = 17
      AND sailing_date >= '2025-12-01'
      AND sailing_date <= '2025-12-31'
      AND is_active = true
      AND (cheapest_price IS NULL OR cheapest_price <= 99)
    ORDER BY sailing_date
  `;

  try {
    const [totalResult, priceResult, missingResult] = await Promise.all([
      pool.query(totalQuery),
      pool.query(priceCheckQuery),
      pool.query(missingQuery)
    ]);

    console.log('NCL December 2025 Statistics:');
    console.log('==============================');
    console.log('Total active cruises:', totalResult.rows[0].total);
    console.log('With cheapest_price:', priceResult.rows[0].with_cheapest_price);
    console.log('With price > $99:', priceResult.rows[0].above_99);
    console.log('With NULL price:', priceResult.rows[0].null_cheapest_price);
    console.log('With price <= $99:', priceResult.rows[0].below_or_equal_99);

    if (missingResult.rows.length > 0) {
      console.log('\nMissing cruises (filtered out by search):');
      console.log('==========================================');
      missingResult.rows.forEach((cruise, i) => {
        console.log(`\n${i + 1}. ${cruise.name} (ID: ${cruise.id})`);
        console.log(`   Sailing: ${cruise.sailing_date}`);
        console.log(`   Cheapest Price: ${cruise.cheapest_price || 'NULL'}`);
        console.log(`   Cabin Prices: Interior=$${cruise.interior_price || 'N/A'}, Ocean=$${cruise.oceanview_price || 'N/A'}, Balcony=$${cruise.balcony_price || 'N/A'}, Suite=$${cruise.suite_price || 'N/A'}`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkMissingCruises();
