const postgres = require('postgres');
require('dotenv').config();

// Add SSL configuration for Render database
const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  connection: {
    application_name: 'check-db-simple',
  },
  max: 1,
  idle_timeout: 5,
  connect_timeout: 10,
});

async function checkDatabaseUpdates() {
  try {
    console.log('Checking recent database updates...');
    console.log('Connecting to database...\n');

    // Check cruises table
    const recentCruises = await sql`
      SELECT COUNT(*) as count, MAX(updated_at) as latest_update
      FROM cruises
      WHERE updated_at > NOW() - INTERVAL '1 hour'
    `;
    console.log('Cruises table (last hour):');
    console.log('  Count:', recentCruises[0].count);
    console.log('  Latest update:', recentCruises[0].latest_update);

    // Check cheapest_pricing table
    const recentPricing = await sql`
      SELECT COUNT(*) as count, MAX(last_updated) as latest_update
      FROM cheapest_pricing
      WHERE last_updated > NOW() - INTERVAL '1 hour'
    `;
    console.log('\nCheapest_pricing table (last hour):');
    console.log('  Count:', recentPricing[0].count);
    console.log('  Latest update:', recentPricing[0].latest_update);

    // Show sample of recent cheapest_pricing entries with prices
    const samplePricing = await sql`
      SELECT cruise_id, cheapest_price, interior_price, oceanview_price, balcony_price, suite_price, last_updated
      FROM cheapest_pricing
      WHERE last_updated > NOW() - INTERVAL '1 hour'
      AND (cheapest_price IS NOT NULL OR interior_price IS NOT NULL)
      ORDER BY last_updated DESC
      LIMIT 5
    `;
    console.log('\nSample recent cheapest_pricing entries with actual prices:');
    samplePricing.forEach(row => {
      const prices = [];
      if (row.cheapest_price) prices.push(`Cheapest: $${row.cheapest_price}`);
      if (row.interior_price) prices.push(`Interior: $${row.interior_price}`);
      if (row.oceanview_price) prices.push(`Ocean: $${row.oceanview_price}`);
      if (row.balcony_price) prices.push(`Balcony: $${row.balcony_price}`);
      if (row.suite_price) prices.push(`Suite: $${row.suite_price}`);
      console.log(`  Cruise ${row.cruise_id}: ${prices.join(', ')}`);
    });

    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('Error checking database:', error.message);
    process.exit(1);
  }
}

// Add timeout
setTimeout(() => {
  console.error('Timeout: Database connection took too long');
  process.exit(1);
}, 15000);

checkDatabaseUpdates();
