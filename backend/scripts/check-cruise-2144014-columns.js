/**
 * Check actual column names and data for cruise 2144014
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
const sql = postgres(databaseUrl, {
  ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function checkColumns() {
  try {
    // First get all columns
    const columns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'cruises'
      AND column_name LIKE '%price%'
      ORDER BY column_name
    `;

    console.log('Price-related columns in cruises table:');
    columns.forEach(col => console.log(' -', col.column_name));
    console.log();

    // Now get the cruise data
    const cruise = await sql`
      SELECT
        id,
        cruise_id,
        name,
        sailing_date,
        cruise_line_id,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price,
        updated_at,
        last_sync_at
      FROM cruises
      WHERE id = 2144014
    `;

    if (cruise.length > 0) {
      console.log('Cruise 2144014 pricing:');
      console.log(cruise[0]);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

checkColumns();
