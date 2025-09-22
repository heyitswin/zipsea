/**
 * Complete pricing fix that handles all data structures:
 * 1. Direct cheapestX fields (most reliable)
 * 2. cheapest.prices (second best)
 * 3. Never uses cheapest.cachedprices or cheapest.combined
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const USE_STAGING = args.includes('--staging');
const LIMIT = args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || null;
const SPECIFIC_CRUISE = args.find(arg => arg.startsWith('--cruise='))?.split('=')[1] || null;

// Database configuration
let databaseUrl;
if (USE_STAGING) {
  databaseUrl =
    process.env.DATABASE_URL ||
    'postgresql://zipsea_user:YROzJArXNhDGLj83p9xtVwhQb7oEmPIE@dpg-cslkgnq3esus73fb1du0-a.oregon-postgres.render.com/zipsea_db';
  console.log('Using STAGING database');
} else {
  databaseUrl =
    process.env.DATABASE_URL_PRODUCTION ||
    'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';
  console.log('Using PRODUCTION database');
}

const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
});

async function fixPricingComplete() {
  console.log('='.repeat(80));
  console.log('COMPLETE PRICING FIX SCRIPT');
  console.log('='.repeat(80));
  console.log();
  console.log('Mode:', DRY_RUN ? '🔍 DRY RUN (no changes will be made)' : '⚠️  LIVE MODE');
  console.log('Database:', USE_STAGING ? 'STAGING' : 'PRODUCTION');
  if (LIMIT) console.log('Limit:', LIMIT, 'cruises');
  if (SPECIFIC_CRUISE) console.log('Specific cruise:', SPECIFIC_CRUISE);
  console.log();

  try {
    // Build query conditions
    let whereClause = `
      WHERE raw_data IS NOT NULL
      AND is_active = true
      AND (
        updated_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
        OR updated_at IS NULL
      )
    `;

    if (SPECIFIC_CRUISE) {
      whereClause = `WHERE id = '${SPECIFIC_CRUISE}'`;
    }

    // Get count of eligible cruises
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM cruises
      ${sql.unsafe(whereClause)}
      ${LIMIT && !SPECIFIC_CRUISE ? sql`LIMIT ${LIMIT}` : sql``}
    `;

    const totalCruises = parseInt(countResult[0].total);
    console.log(`Found ${totalCruises} cruises to check`);
    console.log();

    if (totalCruises === 0) {
      console.log('No cruises to process');
      return;
    }

    // Process in batches (or single for specific cruise)
    const batchSize = SPECIFIC_CRUISE ? 1 : 50;
    let totalFixed = 0;
    let totalChecked = 0;
    let totalSkipped = 0;
    const fixes = [];
    const errors = [];

    const maxToProcess = SPECIFIC_CRUISE ? 1 : LIMIT ? Math.min(LIMIT, totalCruises) : totalCruises;

    for (let offset = 0; offset < maxToProcess; offset += batchSize) {
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
        ${sql.unsafe(whereClause)}
        ORDER BY id
        LIMIT ${batchSize}
        OFFSET ${SPECIFIC_CRUISE ? 0 : offset}
      `;

      for (const cruise of cruises) {
        totalChecked++;

        // Skip if recently updated (unless specific cruise)
        if (!SPECIFIC_CRUISE) {
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
        }

        // Parse raw_data
        let rawData;
        try {
          rawData =
            typeof cruise.raw_data === 'string' ? JSON.parse(cruise.raw_data) : cruise.raw_data;
        } catch (e) {
          errors.push({
            id: cruise.id,
            name: cruise.name,
            error: 'Cannot parse raw_data',
          });
          continue;
        }

        // Extract correct prices with priority order
        let correctPrices = {
          interior: null,
          oceanview: null,
          balcony: null,
          suite: null,
        };

        // Handle special cases for specific cruise lines
        const isRiviera = cruise.cruise_line_id === 329;

        const extractPrice = value => {
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

        // Priority 1: Direct cheapestX fields
        if (rawData.cheapestinside !== undefined) {
          correctPrices.interior = extractPrice(rawData.cheapestinside);
        }
        if (rawData.cheapestoutside !== undefined) {
          correctPrices.oceanview = extractPrice(rawData.cheapestoutside);
        }
        if (rawData.cheapestbalcony !== undefined) {
          correctPrices.balcony = extractPrice(rawData.cheapestbalcony);
        }
        if (rawData.cheapestsuite !== undefined) {
          correctPrices.suite = extractPrice(rawData.cheapestsuite);
        }

        // Priority 2: cheapest.prices (if any price is still null)
        if (rawData.cheapest?.prices) {
          if (correctPrices.interior === null && rawData.cheapest.prices.inside !== undefined) {
            correctPrices.interior = extractPrice(rawData.cheapest.prices.inside);
          }
          if (correctPrices.oceanview === null && rawData.cheapest.prices.outside !== undefined) {
            correctPrices.oceanview = extractPrice(rawData.cheapest.prices.outside);
          }
          if (correctPrices.balcony === null && rawData.cheapest.prices.balcony !== undefined) {
            correctPrices.balcony = extractPrice(rawData.cheapest.prices.balcony);
          }
          if (correctPrices.suite === null && rawData.cheapest.prices.suite !== undefined) {
            correctPrices.suite = extractPrice(rawData.cheapest.prices.suite);
          }
        }

        // Never use cheapest.cachedprices or cheapest.combined - these are stale!

        // Log what we found for specific cruise
        if (SPECIFIC_CRUISE) {
          console.log('Raw data structure for cruise', cruise.id, ':');
          console.log('- Direct cheapestX fields:');
          console.log('  cheapestinside:', rawData.cheapestinside);
          console.log('  cheapestoutside:', rawData.cheapestoutside);
          console.log('  cheapestbalcony:', rawData.cheapestbalcony);
          console.log('  cheapestsuite:', rawData.cheapestsuite);

          if (rawData.cheapest) {
            console.log(
              '- cheapest.prices:',
              rawData.cheapest.prices ? JSON.stringify(rawData.cheapest.prices) : 'not found'
            );
            console.log(
              '- cheapest.cachedprices:',
              rawData.cheapest.cachedprices ? 'found (stale)' : 'not found'
            );
            console.log(
              '- cheapest.combined:',
              rawData.cheapest.combined ? 'found (stale)' : 'not found'
            );
          }

          console.log('\nExtracted correct prices:');
          console.log('  Interior:', correctPrices.interior);
          console.log('  Oceanview:', correctPrices.oceanview);
          console.log('  Balcony:', correctPrices.balcony);
          console.log('  Suite:', correctPrices.suite);
          console.log();
        }

        // Calculate what would be updated
        const updates = {};
        const changes = [];

        if (
          correctPrices.interior !== null &&
          Math.abs(parseFloat(cruise.interior_price || 0) - correctPrices.interior) > 0.01
        ) {
          updates.interior_price = correctPrices.interior.toString();
          changes.push(`Interior: ${cruise.interior_price} → ${correctPrices.interior}`);
        }

        if (
          correctPrices.oceanview !== null &&
          Math.abs(parseFloat(cruise.oceanview_price || 0) - correctPrices.oceanview) > 0.01
        ) {
          updates.oceanview_price = correctPrices.oceanview.toString();
          changes.push(`Oceanview: ${cruise.oceanview_price} → ${correctPrices.oceanview}`);
        }

        if (
          correctPrices.balcony !== null &&
          Math.abs(parseFloat(cruise.balcony_price || 0) - correctPrices.balcony) > 0.01
        ) {
          updates.balcony_price = correctPrices.balcony.toString();
          changes.push(`Balcony: ${cruise.balcony_price} → ${correctPrices.balcony}`);
        }

        if (
          correctPrices.suite !== null &&
          Math.abs(parseFloat(cruise.suite_price || 0) - correctPrices.suite) > 0.01
        ) {
          updates.suite_price = correctPrices.suite.toString();
          changes.push(`Suite: ${cruise.suite_price} → ${correctPrices.suite}`);
        }

        if (Object.keys(updates).length > 0) {
          // Calculate new cheapest price
          const allPrices = [
            correctPrices.interior || parseFloat(cruise.interior_price),
            correctPrices.oceanview || parseFloat(cruise.oceanview_price),
            correctPrices.balcony || parseFloat(cruise.balcony_price),
            correctPrices.suite || parseFloat(cruise.suite_price),
          ].filter(p => p && p > 0);

          if (allPrices.length > 0) {
            const newCheapest = Math.min(...allPrices);
            if (Math.abs(parseFloat(cruise.cheapest_price || 0) - newCheapest) > 0.01) {
              updates.cheapest_price = newCheapest.toString();
              changes.push(`Cheapest: ${cruise.cheapest_price} → ${newCheapest}`);
            }
          }

          fixes.push({
            id: cruise.id,
            name: cruise.name,
            sailing_date: cruise.sailing_date,
            changes: changes,
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
                  ${
                    !SPECIFIC_CRUISE
                      ? sql`
                    AND (
                      updated_at < CURRENT_TIMESTAMP - INTERVAL '5 seconds'
                      OR updated_at IS NULL
                    )
                  `
                      : sql``
                  }
                `;
              });
              totalFixed++;
              console.log(`✅ Fixed cruise ${cruise.id}: ${cruise.name}`);
            } catch (updateError) {
              errors.push({
                id: cruise.id,
                name: cruise.name,
                error: updateError.message,
              });
              console.log(`❌ Failed to update cruise ${cruise.id}: ${updateError.message}`);
            }
          } else {
            totalFixed++; // Count as "would be fixed" in dry run
          }
        } else {
          if (SPECIFIC_CRUISE) {
            console.log('No changes needed - prices are already correct');
          }
        }

        // Progress indicator
        if (!SPECIFIC_CRUISE && totalChecked % 50 === 0) {
          console.log(
            `Progress: ${totalChecked}/${maxToProcess} checked, ${totalFixed} ${DRY_RUN ? 'would be' : ''} fixed, ${totalSkipped} skipped`
          );
        }
      }
    }

    // Summary
    console.log();
    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total cruises checked: ${totalChecked}`);
    console.log(`Total cruises ${DRY_RUN ? 'to be' : ''} fixed: ${totalFixed}`);
    console.log(`Total cruises skipped (recently updated): ${totalSkipped}`);
    console.log(`Total errors: ${errors.length}`);

    if (totalChecked > 0) {
      console.log(
        `Percentage ${DRY_RUN ? 'to be' : ''} fixed: ${((totalFixed / totalChecked) * 100).toFixed(1)}%`
      );
    }
    console.log();

    // Show sample of fixes
    if (fixes.length > 0 && !SPECIFIC_CRUISE) {
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

    // Verify specific cruise after update
    if (!DRY_RUN && (SPECIFIC_CRUISE || fixes.find(f => f.id === '2144014'))) {
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
  console.log('Usage: node fix-pricing-complete.js [options]');
  console.log();
  console.log('Options:');
  console.log('  --dry-run     Run in dry-run mode (no changes)');
  console.log('  --staging     Use staging database');
  console.log('  --limit=N     Limit to N cruises');
  console.log('  --cruise=ID   Fix specific cruise by ID');
  console.log('  --help        Show this help');
  console.log();
  console.log('Examples:');
  console.log('  node fix-pricing-complete.js --cruise=2144014 --dry-run');
  console.log('  node fix-pricing-complete.js --dry-run --limit=100');
  console.log('  node fix-pricing-complete.js --cruise=2144014');
  process.exit(0);
}

// Confirmation for production
if (!DRY_RUN && !USE_STAGING && !SPECIFIC_CRUISE) {
  console.log('⚠️  WARNING: This will update prices in PRODUCTION database!');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
  console.log('(Use --dry-run to test without making changes)');
  setTimeout(fixPricingComplete, 5000);
} else {
  fixPricingComplete();
}
