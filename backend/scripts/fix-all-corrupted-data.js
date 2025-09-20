const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function reconstructJsonFromCorrupted(corruptedData) {
  // Check if data is actually corrupted (has numeric string keys)
  const keys = Object.keys(corruptedData);
  const hasNumericKeys = keys.some(key => /^\d+$/.test(key));

  if (!hasNumericKeys) {
    // Not corrupted, return as-is
    return corruptedData;
  }

  // Reconstruct the JSON string from character-by-character storage
  let jsonString = '';
  let index = 0;

  while (corruptedData[index.toString()] !== undefined) {
    jsonString += corruptedData[index.toString()];
    index++;
  }

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Failed to parse reconstructed JSON:', error.message);
    return null;
  }
}

async function fixAllCorruptedData() {
  console.log('🔧 Fixing all corrupted raw_data across all cruise lines...\n');

  try {
    // Get cruise lines with issues (<95% accuracy)
    const problemLines = [
      'Azamara', 'Explora Journeys', 'Celestyal Cruises', 'Norwegian Cruise Line',
      'Seabourn Cruise Line', 'Silversea Cruises', 'Fred Olsen', 'Hapag Lloyd Cruises',
      'Hurtigruten', 'Ambassador Cruise Line', 'Saga Cruises', 'Windstar Cruises',
      'Star Clippers', 'Viking Ocean Cruises'
    ];

    let totalFixed = 0;
    let totalFailed = 0;
    let totalAlreadyValid = 0;

    for (const lineName of problemLines) {
      // Get cruise line ID
      const lineResult = await pool.query(
        `SELECT id, name FROM cruise_lines WHERE LOWER(name) LIKE LOWER($1)`,
        [`%${lineName}%`]
      );

      if (lineResult.rows.length === 0) {
        console.log(`⚠️  ${lineName} not found in database`);
        continue;
      }

      const cruiseLine = lineResult.rows[0];
      console.log(`\n📊 Processing ${cruiseLine.name} (ID: ${cruiseLine.id})`);

      // Get all cruises with raw_data for this line
      const cruisesResult = await pool.query(`
        SELECT
          c.id,
          c.cruise_id,
          c.name,
          c.raw_data
        FROM cruises c
        WHERE c.cruise_line_id = $1
          AND c.raw_data IS NOT NULL
        ORDER BY c.updated_at DESC
      `, [cruiseLine.id]);

      console.log(`  Found ${cruisesResult.rows.length} cruises with raw_data`);

      let lineFixedCount = 0;
      let lineAlreadyValidCount = 0;
      let lineFailedCount = 0;

      for (const cruise of cruisesResult.rows) {
        const rawData = cruise.raw_data;

        // Check if data is corrupted
        const keys = Object.keys(rawData);
        const hasNumericKeys = keys.some(key => /^\d+$/.test(key));

        if (!hasNumericKeys) {
          lineAlreadyValidCount++;
          continue;
        }

        const reconstructedData = reconstructJsonFromCorrupted(rawData);

        if (!reconstructedData) {
          lineFailedCount++;
          continue;
        }

        // Update the cruise with reconstructed data
        await pool.query(`
          UPDATE cruises
          SET raw_data = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [reconstructedData, cruise.id]);

        // Extract and update prices
        let prices = {
          interior: null,
          oceanview: null,
          balcony: null,
          suite: null
        };

        // Priority 1: Top-level cheapest fields
        if (reconstructedData.cheapestinside || reconstructedData.cheapestoutside ||
            reconstructedData.cheapestbalcony || reconstructedData.cheapestsuite) {
          prices.interior = parseFloat(String(reconstructedData.cheapestinside || '0').replace(/[^0-9.-]/g, '')) || null;
          prices.oceanview = parseFloat(String(reconstructedData.cheapestoutside || '0').replace(/[^0-9.-]/g, '')) || null;
          prices.balcony = parseFloat(String(reconstructedData.cheapestbalcony || '0').replace(/[^0-9.-]/g, '')) || null;
          prices.suite = parseFloat(String(reconstructedData.cheapestsuite || '0').replace(/[^0-9.-]/g, '')) || null;
        }
        // Priority 2: cheapest.combined
        else if (reconstructedData.cheapest && reconstructedData.cheapest.combined) {
          prices.interior = parseFloat(String(reconstructedData.cheapest.combined.inside || '0').replace(/[^0-9.-]/g, '')) || null;
          prices.oceanview = parseFloat(String(reconstructedData.cheapest.combined.outside || '0').replace(/[^0-9.-]/g, '')) || null;
          prices.balcony = parseFloat(String(reconstructedData.cheapest.combined.balcony || '0').replace(/[^0-9.-]/g, '')) || null;
          prices.suite = parseFloat(String(reconstructedData.cheapest.combined.suite || '0').replace(/[^0-9.-]/g, '')) || null;
        }
        // Priority 3: cheapest.prices
        else if (reconstructedData.cheapest && reconstructedData.cheapest.prices) {
          prices.interior = parseFloat(String(reconstructedData.cheapest.prices.inside || '0').replace(/[^0-9.-]/g, '')) || null;
          prices.oceanview = parseFloat(String(reconstructedData.cheapest.prices.outside || '0').replace(/[^0-9.-]/g, '')) || null;
          prices.balcony = parseFloat(String(reconstructedData.cheapest.prices.balcony || '0').replace(/[^0-9.-]/g, '')) || null;
          prices.suite = parseFloat(String(reconstructedData.cheapest.prices.suite || '0').replace(/[^0-9.-]/g, '')) || null;
        }

        // Update cheapest_pricing table
        await pool.query(`
          INSERT INTO cheapest_pricing (
            cruise_id,
            interior_price,
            oceanview_price,
            balcony_price,
            suite_price,
            last_updated
          ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
          ON CONFLICT (cruise_id)
          DO UPDATE SET
            interior_price = EXCLUDED.interior_price,
            oceanview_price = EXCLUDED.oceanview_price,
            balcony_price = EXCLUDED.balcony_price,
            suite_price = EXCLUDED.suite_price,
            last_updated = CURRENT_TIMESTAMP
        `, [cruise.id, prices.interior, prices.oceanview, prices.balcony, prices.suite]);

        lineFixedCount++;
      }

      console.log(`  ✅ Fixed: ${lineFixedCount}`);
      console.log(`  ⏭️  Already valid: ${lineAlreadyValidCount}`);
      console.log(`  ❌ Failed: ${lineFailedCount}`);

      totalFixed += lineFixedCount;
      totalAlreadyValid += lineAlreadyValidCount;
      totalFailed += lineFailedCount;
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 OVERALL FIX SUMMARY:');
    console.log('='.repeat(80));
    console.log(`Total cruises fixed: ${totalFixed}`);
    console.log(`Already valid: ${totalAlreadyValid}`);
    console.log(`Failed to fix: ${totalFailed}`);
    console.log(`Success rate: ${totalFixed + totalFailed > 0 ? ((totalFixed/(totalFixed+totalFailed))*100).toFixed(1) : 100}%`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixAllCorruptedData();
