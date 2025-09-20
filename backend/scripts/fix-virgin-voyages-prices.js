#!/usr/bin/env node
require('dotenv').config();
const postgres = require('postgres');

const client = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function fixVirginVoyagesPrices() {
  try {
    console.log('🚢 FIXING VIRGIN VOYAGES PRICING');
    console.log('=' .repeat(60));

    // Get all Virgin Voyages cruises
    const cruises = await client`
      SELECT
        c.id,
        c.name,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        c.raw_data,
        cl.name as cruise_line
      FROM cruises c
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE cl.name = 'Virgin Voyages'
        AND c.raw_data IS NOT NULL
      ORDER BY c.id
    `;

    console.log(`Found ${cruises.length} Virgin Voyages cruises to check\n`);

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const cruise of cruises) {
      try {
        let rawData = cruise.raw_data;

        // Parse if string
        if (typeof rawData === 'string') {
          rawData = JSON.parse(rawData);
        }

        // Skip corrupted data
        if (rawData && typeof rawData === 'object' && rawData['0'] !== undefined) {
          console.log(`⚠️  ${cruise.id}: Skipping - raw_data corrupted`);
          errors++;
          continue;
        }

        // Extract correct prices from top-level or cheapest.prices (NOT cheapest.combined)
        let correctPrices = {
          interior: null,
          oceanview: null,
          balcony: null,
          suite: null
        };

        // Priority 1: Top-level fields (most accurate for Virgin)
        if (rawData.cheapestinside || rawData.cheapestoutside || rawData.cheapestbalcony || rawData.cheapestsuite) {
          correctPrices.interior = parseFloat(String(rawData.cheapestinside || '0').replace(/[^0-9.-]/g, '')) || null;
          correctPrices.oceanview = parseFloat(String(rawData.cheapestoutside || '0').replace(/[^0-9.-]/g, '')) || null;
          correctPrices.balcony = parseFloat(String(rawData.cheapestbalcony || '0').replace(/[^0-9.-]/g, '')) || null;
          correctPrices.suite = parseFloat(String(rawData.cheapestsuite || '0').replace(/[^0-9.-]/g, '')) || null;
        }
        // Priority 2: cheapest.prices (also correct for Virgin)
        else if (rawData.cheapest && rawData.cheapest.prices) {
          correctPrices.interior = parseFloat(String(rawData.cheapest.prices.inside || '0')) || null;
          correctPrices.oceanview = parseFloat(String(rawData.cheapest.prices.outside || '0')) || null;
          correctPrices.balcony = parseFloat(String(rawData.cheapest.prices.balcony || '0')) || null;
          correctPrices.suite = parseFloat(String(rawData.cheapest.prices.suite || '0')) || null;
        }

        // Check if update is needed
        const dbPrices = {
          interior: parseFloat(cruise.interior_price || '0') || null,
          oceanview: parseFloat(cruise.oceanview_price || '0') || null,
          balcony: parseFloat(cruise.balcony_price || '0') || null,
          suite: parseFloat(cruise.suite_price || '0') || null
        };

        let needsUpdate = false;
        const tolerance = 0.01;

        for (const cabin of ['interior', 'oceanview', 'balcony', 'suite']) {
          if (correctPrices[cabin] && dbPrices[cabin]) {
            if (Math.abs(correctPrices[cabin] - dbPrices[cabin]) > tolerance) {
              needsUpdate = true;
              break;
            }
          }
        }

        if (needsUpdate) {
          console.log(`📝 Updating ${cruise.id} (${cruise.name}):`);
          console.log(`   Interior: $${dbPrices.interior} → $${correctPrices.interior}`);
          console.log(`   Oceanview: $${dbPrices.oceanview} → $${correctPrices.oceanview}`);
          console.log(`   Balcony: $${dbPrices.balcony} → $${correctPrices.balcony}`);
          console.log(`   Suite: $${dbPrices.suite} → $${correctPrices.suite}`);

          // Calculate cheapest price
          const validPrices = Object.values(correctPrices).filter(p => p && p > 0);
          const cheapestPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

          // Update database
          await client`
            UPDATE cruises
            SET
              interior_price = ${correctPrices.interior},
              oceanview_price = ${correctPrices.oceanview},
              balcony_price = ${correctPrices.balcony},
              suite_price = ${correctPrices.suite},
              cheapest_price = ${cheapestPrice},
              updated_at = NOW()
            WHERE id = ${cruise.id}
          `;

          // Also update cheapest_pricing table
          await client`
            UPDATE cheapest_pricing
            SET
              interior_price = ${correctPrices.interior},
              oceanview_price = ${correctPrices.oceanview},
              balcony_price = ${correctPrices.balcony},
              suite_price = ${correctPrices.suite},
              cheapest_price = ${cheapestPrice},
              last_updated = NOW()
            WHERE cruise_id = ${cruise.id}
          `;

          fixed++;
        } else {
          console.log(`✅ ${cruise.id}: Prices already correct`);
          skipped++;
        }

      } catch (error) {
        console.log(`❌ ${cruise.id}: Error - ${error.message}`);
        errors++;
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log('📊 RESULTS:');
    console.log(`✅ Fixed: ${fixed} cruises`);
    console.log(`⏭️  Skipped (already correct): ${skipped} cruises`);
    console.log(`❌ Errors: ${errors} cruises`);

    if (fixed > 0) {
      console.log('\n✨ Virgin Voyages prices have been corrected!');
      console.log('The webhook processor should be updated to use the correct price extraction logic.');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

// Run if this is the main module
if (require.main === module) {
  fixVirginVoyagesPrices();
}

module.exports = { fixVirginVoyagesPrices };
