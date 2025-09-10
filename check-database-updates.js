const { sql } = require('drizzle-orm');
const { db } = require('./backend/dist/db/connection');

async function checkDatabaseUpdates() {
  try {
    console.log('Checking recent database updates...\n');

    // Check cruises table
    const recentCruises = await db.execute(sql`
      SELECT COUNT(*) as count, MAX(updated_at) as latest_update
      FROM cruises
      WHERE updated_at > NOW() - INTERVAL '1 hour'
    `);
    console.log('Cruises table (last hour):');
    console.log('  Count:', recentCruises[0].count);
    console.log('  Latest update:', recentCruises[0].latest_update);

    // Check cheapest_pricing table
    const recentPricing = await db.execute(sql`
      SELECT COUNT(*) as count, MAX(last_updated) as latest_update
      FROM cheapest_pricing
      WHERE last_updated > NOW() - INTERVAL '1 hour'
    `);
    console.log('\nCheapest_pricing table (last hour):');
    console.log('  Count:', recentPricing[0].count);
    console.log('  Latest update:', recentPricing[0].latest_update);

    // Show sample of recent cheapest_pricing entries
    const samplePricing = await db.execute(sql`
      SELECT cruise_id, cheapest_price, interior_price, oceanview_price, balcony_price, suite_price, last_updated
      FROM cheapest_pricing
      WHERE last_updated > NOW() - INTERVAL '1 hour'
      ORDER BY last_updated DESC
      LIMIT 5
    `);
    console.log('\nSample recent cheapest_pricing entries:');
    samplePricing.forEach(row => {
      console.log(`  Cruise ${row.cruise_id}: $${row.cheapest_price || 'N/A'} (I:$${row.interior_price || 'N/A'}, O:$${row.oceanview_price || 'N/A'}, B:$${row.balcony_price || 'N/A'}, S:$${row.suite_price || 'N/A'})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error checking database:', error);
    process.exit(1);
  }
}

checkDatabaseUpdates();
