#!/usr/bin/env node

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION,
  ssl:
    process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('render.com')
      ? { rejectUnauthorized: false }
      : false,
});

async function extractAllData() {
  console.log('🚀 COMPREHENSIVE DATA EXTRACTION FROM RAW_DATA');
  console.log('='.repeat(80));
  console.log('Time:', new Date().toISOString());
  console.log('');

  const client = await pool.connect();

  try {
    // Get cruise line to process (can be parameterized)
    const cruiseLineName = process.argv[2] || 'Royal Caribbean';
    console.log(`Processing: ${cruiseLineName}`);

    // Get all cruises for this line with raw_data
    const cruises = await client.query(
      `
      SELECT
        c.id,
        c.name,
        c.raw_data,
        cl.name as cruise_line_name
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.raw_data IS NOT NULL
        AND cl.name = $1
        AND c.is_active = true
      ORDER BY c.sailing_date
    `,
      [cruiseLineName]
    );

    console.log(`Found ${cruises.rows.length} cruises to process\n`);

    let stats = {
      pricing: { extracted: 0, failed: 0 },
      itinerary: { extracted: 0, failed: 0 },
      cabins: { extracted: 0, failed: 0 },
    };

    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < cruises.rows.length; i += batchSize) {
      const batch = cruises.rows.slice(i, i + batchSize);
      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cruises.rows.length / batchSize)}...`
      );

      // 1. EXTRACT PRICING
      const pricingValues = [];
      const pricingPlaceholders = [];
      let pricingParamCount = 0;

      for (const cruise of batch) {
        try {
          const raw = cruise.raw_data;

          // Get prices from various possible locations
          const interiorPrice =
            parseFloat(raw.cheapestinside || raw.cheapest?.combined?.inside) || null;
          const oceanviewPrice =
            parseFloat(raw.cheapestoutside || raw.cheapest?.combined?.outside) || null;
          const balconyPrice =
            parseFloat(raw.cheapestbalcony || raw.cheapest?.combined?.balcony) || null;
          const suitePrice = parseFloat(raw.cheapestsuite || raw.cheapest?.combined?.suite) || null;

          // Calculate cheapest price
          const prices = [interiorPrice, oceanviewPrice, balconyPrice, suitePrice].filter(
            p => p && p > 0
          );
          const cheapestPrice =
            prices.length > 0 ? Math.min(...prices) : parseFloat(raw.cheapestprice) || null;

          if (cheapestPrice) {
            pricingValues.push(
              cruise.id,
              cheapestPrice,
              interiorPrice,
              oceanviewPrice,
              balconyPrice,
              suitePrice,
              raw.currency || 'USD'
            );

            const base = pricingParamCount;
            pricingPlaceholders.push(
              `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`
            );
            pricingParamCount += 7;
            stats.pricing.extracted++;
          }
        } catch (err) {
          stats.pricing.failed++;
        }
      }

      // Insert pricing data
      if (pricingPlaceholders.length > 0) {
        await client.query(
          `
          INSERT INTO cheapest_pricing (
            cruise_id, cheapest_price, interior_price, oceanview_price,
            balcony_price, suite_price, currency
          ) VALUES ${pricingPlaceholders.join(', ')}
          ON CONFLICT (cruise_id) DO UPDATE SET
            cheapest_price = EXCLUDED.cheapest_price,
            interior_price = EXCLUDED.interior_price,
            oceanview_price = EXCLUDED.oceanview_price,
            balcony_price = EXCLUDED.balcony_price,
            suite_price = EXCLUDED.suite_price,
            currency = EXCLUDED.currency
        `,
          pricingValues
        );
      }

      // 2. EXTRACT ITINERARY
      const itineraryValues = [];
      const itineraryPlaceholders = [];
      let itineraryParamCount = 0;

      for (const cruise of batch) {
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
                day.portid || null,
                day.arrivetime || day.arrivaltime || null,
                day.departtime || day.departuretime || null,
                day.description || null,
                portName.toLowerCase().includes('at sea') ||
                  portName.toLowerCase().includes('cruising')
              );

              const base = itineraryParamCount;
              itineraryPlaceholders.push(
                `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`
              );
              itineraryParamCount += 8;
            }
            stats.itinerary.extracted++;
          }
        } catch (err) {
          stats.itinerary.failed++;
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
            arrive_time, depart_time, description, is_sea_day
          ) VALUES ${itineraryPlaceholders.join(', ')}
        `,
          itineraryValues
        );
      }

      // 3. EXTRACT CABIN CATEGORIES
      const cabinValues = [];
      const cabinPlaceholders = [];
      let cabinParamCount = 0;

      for (const cruise of batch) {
        try {
          const raw = cruise.raw_data;
          if (raw.cabins) {
            const cabins = typeof raw.cabins === 'object' ? Object.values(raw.cabins) : [];

            for (const cabin of cabins.slice(0, 10)) {
              // Limit to 10 cabins per cruise for now
              if (cabin && cabin.name) {
                cabinValues.push(
                  cruise.id,
                  cabin.id || cabin.cabinid,
                  cabin.name,
                  cabin.codtype || cabin.type || 'unknown',
                  cabin.description || null,
                  cabin.imageurl || cabin.image || null,
                  cabin.maxoccupancy || cabin.max_occupancy || null,
                  cabin.size || null,
                  cabin.deck || null,
                  cabin.amenities ? JSON.stringify(cabin.amenities) : null
                );

                const base = cabinParamCount;
                cabinPlaceholders.push(
                  `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`
                );
                cabinParamCount += 10;
              }
            }
            if (cabins.length > 0) stats.cabins.extracted++;
          }
        } catch (err) {
          stats.cabins.failed++;
        }
      }

      // Insert cabin data
      if (cabinPlaceholders.length > 0) {
        await client.query(
          `
          INSERT INTO cabin_categories (
            cruise_id, cabin_id, name, cabin_type,
            description, image_url, max_occupancy, size, deck, amenities
          ) VALUES ${cabinPlaceholders.join(', ')}
          ON CONFLICT (cruise_id, cabin_id) DO UPDATE SET
            name = EXCLUDED.name,
            cabin_type = EXCLUDED.cabin_type,
            description = EXCLUDED.description,
            image_url = EXCLUDED.image_url,
            max_occupancy = EXCLUDED.max_occupancy,
            size = EXCLUDED.size,
            deck = EXCLUDED.deck,
            amenities = EXCLUDED.amenities
        `,
          cabinValues
        );
      }

      // Also update the main cruises table with extracted pricing
      await client.query(
        `
        UPDATE cruises c
        SET
          interior_price = cp.interior_price,
          oceanview_price = cp.oceanview_price,
          balcony_price = cp.balcony_price,
          suite_price = cp.suite_price
        FROM cheapest_pricing cp
        WHERE c.id = cp.cruise_id
          AND c.id = ANY($1::varchar[])
      `,
        [batch.map(c => c.id)]
      );
    }

    // Print results
    console.log('\n📊 EXTRACTION RESULTS');
    console.log('-'.repeat(60));
    console.log(`Pricing: ${stats.pricing.extracted} extracted, ${stats.pricing.failed} failed`);
    console.log(
      `Itinerary: ${stats.itinerary.extracted} extracted, ${stats.itinerary.failed} failed`
    );
    console.log(`Cabins: ${stats.cabins.extracted} extracted, ${stats.cabins.failed} failed`);

    // Verify extraction
    const verification = await client.query(
      `
      SELECT
        COUNT(DISTINCT cp.cruise_id) as with_pricing,
        COUNT(DISTINCT ci.cruise_id) as with_itinerary,
        COUNT(DISTINCT cc.cruise_id) as with_cabins
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      LEFT JOIN cruise_itinerary ci ON c.id = ci.cruise_id
      LEFT JOIN cabin_categories cc ON c.id = cc.cruise_id
      WHERE c.cruise_line_id = (SELECT id FROM cruise_lines WHERE name = $1)
    `,
      [cruiseLineName]
    );

    console.log('\n✅ VERIFICATION');
    console.log('-'.repeat(60));
    const v = verification.rows[0];
    console.log(`Cruises with extracted pricing: ${v.with_pricing}`);
    console.log(`Cruises with extracted itinerary: ${v.with_itinerary}`);
    console.log(`Cruises with extracted cabins: ${v.with_cabins}`);
  } catch (error) {
    console.error('❌ Extraction failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n' + '='.repeat(80));
  console.log('Extraction completed at:', new Date().toISOString());
}

// Run extraction
extractAllData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
