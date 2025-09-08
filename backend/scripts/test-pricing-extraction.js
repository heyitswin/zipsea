#!/usr/bin/env node

const { Client } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { sql } = require('drizzle-orm');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION,
  ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});

const db = drizzle(client);

async function testPricingExtraction() {
  try {
    await client.connect();

    // Get a cruise with raw_data
    const testCruise = await client.query(
      "SELECT id, raw_data FROM cruises WHERE id = '2111828'"
    );

    if (testCruise.rows.length === 0) {
      console.log('Test cruise not found');
      return;
    }

    const cruiseId = testCruise.rows[0].id;
    const rawData = testCruise.rows[0].raw_data;

    console.log(`Testing pricing extraction for cruise ${cruiseId}`);
    console.log('Raw data has prices:', !!rawData.prices);

    // Try to extract pricing like the webhook does
    if (rawData.prices && typeof rawData.prices === 'object') {
      const pricingRecords = [];
      let count = 0;
      let errors = [];

      for (const [rateCode, cabins] of Object.entries(rawData.prices)) {
        if (typeof cabins !== 'object') continue;

        for (const [cabinCode, occupancies] of Object.entries(cabins)) {
          if (typeof occupancies !== 'object') continue;

          for (const [occupancyCode, pricingData] of Object.entries(occupancies)) {
            if (typeof pricingData !== 'object') continue;

            const pricing = pricingData;
            if (!pricing.price && !pricing.adultprice) continue;

            count++;

            // Build the record exactly as webhook does
            const record = {
              cruiseId,
              rateCode: rateCode.substring(0, 50),
              cabinCode: cabinCode.substring(0, 10),
              occupancyCode: occupancyCode.substring(0, 10),
              cabinType: pricing.cabintype || null,
              basePrice: parseDecimal(pricing.price),
              adultPrice: parseDecimal(pricing.adultprice),
              childPrice: parseDecimal(pricing.childprice),
              totalPrice: calculateTotalPrice(pricing),
              isAvailable: pricing.available !== false,
              currency: rawData.currency || 'USD',
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            pricingRecords.push(record);

            // Show first few records
            if (count <= 3) {
              console.log(`\nSample record ${count}:`);
              console.log(`  Rate: ${record.rateCode}`);
              console.log(`  Cabin: ${record.cabinCode}`);
              console.log(`  Occupancy: ${record.occupancyCode}`);
              console.log(`  Type: ${record.cabinType}`);
              console.log(`  Base Price: ${record.basePrice}`);
              console.log(`  Total Price: ${record.totalPrice}`);
            }
          }
        }
      }

      console.log(`\nTotal pricing records to insert: ${pricingRecords.length}`);

      if (pricingRecords.length > 0) {
        // Try to insert just one record to test
        const testRecord = pricingRecords[0];

        console.log('\nTrying to insert test record...');

        try {
          // Use raw SQL to see exact error
          await client.query(
            `INSERT INTO pricing (
              cruise_id, rate_code, cabin_code, occupancy_code,
              cabin_type, base_price, adult_price, child_price,
              total_price, is_available, currency, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              testRecord.cruiseId,
              testRecord.rateCode,
              testRecord.cabinCode,
              testRecord.occupancyCode,
              testRecord.cabinType,
              testRecord.basePrice,
              testRecord.adultPrice,
              testRecord.childPrice,
              testRecord.totalPrice,
              testRecord.isAvailable,
              testRecord.currency,
              testRecord.createdAt,
              testRecord.updatedAt
            ]
          );

          console.log('✅ Test insert successful!');

          // Check if it was actually inserted
          const check = await client.query(
            'SELECT COUNT(*) as count FROM pricing WHERE cruise_id = $1',
            [cruiseId]
          );
          console.log(`Records in pricing table for this cruise: ${check.rows[0].count}`);

        } catch (error) {
          console.error('❌ Insert failed with error:');
          console.error(error.message);
          console.error('Error code:', error.code);
          console.error('Error detail:', error.detail);
        }
      }

    } else {
      console.log('No prices field in raw_data');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

function parseDecimal(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function calculateTotalPrice(pricing) {
  const base = parseDecimal(pricing.price || pricing.adultprice) || 0;
  const taxes = parseDecimal(pricing.taxes) || 0;
  const ncf = parseDecimal(pricing.ncf) || 0;
  const gratuity = parseDecimal(pricing.gratuity) || 0;
  const fuel = parseDecimal(pricing.fuel) || 0;
  const portCharges = parseDecimal(pricing.portcharges) || 0;
  const governmentFees = parseDecimal(pricing.governmentfees) || 0;

  return base + taxes + ncf + gratuity + fuel + portCharges + governmentFees;
}

testPricingExtraction().catch(console.error);
