/**
 * Quick check of database pricing for cruise 2144014
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
const sql = postgres(databaseUrl, {
  ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function checkPricing() {
  try {
    const dbResult = await sql`
      SELECT
        c.id,
        c.cruise_id,
        c.name,
        c.sailing_date,
        c.cruise_line_id,
        cl.name as cruise_line_name,
        c.ship_id,
        s.name as ship_name,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        c.cheapest_price,
        c.updated_at
      FROM cruises c
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      LEFT JOIN ships s ON c.ship_id = s.id
      WHERE c.id = '2144014'
    `;

    if (dbResult.length === 0) {
      console.log('Cruise 2144014 not found');
      return;
    }

    const cruise = dbResult[0];
    console.log('CRUISE 2144014 - DATABASE INFO:');
    console.log('='.repeat(50));
    console.log('Name:', cruise.name);
    console.log('Sailing Date:', cruise.sailing_date);
    console.log('Cruise Line:', cruise.cruise_line_name, `(ID: ${cruise.cruise_line_id})`);
    console.log('Ship:', cruise.ship_name, `(ID: ${cruise.ship_id})`);
    console.log();
    console.log('PRICING:');
    console.log('  Interior:  $', cruise.interior_price);
    console.log('  Oceanview: $', cruise.oceanview_price);
    console.log('  Balcony:   $', cruise.balcony_price);
    console.log('  Suite:     $', cruise.suite_price);
    console.log('  Cheapest:  $', cruise.cheapest_price);
    console.log();
    console.log('Last Updated:', cruise.updated_at);
    console.log();

    // Construct expected FTP path
    const sailingDate = new Date(cruise.sailing_date);
    const year = sailingDate.getFullYear();
    const month = String(sailingDate.getMonth() + 1).padStart(2, '0');
    const day = String(sailingDate.getDate()).padStart(2, '0');

    console.log('EXPECTED FTP PATH:');
    console.log(`/${year}/${month}/${day}/${cruise.cruise_line_id}/${cruise.ship_id}/2144014.json`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

checkPricing();
