require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixCheapestPrice() {
  try {
    console.log('Fixing cheapest_price for cruise 2190299...\n');
    
    // Manually update cheapest_price to the minimum of cabin prices
    const result = await pool.query(`
      UPDATE cruises
      SET cheapest_price = LEAST(
        COALESCE(interior_price, 999999),
        COALESCE(oceanview_price, 999999),
        COALESCE(balcony_price, 999999),
        COALESCE(suite_price, 999999)
      )
      WHERE id = '2190299'
      AND LEAST(
        COALESCE(interior_price, 999999),
        COALESCE(oceanview_price, 999999),
        COALESCE(balcony_price, 999999),
        COALESCE(suite_price, 999999)
      ) < 999999
      RETURNING id, cheapest_price, interior_price
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Updated cheapest_price to:', result.rows[0].cheapest_price);
      console.log('   (Calculated from interior_price:', result.rows[0].interior_price + ')');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixCheapestPrice();
