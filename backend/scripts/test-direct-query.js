#!/usr/bin/env node
require('dotenv').config();
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { cruises } = require('../dist/db/schema');
const { eq } = require('drizzle-orm');

const DATABASE_URL = process.env.DATABASE_URL;
const client = postgres(DATABASE_URL, { ssl: 'require' });
const db = drizzle(client);

async function testDirectQuery() {
  try {
    console.log('Testing direct Drizzle query (same as API uses)...\n');

    // Query exactly how the API does it
    const cruiseResult = await db
      .select()
      .from(cruises)
      .where(eq(cruises.id, '2145865'))
      .limit(1);

    if (cruiseResult.length > 0) {
      const cruise = cruiseResult[0];
      console.log('Result from Drizzle ORM:');
      console.log('  ID:', cruise.id);
      console.log('  Interior Price:', cruise.interiorPrice);
      console.log('  Oceanview Price:', cruise.oceanviewPrice);
      console.log('  Balcony Price:', cruise.balconyPrice);
      console.log('  Suite Price:', cruise.suitePrice);
      console.log('  Cheapest Price:', cruise.cheapestPrice);
      console.log('  Updated At:', cruise.updatedAt);

      // Check the actual types
      console.log('\nData types:');
      console.log('  interiorPrice type:', typeof cruise.interiorPrice);
      console.log('  interiorPrice value:', cruise.interiorPrice);
    } else {
      console.log('No cruise found with ID 2145865');
    }

    // Also do a raw SQL query for comparison
    console.log('\n---\nRaw SQL query for comparison:');
    const rawResult = await client`
      SELECT
        id,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price
      FROM cruises
      WHERE id = '2145865'
    `;

    if (rawResult.length > 0) {
      const cruise = rawResult[0];
      console.log('Result from raw SQL:');
      console.log('  ID:', cruise.id);
      console.log('  Interior Price:', cruise.interior_price);
      console.log('  Oceanview Price:', cruise.oceanview_price);
      console.log('  Balcony Price:', cruise.balcony_price);
      console.log('  Suite Price:', cruise.suite_price);
      console.log('  Cheapest Price:', cruise.cheapest_price);
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

testDirectQuery();
