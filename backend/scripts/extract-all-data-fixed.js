#!/usr/bin/env node

/**
 * Fixed Data Extraction Script for Raw Data
 * Extracts pricing, itinerary, and cabin data from raw_data JSONB
 * Matches actual database schema without non-existent columns
 */

const { Pool } = require('pg');
require('dotenv').config();

async function extractAllData(cruiseLineName) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const client = await pool.connect();

  console.log('\n🚀 COMPREHENSIVE DATA EXTRACTION FROM RAW_DATA');
  console.log('================================================================================');
  console.log('Time:', new Date().toISOString());
  console.log(`\nProcessing: ${cruiseLineName}`);

  try {
    await client.query('BEGIN');

    // Get all cruises for this line
    const result = await client.query(
      `
      SELECT c.id, c.raw_data, c.cruise_line_id
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE cl.name = $1 AND c.raw_data IS NOT NULL
      ORDER BY c.id
    `,
      [cruiseLineName]
    );

    console.log(`Found ${result.rows.length} cruises to process`);

    const stats = {
      pricing: { extracted: 0, failed: 0 },
      itinerary: { extracted: 0, failed: 0 },
      cabins: { extracted: 0, failed: 0 },
      updated: 0,
    };

    // Process in batches
    const BATCH_SIZE = 100;
    const batches = [];
    for (let i = 0; i < result.rows.length; i += BATCH_SIZE) {
      batches.push(result.rows.slice(i, i + BATCH_SIZE));
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`\nProcessing batch ${i + 1}/${batches.length}...`);

      // Prepare bulk data arrays
      const pricingData = [];
      const itineraryValues = [];
      const itineraryPlaceholders = [];
      let itineraryParamCount = 0;
      const cabinData = [];

      for (const cruise of batch) {
        try {
          const raw = cruise.raw_data;

          // Extract cheapest pricing from various sources
          let cheapestPrice = null;
          let currency = 'USD';

          // Try different price locations in the JSON
          if (raw.pricing) {
            if (raw.pricing.cruiseonly?.totalcruiseonlyprice) {
              cheapestPrice = parseFloat(raw.pricing.cruiseonly.totalcruiseonlyprice);
            } else if (raw.pricing.cruiseflighthotel?.totalcruiseflighthotelprice) {
              cheapestPrice = parseFloat(raw.pricing.cruiseflighthotel.totalcruiseflighthotelprice);
            } else if (raw.pricing.cruiseflight?.totalcruiseflightprice) {
              cheapestPrice = parseFloat(raw.pricing.cruiseflight.totalcruiseflightprice);
            }
            if (raw.pricing.currency) {
              currency = raw.pricing.currency;
            }
          }

          // Fallback to cabin pricing
          if (!cheapestPrice && raw.cabins) {
            const cabinPrices = [];
            const cabinArray = Array.isArray(raw.cabins) ? raw.cabins : [raw.cabins];
            for (const cabin of cabinArray) {
              if (cabin.pricingdetails?.cruiseonly?.price) {
                cabinPrices.push(parseFloat(cabin.pricingdetails.cruiseonly.price));
              }
            }
            if (cabinPrices.length > 0) {
              cheapestPrice = Math.min(...cabinPrices);
            }
          }

          if (cheapestPrice) {
            pricingData.push({
              cruise_id: cruise.id,
              currency: currency,
              cheapest_price: cheapestPrice,
              source: 'raw_data_extraction',
              extracted_at: new Date(),
            });
            stats.pricing.extracted++;
          }
        } catch (err) {
          stats.pricing.failed++;
        }

        // Extract itinerary data
        try {
          const raw = cruise.raw_data;
          if (raw.itinerary && Array.isArray(raw.itinerary)) {
            for (const day of raw.itinerary) {
              const portName =
                day.name || day.itineraryname || day.portname || day.port?.name || 'At Sea';
              itineraryValues.push(
                cruise.id,
                day.day || day.daynumber,
                portName,
                null, // Skip port_id due to foreign key constraints - would need to populate ports table first
                day.arrivetime || day.arrivaltime || null,
                day.departtime || day.departuretime || null,
                day.description || null
              );
              const base = itineraryParamCount;
              itineraryPlaceholders.push(
                `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`
              );
              itineraryParamCount += 7;
            }
            stats.itinerary.extracted++;
          }
        } catch (err) {
          stats.itinerary.failed++;
        }

        // Skip cabin extraction - cabin_categories table is ship-based, not cruise-based
      }

      // Insert pricing data
      if (pricingData.length > 0) {
        const pricingValues = [];
        const pricingPlaceholders = [];
        pricingData.forEach((p, idx) => {
          const offset = idx * 5;
          pricingPlaceholders.push(
            `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
          );
          pricingValues.push(p.cruise_id, p.currency, p.cheapest_price, p.source, p.extracted_at);
        });

        await client.query(
          `
          INSERT INTO cheapest_pricing (
            cruise_id, currency, cheapest_price, source, extracted_at
          ) VALUES ${pricingPlaceholders.join(', ')}
          ON CONFLICT (cruise_id) DO UPDATE SET
            cheapest_price = EXCLUDED.cheapest_price,
            currency = EXCLUDED.currency,
            source = EXCLUDED.source,
            extracted_at = EXCLUDED.extracted_at
        `,
          pricingValues
        );

        // Also update the main cruises table
        for (const p of pricingData) {
          await client.query(
            `
            UPDATE cruises
            SET cheapest_price = $1, updated_at = NOW()
            WHERE id = $2
          `,
            [p.cheapest_price, p.cruise_id]
          );
          stats.updated++;
        }
      }

      // Insert itinerary data
      if (itineraryPlaceholders.length > 0) {
        // Clear existing itinerary for these cruises
        const cruiseIds = batch.map(c => c.id);
        await client.query(
          `
          DELETE FROM cruise_itinerary
          WHERE cruise_id = ANY($1::varchar[])
        `,
          [cruiseIds]
        );

        await client.query(
          `
          INSERT INTO cruise_itinerary (
            cruise_id, day_number, port_name, port_id,
            arrive_time, depart_time, description
          ) VALUES ${itineraryPlaceholders.join(', ')}
        `,
          itineraryValues
        );
      }

      // Skip cabin data insertion - table structure not compatible
    }

    await client.query('COMMIT');

    // Print summary
    console.log(
      '\n================================================================================'
    );
    console.log('✅ EXTRACTION COMPLETE');
    console.log('================================================================================');
    console.log('Pricing:');
    console.log(`  - Extracted: ${stats.pricing.extracted}`);
    console.log(`  - Failed: ${stats.pricing.failed}`);
    console.log(`  - Updated in cruises table: ${stats.updated}`);
    console.log('\nItinerary:');
    console.log(`  - Extracted: ${stats.itinerary.extracted}`);
    console.log(`  - Failed: ${stats.itinerary.failed}`);
    console.log('\nCabin Categories:');
    console.log(`  - Extracted: ${stats.cabins.extracted}`);
    console.log(`  - Failed: ${stats.cabins.failed}`);

    // Verify extraction
    const verifyPricing = await client.query(
      `
      SELECT COUNT(*) as count
      FROM cheapest_pricing cp
      JOIN cruises c ON cp.cruise_id = c.id
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE cl.name = $1
    `,
      [cruiseLineName]
    );

    const verifyItinerary = await client.query(
      `
      SELECT COUNT(DISTINCT ci.cruise_id) as count
      FROM cruise_itinerary ci
      JOIN cruises c ON ci.cruise_id = c.id
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE cl.name = $1
    `,
      [cruiseLineName]
    );

    // Skip cabin verification - table structure not compatible
    const verifyCabins = { rows: [{ count: 0 }] };

    console.log('\n📊 Verification:');
    console.log(`  - Cruises with pricing: ${verifyPricing.rows[0].count}`);
    console.log(`  - Cruises with itinerary: ${verifyItinerary.rows[0].count}`);
    console.log(`  - Cruises with cabins: ${verifyCabins.rows[0].count}`);

    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Extraction failed:', error.message);
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Get cruise line from command line
const cruiseLineName = process.argv[2];
if (!cruiseLineName) {
  console.error('Usage: node extract-all-data-fixed.js "Cruise Line Name"');
  console.error('Example: node extract-all-data-fixed.js "Royal Caribbean"');
  process.exit(1);
}

extractAllData(cruiseLineName);
