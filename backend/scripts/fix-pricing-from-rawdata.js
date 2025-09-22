/**
 * Batch update script to fix cruise prices using cheapestX fields from raw_data
 * This corrects prices that were incorrectly extracted from cheapest.combined
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Force use production database
const databaseUrl =
  process.env.DATABASE_URL_PRODUCTION ||
  'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';
if (!databaseUrl.includes('production') && !databaseUrl.includes('d2idqjjipnbc73abma3g')) {
  console.error('❌ Not using production database! Aborting.');
  process.exit(1);
}
const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
});

async function fixPricing() {
  console.log('='.repeat(80));
  console.log('FIXING CRUISE PRICING FROM RAW DATA');
  console.log('='.repeat(80));
  console.log();
  console.log('Database:', databaseUrl?.includes('production') ? 'PRODUCTION' : 'STAGING');
  console.log();

  try {
    // First, get a count of cruises with raw_data
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM cruises
      WHERE raw_data IS NOT NULL
      AND is_active = true
    `;

    const totalCruises = parseInt(countResult[0].total);
    console.log(`Found ${totalCruises} cruises with raw_data to check`);
    console.log();

    // Process in batches to avoid memory issues
    const batchSize = 100;
    let totalFixed = 0;
    let totalChecked = 0;
    const fixes = [];

    for (let offset = 0; offset < totalCruises; offset += batchSize) {
      const cruises = await sql`
        SELECT
          id,
          cruise_id,
          name,
          cruise_line_id,
          interior_price,
          oceanview_price,
          balcony_price,
          suite_price,
          raw_data
        FROM cruises
        WHERE raw_data IS NOT NULL
        AND is_active = true
        ORDER BY id
        LIMIT ${batchSize}
        OFFSET ${offset}
      `;

      for (const cruise of cruises) {
        totalChecked++;

        // Parse raw_data
        let rawData;
        try {
          rawData =
            typeof cruise.raw_data === 'string' ? JSON.parse(cruise.raw_data) : cruise.raw_data;
        } catch (e) {
          console.log(`⚠️  Cannot parse raw_data for cruise ${cruise.id}`);
          continue;
        }

        // Extract correct prices from cheapestX fields (prioritize these)
        let correctPrices = {
          interior: null,
          oceanview: null,
          balcony: null,
          suite: null,
        };

        // First priority: Direct cheapestX fields (most reliable)
        if (
          rawData.cheapestinside !== undefined ||
          rawData.cheapestoutside !== undefined ||
          rawData.cheapestbalcony !== undefined ||
          rawData.cheapestsuite !== undefined
        ) {
          // Handle Riviera Travel special case (line 329)
          const isRiviera = cruise.cruise_line_id === 329;

          const extractPrice = value => {
            if (value === undefined || value === null) return null;

            // If it's an object with price property
            if (typeof value === 'object' && value.price !== undefined) {
              value = value.price;
            }

            let price = parseFloat(value);
            if (isNaN(price)) return null;

            // Apply Riviera Travel fix
            if (isRiviera) {
              price = price / 1000;
            }

            return price > 0 ? price : null;
          };

          correctPrices.interior = extractPrice(rawData.cheapestinside);
          correctPrices.oceanview = extractPrice(rawData.cheapestoutside);
          correctPrices.balcony = extractPrice(rawData.cheapestbalcony);
          correctPrices.suite = extractPrice(rawData.cheapestsuite);
        }
        // Fallback to cheapest.prices if no direct cheapestX fields
        else if (rawData.cheapest?.prices) {
          correctPrices.interior = parseFloat(rawData.cheapest.prices.inside) || null;
          correctPrices.oceanview = parseFloat(rawData.cheapest.prices.outside) || null;
          correctPrices.balcony = parseFloat(rawData.cheapest.prices.balcony) || null;
          correctPrices.suite = parseFloat(rawData.cheapest.prices.suite) || null;
        }

        // Check if any prices need updating
        const needsUpdate =
          (correctPrices.interior !== null &&
            Math.abs(parseFloat(cruise.interior_price) - correctPrices.interior) > 0.01) ||
          (correctPrices.oceanview !== null &&
            Math.abs(parseFloat(cruise.oceanview_price) - correctPrices.oceanview) > 0.01) ||
          (correctPrices.balcony !== null &&
            Math.abs(parseFloat(cruise.balcony_price) - correctPrices.balcony) > 0.01) ||
          (correctPrices.suite !== null &&
            Math.abs(parseFloat(cruise.suite_price) - correctPrices.suite) > 0.01);

        if (needsUpdate) {
          fixes.push({
            id: cruise.id,
            name: cruise.name,
            old: {
              interior: cruise.interior_price,
              oceanview: cruise.oceanview_price,
              balcony: cruise.balcony_price,
              suite: cruise.suite_price,
            },
            new: correctPrices,
          });

          // Update the cruise
          await sql`
            UPDATE cruises
            SET
              interior_price = ${correctPrices.interior?.toString() || cruise.interior_price},
              oceanview_price = ${correctPrices.oceanview?.toString() || cruise.oceanview_price},
              balcony_price = ${correctPrices.balcony?.toString() || cruise.balcony_price},
              suite_price = ${correctPrices.suite?.toString() || cruise.suite_price},
              cheapest_price = ${Math.min(
                ...[
                  correctPrices.interior,
                  correctPrices.oceanview,
                  correctPrices.balcony,
                  correctPrices.suite,
                ].filter(p => p !== null && p > 0)
              ).toString()},
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${cruise.id}
          `;

          totalFixed++;
        }

        // Progress indicator
        if (totalChecked % 100 === 0) {
          console.log(`Progress: ${totalChecked}/${totalCruises} checked, ${totalFixed} fixed`);
        }
      }
    }

    // Summary
    console.log();
    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total cruises checked: ${totalChecked}`);
    console.log(`Total cruises fixed: ${totalFixed}`);
    console.log(`Percentage fixed: ${((totalFixed / totalChecked) * 100).toFixed(1)}%`);
    console.log();

    // Show sample of fixes
    if (fixes.length > 0) {
      console.log('Sample of fixes applied:');
      console.log();

      fixes.slice(0, 5).forEach(fix => {
        console.log(`Cruise ${fix.id}: ${fix.name}`);
        console.log('  Interior:  $' + fix.old.interior + ' → $' + fix.new.interior);
        console.log('  Oceanview: $' + fix.old.oceanview + ' → $' + fix.new.oceanview);
        console.log('  Balcony:   $' + fix.old.balcony + ' → $' + fix.new.balcony);
        console.log('  Suite:     $' + fix.old.suite + ' → $' + fix.new.suite);
        console.log();
      });

      if (fixes.length > 5) {
        console.log(`... and ${fixes.length - 5} more fixes`);
      }
    }

    // Test cruise 2144014
    console.log();
    console.log('VERIFICATION - Cruise 2144014:');
    const verifyResult = await sql`
      SELECT
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price
      FROM cruises
      WHERE id = '2144014'
    `;

    if (verifyResult.length > 0) {
      const v = verifyResult[0];
      console.log('  Interior:  $', v.interior_price);
      console.log('  Oceanview: $', v.oceanview_price);
      console.log('  Balcony:   $', v.balcony_price);
      console.log('  Suite:     $', v.suite_price);
      console.log('  Cheapest:  $', v.cheapest_price);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

// Add confirmation prompt for production
if (databaseUrl?.includes('production')) {
  console.log('⚠️  WARNING: This will update prices in PRODUCTION database!');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
  setTimeout(fixPricing, 5000);
} else {
  fixPricing();
}
