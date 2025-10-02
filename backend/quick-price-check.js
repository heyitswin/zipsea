const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL_PRODUCTION, {
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    const [cruise] = await sql`
      SELECT id, name, interior_price, oceanview_price, balcony_price, suite_price, raw_data
      FROM cruises WHERE id = 2099523
    `;

    console.log('DB Prices:', {
      interior: cruise.interior_price,
      oceanview: cruise.oceanview_price,
      balcony: cruise.balcony_price,
      suite: cruise.suite_price
    });

    const raw = cruise.raw_data;
    if (raw?.cheapest?.combined) {
      console.log('FTP Prices:', raw.cheapest.combined);
    } else if (raw?.cheapest?.prices) {
      console.log('FTP Prices:', raw.cheapest.prices);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
})();
