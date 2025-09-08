#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION,
  ssl:
    process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('render.com')
      ? { rejectUnauthorized: false }
      : false,
});

async function fixPricingExtraction() {
  try {
    await client.connect();

    console.log('🔧 Fixing Pricing Extraction from raw_data');
    console.log('='.repeat(60));

    // First, let's understand the actual structure
    const sampleCruise = await client.query(
      "SELECT id, raw_data FROM cruises WHERE id = '2111828' LIMIT 1"
    );

    if (sampleCruise.rows.length > 0) {
      const rawData = sampleCruise.rows[0].raw_data;

      console.log('\n📊 Analyzing data structure...');

      // Check the actual nesting level
      let sampleFound = false;
      for (const [rateCode, level2] of Object.entries(rawData.prices || {})) {
        if (typeof level2 !== 'object' || !level2) continue;

        for (const [cabinId, level3] of Object.entries(level2)) {
          // Check if level3 is pricing data or another nesting level
          if (level3 && typeof level3 === 'object') {
            if (level3.price !== undefined || level3.adultprice !== undefined) {
              // This is pricing data at level 3 (rate -> cabin -> pricing)
              console.log('✅ Found 3-level structure: rate -> cabin -> pricing');
              console.log(`  Example: prices['${rateCode}']['${cabinId}'] contains pricing data`);
              console.log(`  Price: $${level3.price || level3.adultprice}`);
              console.log(`  Cabin Type: ${level3.cabintype}`);
              sampleFound = true;
              break;
            } else {
              // Check if it's a 4-level structure
              for (const [occupancy, level4] of Object.entries(level3)) {
                if (
                  level4 &&
                  typeof level4 === 'object' &&
                  (level4.price !== undefined || level4.adultprice !== undefined)
                ) {
                  console.log('✅ Found 4-level structure: rate -> cabin -> occupancy -> pricing');
                  console.log(
                    `  Example: prices['${rateCode}']['${cabinId}']['${occupancy}'] contains pricing data`
                  );
                  sampleFound = true;
                  break;
                }
              }
            }
          }
          if (sampleFound) break;
        }
        if (sampleFound) break;
      }
    }

    // Now extract pricing for all cruises with the correct structure
    console.log('\n🚀 Starting extraction for all cruises...');

    const cruisesWithData = await client.query(
      `SELECT id, raw_data
       FROM cruises
       WHERE raw_data IS NOT NULL
         AND raw_data->>'prices' IS NOT NULL
         AND is_active = true
       LIMIT 10` // Test with 10 cruises first
    );

    console.log(`Found ${cruisesWithData.rows.length} cruises with pricing data`);

    let totalExtracted = 0;
    let totalFailed = 0;

    for (const cruise of cruisesWithData.rows) {
      const cruiseId = cruise.id;
      const rawData = cruise.raw_data;

      console.log(`\nProcessing cruise ${cruiseId}...`);

      if (!rawData.prices) {
        console.log('  No prices field found');
        continue;
      }

      const pricingRecords = [];

      // Extract with flexible structure handling
      for (const [rateCode, cabins] of Object.entries(rawData.prices)) {
        if (typeof cabins !== 'object' || !cabins) continue;

        for (const [cabinIdOrCode, dataOrOccupancies] of Object.entries(cabins)) {
          if (!dataOrOccupancies || typeof dataOrOccupancies !== 'object') continue;

          // Check if this level has pricing data (3-level) or needs to go deeper (4-level)
          if (dataOrOccupancies.price !== undefined || dataOrOccupancies.adultprice !== undefined) {
            // 3-level structure: rate -> cabin -> pricing
            const pricing = dataOrOccupancies;

            pricingRecords.push({
              cruiseId,
              rateCode: rateCode.substring(0, 50),
              cabinCode: cabinIdOrCode.substring(0, 10),
              occupancyCode: '101', // Default occupancy for 3-level structure
              cabinType: pricing.cabintype || null,
              basePrice: parseDecimal(pricing.price),
              adultPrice: parseDecimal(pricing.adultprice),
              childPrice: parseDecimal(pricing.childprice),
              totalPrice: calculateTotalPrice(pricing),
              isAvailable: pricing.available !== false,
              currency: rawData.currency || 'USD',
            });
          } else {
            // 4-level structure: rate -> cabin -> occupancy -> pricing
            for (const [occupancyCode, pricing] of Object.entries(dataOrOccupancies)) {
              if (!pricing || typeof pricing !== 'object') continue;
              if (!pricing.price && !pricing.adultprice) continue;

              pricingRecords.push({
                cruiseId,
                rateCode: rateCode.substring(0, 50),
                cabinCode: cabinIdOrCode.substring(0, 10),
                occupancyCode: occupancyCode.substring(0, 10),
                cabinType: pricing.cabintype || null,
                basePrice: parseDecimal(pricing.price),
                adultPrice: parseDecimal(pricing.adultprice),
                childPrice: parseDecimal(pricing.childprice),
                totalPrice: calculateTotalPrice(pricing),
                isAvailable: pricing.available !== false,
                currency: rawData.currency || 'USD',
              });
            }
          }
        }
      }

      console.log(`  Found ${pricingRecords.length} pricing records to insert`);

      if (pricingRecords.length > 0) {
        try {
          // Delete existing pricing for this cruise
          await client.query('DELETE FROM pricing WHERE cruise_id = $1', [cruiseId]);

          // Insert new pricing records
          for (const record of pricingRecords) {
            await client.query(
              `INSERT INTO pricing (
                cruise_id, rate_code, cabin_code, occupancy_code,
                cabin_type, base_price, adult_price, child_price,
                total_price, is_available, currency, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
              [
                record.cruiseId,
                record.rateCode,
                record.cabinCode,
                record.occupancyCode,
                record.cabinType,
                record.basePrice,
                record.adultPrice,
                record.childPrice,
                record.totalPrice,
                record.isAvailable,
                record.currency,
              ]
            );
          }

          console.log(`✅ Cruise ${cruiseId}: Extracted ${pricingRecords.length} pricing records`);
          totalExtracted += pricingRecords.length;

          // Also update cheapest_pricing
          await updateCheapestPricing(client, cruiseId);
        } catch (error) {
          console.error(`❌ Failed to insert pricing for cruise ${cruiseId}:`, error.message);
          totalFailed++;
        }
      }
    }

    console.log('\n📈 Extraction Summary:');
    console.log(`  Total pricing records extracted: ${totalExtracted}`);
    console.log(`  Failed cruises: ${totalFailed}`);

    // Verify the results
    const count = await client.query('SELECT COUNT(*) as count FROM pricing');
    console.log(`\n✅ Total records now in pricing table: ${count.rows[0].count}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
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
  if (!pricing) return null;

  const base = parseDecimal(pricing.price || pricing.adultprice) || 0;
  const taxes = parseDecimal(pricing.taxes) || 0;
  const ncf = parseDecimal(pricing.ncf) || 0;
  const gratuity = parseDecimal(pricing.gratuity) || 0;
  const fuel = parseDecimal(pricing.fuel) || 0;
  const portCharges = parseDecimal(pricing.portcharges) || 0;
  const governmentFees = parseDecimal(pricing.governmentfees) || 0;

  return base + taxes + ncf + gratuity + fuel + portCharges + governmentFees;
}

async function updateCheapestPricing(client, cruiseId) {
  try {
    // Get cheapest prices by cabin type
    const result = await client.query(
      `
      SELECT
        MIN(CASE WHEN total_price > 0 THEN total_price END) as cheapest_price,
        MIN(CASE WHEN cabin_type = 'inside' AND total_price > 0 THEN total_price END) as interior_price,
        MIN(CASE WHEN cabin_type = 'oceanview' AND total_price > 0 THEN total_price END) as oceanview_price,
        MIN(CASE WHEN cabin_type = 'balcony' AND total_price > 0 THEN total_price END) as balcony_price,
        MIN(CASE WHEN cabin_type = 'suite' AND total_price > 0 THEN total_price END) as suite_price
      FROM pricing
      WHERE cruise_id = $1
        AND is_available = true
    `,
      [cruiseId]
    );

    if (result.rows[0].cheapest_price) {
      // Delete existing cheapest pricing
      await client.query('DELETE FROM cheapest_pricing WHERE cruise_id = $1', [cruiseId]);

      // Insert new cheapest pricing
      await client.query(
        `
        INSERT INTO cheapest_pricing (
          cruise_id, cheapest_price, interior_price, oceanview_price,
          balcony_price, suite_price, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      `,
        [
          cruiseId,
          result.rows[0].cheapest_price,
          result.rows[0].interior_price,
          result.rows[0].oceanview_price,
          result.rows[0].balcony_price,
          result.rows[0].suite_price,
        ]
      );
    }
  } catch (error) {
    console.error(`Failed to update cheapest pricing for ${cruiseId}:`, error.message);
  }
}

fixPricingExtraction().catch(console.error);
