// Check ALL cruises in database for raw_data corruption
// This is to identify the full scope of the character array issue

const postgres = require('postgres');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prodUrl =
  process.env.DATABASE_URL_PRODUCTION ||
  'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';
const sql = postgres(prodUrl, { ssl: { rejectUnauthorized: false } });

async function checkAllCruises() {
  console.log('=== CHECKING ALL CRUISES FOR RAW_DATA CORRUPTION ===\n');
  console.log('This will examine EVERY cruise in the database for character array corruption.\n');

  try {
    // Get total count first
    const countResult = await sql`SELECT COUNT(*) FROM cruises WHERE is_active = true`;
    const totalCruises = parseInt(countResult[0].count);
    console.log(`Total active cruises to check: ${totalCruises}\n`);

    // Process in batches to avoid memory issues
    const BATCH_SIZE = 1000;
    let offset = 0;
    let corruptedCruises = [];
    let processedCount = 0;
    let noRawDataCount = 0;
    let validJsonCount = 0;

    while (offset < totalCruises) {
      const cruises = await sql`
        SELECT
          c.id,
          c.cruise_line_id,
          cl.name as cruise_line_name,
          c.ship_id,
          s.name as ship_name,
          c.sailing_date,
          c.nights as duration_nights,
          c.interior_price,
          c.oceanview_price,
          c.balcony_price,
          c.suite_price,
          c.cheapest_price,
          c.raw_data,
          c.name as cruise_name
        FROM cruises c
        LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        LEFT JOIN ships s ON c.ship_id = s.id
        WHERE c.is_active = true
        ORDER BY c.id
        LIMIT ${BATCH_SIZE} OFFSET ${offset}
      `;

      for (const cruise of cruises) {
        processedCount++;

        // Progress indicator
        if (processedCount % 100 === 0) {
          process.stdout.write(
            `\rProcessed: ${processedCount}/${totalCruises} (${Math.round((processedCount / totalCruises) * 100)}%)`
          );
        }

        if (!cruise.raw_data) {
          noRawDataCount++;
          continue;
        }

        const rd = cruise.raw_data;

        // Check if it's the character array corruption pattern
        if (typeof rd === 'object' && !Array.isArray(rd) && rd['0'] !== undefined) {
          // Try to reconstruct and check if it's valid JSON
          let reconstructed = '';
          let i = 0;
          while (rd[i.toString()] !== undefined && i < 10000000) {
            reconstructed += rd[i.toString()];
            i++;
          }

          try {
            const parsed = JSON.parse(reconstructed);

            // Extract correct prices from reconstructed data
            let correctPrices = {
              inside: null,
              outside: null,
              balcony: null,
              suite: null,
            };

            // First priority: direct cheapestX fields
            if (parsed.cheapestinside !== undefined)
              correctPrices.inside = parseFloat(parsed.cheapestinside);
            if (parsed.cheapestoutside !== undefined)
              correctPrices.outside = parseFloat(parsed.cheapestoutside);
            if (parsed.cheapestbalcony !== undefined)
              correctPrices.balcony = parseFloat(parsed.cheapestbalcony);
            if (parsed.cheapestsuite !== undefined)
              correctPrices.suite = parseFloat(parsed.cheapestsuite);

            // Second priority: cheapest.prices fields
            if (!correctPrices.inside && parsed.cheapest?.prices?.inside !== undefined) {
              correctPrices.inside = parseFloat(parsed.cheapest.prices.inside);
            }
            if (!correctPrices.outside && parsed.cheapest?.prices?.oceanview !== undefined) {
              correctPrices.outside = parseFloat(parsed.cheapest.prices.oceanview);
            }
            if (!correctPrices.balcony && parsed.cheapest?.prices?.balcony !== undefined) {
              correctPrices.balcony = parseFloat(parsed.cheapest.prices.balcony);
            }
            if (!correctPrices.suite && parsed.cheapest?.prices?.suite !== undefined) {
              correctPrices.suite = parseFloat(parsed.cheapest.prices.suite);
            }

            // Handle Riviera Travel special case
            if (cruise.cruise_line_id === 329) {
              Object.keys(correctPrices).forEach(key => {
                if (correctPrices[key]) correctPrices[key] = correctPrices[key] / 1000;
              });
            }

            // Check for pricing discrepancies
            let hasError = false;
            let errors = [];

            const checkPrice = (dbPrice, ftpPrice, type) => {
              if (ftpPrice && dbPrice) {
                const dbVal = parseFloat(dbPrice);
                const ftpVal = parseFloat(ftpPrice);
                if (Math.abs(ftpVal - dbVal) > 1) {
                  const errorPct = Math.round((1 - dbVal / ftpVal) * 100);
                  errors.push(`${type}: DB=$${dbVal} vs FTP=$${ftpVal} (${errorPct}% error)`);
                  return true;
                }
              }
              return false;
            };

            if (checkPrice(cruise.interior_price, correctPrices.inside, 'inside')) hasError = true;
            if (checkPrice(cruise.oceanview_price, correctPrices.outside, 'outside'))
              hasError = true;
            if (checkPrice(cruise.balcony_price, correctPrices.balcony, 'balcony')) hasError = true;
            if (checkPrice(cruise.suite_price, correctPrices.suite, 'suite')) hasError = true;

            if (hasError || i > 1000) {
              // Also flag if raw_data is suspiciously large
              corruptedCruises.push({
                id: cruise.id,
                cruise_line: cruise.cruise_line_name || `Line ${cruise.cruise_line_id}`,
                ship: cruise.ship_name || `Ship ${cruise.ship_id}`,
                name: cruise.cruise_name,
                sailing_date: cruise.sailing_date,
                duration: cruise.duration_nights,
                raw_data_chars: i,
                errors: errors.length > 0 ? errors : ['Raw data stored as character array'],
                db_prices: {
                  inside: parseFloat(cruise.interior_price) || null,
                  outside: parseFloat(cruise.oceanview_price) || null,
                  balcony: parseFloat(cruise.balcony_price) || null,
                  suite: parseFloat(cruise.suite_price) || null,
                  cheapest: parseFloat(cruise.cheapest_price) || null,
                },
                correct_prices: correctPrices,
              });
            }
          } catch (e) {
            // Couldn't parse reconstructed data
            corruptedCruises.push({
              id: cruise.id,
              cruise_line: cruise.cruise_line_name || `Line ${cruise.cruise_line_id}`,
              ship: cruise.ship_name || `Ship ${cruise.ship_id}`,
              name: cruise.cruise_name,
              sailing_date: cruise.sailing_date,
              duration: cruise.duration_nights,
              error: 'Character array corruption - cannot parse',
              db_prices: {
                inside: parseFloat(cruise.interior_price) || null,
                outside: parseFloat(cruise.oceanview_price) || null,
                balcony: parseFloat(cruise.balcony_price) || null,
                suite: parseFloat(cruise.suite_price) || null,
                cheapest: parseFloat(cruise.cheapest_price) || null,
              },
            });
          }
        } else {
          // Check if it's valid JSON
          try {
            if (typeof rd === 'string') {
              JSON.parse(rd);
            }
            validJsonCount++;
          } catch (e) {
            // Some other form of corruption
            corruptedCruises.push({
              id: cruise.id,
              cruise_line: cruise.cruise_line_name || `Line ${cruise.cruise_line_id}`,
              ship: cruise.ship_name || `Ship ${cruise.ship_id}`,
              name: cruise.cruise_name,
              sailing_date: cruise.sailing_date,
              error: 'Invalid JSON in raw_data',
              db_prices: {
                inside: parseFloat(cruise.interior_price) || null,
                outside: parseFloat(cruise.oceanview_price) || null,
                balcony: parseFloat(cruise.balcony_price) || null,
                suite: parseFloat(cruise.suite_price) || null,
                cheapest: parseFloat(cruise.cheapest_price) || null,
              },
            });
          }
        }
      }

      offset += BATCH_SIZE;
    }

    console.log('\n\n=== FINAL RESULTS ===\n');
    console.log(`Total cruises checked: ${processedCount}`);
    console.log(`Cruises with valid JSON: ${validJsonCount}`);
    console.log(`Cruises without raw_data: ${noRawDataCount}`);
    console.log(`CORRUPTED CRUISES FOUND: ${corruptedCruises.length}\n`);

    if (corruptedCruises.length > 0) {
      console.log('=== CORRUPTION BREAKDOWN BY CRUISE LINE ===\n');
      const byLine = {};
      corruptedCruises.forEach(c => {
        if (!byLine[c.cruise_line]) byLine[c.cruise_line] = [];
        byLine[c.cruise_line].push(c);
      });

      Object.entries(byLine)
        .sort((a, b) => b[1].length - a[1].length)
        .forEach(([line, cruises]) => {
          console.log(`${line}: ${cruises.length} corrupted cruises`);
        });

      // Show severity distribution
      console.log('\n=== PRICE ERROR SEVERITY ===\n');
      let severe = 0,
        moderate = 0,
        minor = 0;

      corruptedCruises.forEach(c => {
        if (c.errors && c.errors.length > 0) {
          const maxError = Math.max(
            ...c.errors.map(e => {
              const match = e.match(/\((-?\d+)% error\)/);
              return match ? Math.abs(parseInt(match[1])) : 0;
            })
          );

          if (maxError > 50) severe++;
          else if (maxError > 20) moderate++;
          else if (maxError > 0) minor++;
        }
      });

      console.log(`Severe errors (>50% price difference): ${severe}`);
      console.log(`Moderate errors (20-50% difference): ${moderate}`);
      console.log(`Minor errors (<20% difference): ${minor}`);

      // Calculate percentage of database affected
      const corruptionRate = ((corruptedCruises.length / processedCount) * 100).toFixed(2);
      console.log(`\n🚨 CORRUPTION RATE: ${corruptionRate}% of active cruises affected`);

      if (parseFloat(corruptionRate) > 50) {
        console.log('\n⚠️  WARNING: MAJORITY OF DATABASE IS CORRUPTED!');
        console.log('This is affecting most cruises in production!');
      }

      // Save detailed results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `corruption-check-all-${timestamp}.json`;
      await fs.writeFile(
        filename,
        JSON.stringify(
          {
            summary: {
              total_checked: processedCount,
              corrupted: corruptedCruises.length,
              valid_json: validJsonCount,
              no_raw_data: noRawDataCount,
              corruption_rate: `${corruptionRate}%`,
            },
            by_cruise_line: byLine,
            corrupted_cruises: corruptedCruises,
          },
          null,
          2
        )
      );

      console.log(`\nDetailed results saved to: ${filename}`);

      // Show sample of worst cases
      console.log('\n=== WORST CASES (Top 10 by price error) ===\n');
      const worst = corruptedCruises
        .filter(c => c.errors && c.errors.length > 0)
        .sort((a, b) => {
          const aMax = Math.max(
            ...a.errors.map(e => {
              const match = e.match(/\((-?\d+)% error\)/);
              return match ? Math.abs(parseInt(match[1])) : 0;
            })
          );
          const bMax = Math.max(
            ...b.errors.map(e => {
              const match = e.match(/\((-?\d+)% error\)/);
              return match ? Math.abs(parseInt(match[1])) : 0;
            })
          );
          return bMax - aMax;
        })
        .slice(0, 10);

      worst.forEach((c, i) => {
        console.log(`${i + 1}. Cruise ${c.id} - ${c.cruise_line} ${c.ship}`);
        console.log(`   Name: ${c.name}`);
        console.log(
          `   Sailing: ${new Date(c.sailing_date).toLocaleDateString()}, ${c.duration} nights`
        );
        c.errors.forEach(e => console.log(`   - ${e}`));
        console.log();
      });
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

checkAllCruises();
