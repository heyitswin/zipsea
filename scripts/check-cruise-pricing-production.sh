#!/bin/bash

echo "Checking cruise 2143102 pricing in production database..."

# Use production database URL directly
DATABASE_URL="$DATABASE_URL_PRODUCTION" node << 'EOF'
const { Client } = require('pg');

async function checkCruise() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();

    // Check cruise info
    const cruiseResult = await client.query(`
      SELECT
        id,
        name,
        sailing_date,
        updated_at,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price
      FROM cruises
      WHERE id = '2143102'
    `);

    if (cruiseResult.rows.length > 0) {
      const cruise = cruiseResult.rows[0];
      console.log('=== CRUISE IN DATABASE ===');
      console.log('Name:', cruise.name);
      console.log('Sailing:', cruise.sailing_date);
      console.log('Updated:', cruise.updated_at);
      console.log('\nPrices in cruises table:');
      console.log('  Interior: $' + (cruise.interior_price || 'NULL'));
      console.log('  Oceanview: $' + (cruise.oceanview_price || 'NULL'));
      console.log('  Balcony: $' + (cruise.balcony_price || 'NULL'));
      console.log('  Suite: $' + (cruise.suite_price || 'NULL'));
    }

    // Check cheapest_pricing
    const cheapestResult = await client.query(`
      SELECT
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        last_updated
      FROM cheapest_pricing
      WHERE cruise_id = '2143102'
    `);

    if (cheapestResult.rows.length > 0) {
      const pricing = cheapestResult.rows[0];
      console.log('\n=== CHEAPEST_PRICING TABLE ===');
      console.log('  Interior: $' + (pricing.interior_price || 'NULL'));
      console.log('  Oceanview: $' + (pricing.oceanview_price || 'NULL'));
      console.log('  Balcony: $' + (pricing.balcony_price || 'NULL'));
      console.log('  Suite: $' + (pricing.suite_price || 'NULL'));
      console.log('  Last Updated:', pricing.last_updated);
    }

    // Count pricing records
    const countResult = await client.query(`
      SELECT
        cabin_type,
        COUNT(*) as count,
        MIN(base_price) as min_price,
        MAX(updated_at) as last_update
      FROM pricing
      WHERE cruise_id = '2143102'
      GROUP BY cabin_type
      ORDER BY cabin_type
    `);

    if (countResult.rows.length > 0) {
      console.log('\n=== PRICING RECORDS BY CABIN TYPE ===');
      countResult.rows.forEach(row => {
        console.log(`  ${row.cabin_type || 'Unknown'}: ${row.count} records, Min: $${row.min_price}, Last update: ${row.last_update}`);
      });
    }

    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

checkCruise();
EOF
