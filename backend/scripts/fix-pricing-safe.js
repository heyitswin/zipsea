/**
 * SAFE version of pricing fix script with:
 * - Dry run mode for testing
 * - Concurrency protection
 * - Transaction support
 * - Detailed logging
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const USE_STAGING = args.includes('--staging');
const LIMIT = args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || null;

// Database configuration
let databaseUrl;
if (USE_STAGING) {
  databaseUrl = process.env.DATABASE_URL || 'postgresql://zipsea_user:YROzJArXNhDGLj83p9xtVwhQb7oEmPIE@dpg-cslkgnq3esus73fb1du0-a.oregon-postgres.render.com/zipsea_db';
  console.log('Using STAGING database');
} else {
  databaseUrl = process.env.DATABASE_URL_PRODUCTION || 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';
  console.log('Using PRODUCTION database');
}

const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
});

async function fixPricingSafe() {
  console.log('=' .repeat(80));
  console.log('SAFE PRICING FIX SCRIPT');
  console.log('=' .repeat(80));
  console.log();
  console.log('Mode:', DRY_RUN ? '🔍 DRY RUN (no changes will be made)' : '⚠️  LIVE MODE');
  console.log('Database:', USE_STAGING ? 'STAGING' : 'PRODUCTION');
  if (LIMIT) console.log('Limit:', LIMIT, 'cruises');
  console.log();

  try {
    // Get count of eligible cruises (skip recently updated ones to avoid conflicts)
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM cruises
      WHERE raw_data IS NOT NULL
      AND is_active = true
      AND (
        updated_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
        OR updated_at IS NULL
      )
      ${LIMIT ? sql`LIMIT ${LIMIT}` : sql``}
    `;

    const totalCruises = parseInt(countResult[0].total);
    console.log(`Found ${totalCruises} cruises to check (excluding recently updated)`);
    console.log();

    if (totalCruises === 0) {
      console.log('No cruises to process');
      return;
    }

    // Process in batches
    const batchSize = 50; // Smaller batches for safety
    let totalFixed = 0;
    let totalChecked = 0;
    let totalSkipped = 0;
    const fixes = [];
    const errors = [];

    for (let offset = 0; offset < (LIMIT ? Math.min(LIMIT, totalCruises) : totalCruises); offset += batchSize) {
      const cruises = await sql`
        SELECT
          id,
          cruise_id,
          name,
          cruise_line_id,
          sailing_date,
          interior_price,
          oceanview_price,
          balcony_price,
          suite_price,
          cheapest_price,
          raw_data,
          updated_at
        FROM cruises
        WHERE raw_data IS NOT NULL
        AND is_active = true
        AND (
          updated_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
          OR updated_at IS NULL
        )
        ORDER BY id
        LIMIT ${batchSize}
        OFFSET ${offset}
      `;

      for (const cruise of cruises) {
        totalChecked++;

        // Double-check cruise hasn't been updated in last few seconds (race condition protection)
        const recheckResult = await sql`
          SELECT updated_at
          FROM cruises
          WHERE id = ${cruise.id}
          AND updated_at >= CURRENT_TIMESTAMP - INTERVAL '10 seconds'
        `;

        if (recheckResult.length > 0) {
          console.log(`⏭️  Skipping cruise ${cruise.id} - recently updated`);
          totalSkipped++;
          continue;
        }

        // Parse raw_data
        let rawData;
        try {
          rawData = typeof cruise.raw_data === 'string'
            ? JSON.parse(cruise.raw_data)
            : cruise.raw_data;
        } catch (e) {
          errors.push({
            id: cruise.id,
            name: cruise.name,
            error: 'Cannot parse raw_data'
          });
          continue;
        }

        // Extract correct prices from cheapestX fields
        let correctPrices = {
          interior: null,
          oceanview: null,
          balcony: null,
          suite: null
        };

        // Check if we have direct cheapestX fields
        const hasDirectCheapest =
          rawData.cheapestinside !== undefined ||
          rawData.cheapestoutside !== undefined ||
          rawData.cheapestbalcony !== undefined ||
          rawData.cheapestsuite !== undefined;

        if (hasDirectCheapest) {
          // Handle Riviera Travel special case (line 329)
          const isRiviera = cruise.cruise_line_id === 329;

          const extractPrice = (value) => {
            if (value === undefined || value === null) return null;

            // If it's an object with price property
            if (typeof value === 'object' && value.price !== undefined) {
              value = value.price;
            }

            let price = parseFloat(value);
            if (isNaN(price) || price <= 0) return null;

            // Apply Riviera Travel fix
            if (isRiviera) {
              price = price / 1000;
            }

            return price;
          };

          correctPrices.interior = extractPrice(rawData.cheapestinside);
          correctPrices.oceanview = extractPrice(rawData.cheapestoutside);
          correctPrices.balcony = extractPrice(rawData.cheapestbalcony);
          correctPrices.suite = extractPrice(rawData.cheapestsuite);
        } else {
          // Skip if no direct cheapest fields (we don't want to use cached data)
          continue;
        }

        // Calculate what would be updated
        const updates = {};
        const changes = [];

        if (correctPrices.interior !== null && Math.abs(parseFloat(cruise.interior_price || 0) - correctPrices.interior) > 0.01) {
          updates.interior_price = correctPrices.interior.toString();
          changes.push(`Interior: ${cruise.interior_price} → ${correctPrices.interior}`);
        }

        if (correctPrices.oceanview !== null && Math.abs(parseFloat(cruise.oceanview_price || 0) - correctPrices.oceanview) > 0.01) {
          updates.oceanview_price = correctPrices.oceanview.toString();
          changes.push(`Oceanview: ${cruise.oceanview_price} → ${correctPrices.oceanview}`);
        }

        if (correctPrices.balcony !== null && Math.abs(parseFloat(cruise.balcony_price || 0) - correctPrices.balcony) > 0.01) {
          updates.balcony_price = correctPrices.balcony.toString();
          changes.push(`Balcony: ${cruise.balcony_price} → ${correctPrices.balcony}`);
        }

        if (correctPrices.suite !== null && Math.abs(parseFloat(cruise.suite_price || 0) - correctPrices.suite) > 0.01) {
          updates.suite_price = correctPrices.suite.toString();
          changes.push(`Suite: ${cruise.suite_price} → ${correctPrices.suite}`);
        }

        if (Object.keys(updates).length > 0) {
          // Calculate new cheapest price
          const allPrices = [
            correctPrices.interior || parseFloat(cruise.interior_price),
            correctPrices.oceanview || parseFloat(cruise.oceanview_price),
            correctPrices.balcony || parseFloat(cruise.balcony_price),
            correctPrices.suite || parseFloat(cruise.suite_price)
          ].filter(p => p && p > 0);

          if (allPrices.length > 0) {
            updates.cheapest_price = Math.min(...allPrices).toString();
          }

          fixes.push({
            id: cruise.id,
            name: cruise.name,
            sailing_date: cruise.sailing_date,
            changes: changes
          });

          if (!DRY_RUN) {
            try {
              // Use a transaction for safety
              await sql.begin(async sql => {
                await sql`
                  UPDATE cruises
                  SET
                    interior_price = ${updates.interior_price || cruise.interior_price},
                    oceanview_price = ${updates.oceanview_price || cruise.oceanview_price},
                    balcony_price = ${updates.balcony_price || cruise.balcony_price},
                    suite_price = ${updates.suite_price || cruise.suite_price},
                    cheapest_price = ${updates.cheapest_price || cruise.cheapest_price},
                    updated_at = CURRENT_TIMESTAMP
                  WHERE id = ${cruise.id}
                  AND (
                    updated_at < CURRENT_TIMESTAMP - INTERVAL '5 seconds'
                    OR updated_at IS NULL
                  )
                `;
              });
              totalFixed++;
            } catch (updateError) {
              errors.push({
                id: cruise.id,
                name: cruise.name,
                error: updateError.message
              });
              console.log(`❌ Failed to update cruise ${cruise.id}: ${updateError.message}`);
            }
          } else {
            totalFixed++; // Count as "would be fixed" in dry run
          }
        }

        // Progress indicator
        if (totalChecked % 50 === 0) {
          console.log(`Progress: ${totalChecked}/${LIMIT || totalCruises} checked, ${totalFixed} ${DRY_RUN ? 'would be' : ''} fixed, ${totalSkipped} skipped`);
        }
      }
    }

    // Summary
    console.log();
    console.log('=' .repeat(80));
    console.log('SUMMARY');
    console.log('=' .repeat(80));
    console.log(`Total cruises checked: ${totalChecked}`);
    console.log(`Total cruises ${DRY_RUN ? 'to be' : ''} fixed: ${totalFixed}`);
    console.log(`Total cruises skipped (recently updated): ${totalSkipped}`);
    console.log(`Total errors: ${errors.length}`);
    console.log(`Percentage ${DRY_RUN ? 'to be' : ''} fixed: ${(totalFixed / totalChecked * 100).toFixed(1)}%`);
    console.log();

    // Show sample of fixes
    if (fixes.length > 0) {
      console.log(`Sample of fixes ${DRY_RUN ? 'to be' : ''} applied:`);
      console.log();

      fixes.slice(0, 10).forEach(fix => {
        console.log(`Cruise ${fix.id}: ${fix.name}`);
        console.log(`  Sailing: ${new Date(fix.sailing_date).toISOString().split('T')[0]}`);
        fix.changes.forEach(change => {
          console.log(`  ${change}`);
        });
        console.log();
      });

      if (fixes.length > 10) {
        console.log(`... and ${fixes.length - 10} more fixes`);
      }
    }

    // Show errors if any
    if (errors.length > 0) {
      console.log();
      console.log('ERRORS:');
      errors.slice(0, 5).forEach(err => {
        console.log(`  Cruise ${err.id} (${err.name}): ${err.error}`);
      });
      if (errors.length > 5) {
        console.log(`  ... and ${errors.length - 5} more errors`);
      }
    }

    // Test specific cruise if not in dry run
    if (!DRY_RUN) {
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
    }

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await sql.end();
  }
}

// Show help
if (args.includes('--help')) {
  console.log('Usage: node fix-pricing-safe.js [options]');
  console.log();
  console.log('Options:');
  console.log('  --dry-run    Run in dry-run mode (no changes)');
  console.log('  --staging    Use staging database');
  console.log('  --limit=N    Limit to N cruises');
  console.log('  --help       Show this help');
  console.log();
  console.log('Examples:');
  console.log('  node fix-pricing-safe.js --dry-run --staging --limit=10');
  console.log('  node fix-pricing-safe.js --dry-run');
  console.log('  node fix-pricing-safe.js');
  process.exit(0);
}

// Confirmation for production
if (!DRY_RUN && !USE_STAGING) {
  console.log('⚠️  WARNING: This will update prices in PRODUCTION database!');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
  console.log('(Use --dry-run to test without making changes)');
  setTimeout(fixPricingSafe, 5000);
} else {
  fixPricingSafe();
}
