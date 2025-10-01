const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { cruises } = require('../dist/db/schema/cruises');
const { priceHistory } = require('../dist/db/schema/pricing');
const { eq, inArray } = require('drizzle-orm');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
});

const db = drizzle(pool);

async function getCruisesWithPriceHistory() {
  try {
    // Get distinct cruise IDs from price_history
    const cruiseIds = await db
      .selectDistinct({ cruiseId: priceHistory.cruiseId })
      .from(priceHistory)
      .limit(10);

    console.log('Found cruise IDs with price history:', cruiseIds.map(c => c.cruiseId));

    // Get cruise details for those IDs
    const cruisesWithHistory = await db
      .select({
        id: cruises.id,
        slug: cruises.slug,
        name: cruises.name
      })
      .from(cruises)
      .where(inArray(cruises.id, cruiseIds.map(c => c.cruiseId)))
      .limit(10);

    console.log('\nCruises with slugs:');
    console.log(JSON.stringify(cruisesWithHistory, null, 2));

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

getCruisesWithPriceHistory();
