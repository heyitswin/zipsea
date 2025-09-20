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
    return corruptedData;
  }

  // Reconstruct the JSON string
  let jsonString = '';
  let index = 0;

  while (corruptedData[index.toString()] !== undefined) {
    jsonString += corruptedData[index.toString()];
    index++;
  }

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return null;
  }
}

async function fixCorruptedDataBatch() {
  console.log('🔧 Fixing corrupted raw_data in batches...\n');

  try {
    // First, count total corrupted records
    console.log('📊 Counting corrupted records...');
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM cruises
      WHERE raw_data::text LIKE '%"0":%'
        AND raw_data::text LIKE '%"1":%'
        AND raw_data::text LIKE '%"2":%'
    `);

    const totalCorrupted = parseInt(countResult.rows[0].total);
    console.log(`Found ${totalCorrupted} potentially corrupted records\n`);

    if (totalCorrupted === 0) {
      console.log('✅ No corrupted records found!');
      return;
    }

    const BATCH_SIZE = 100;
    let offset = 0;
    let totalFixed = 0;
    let totalFailed = 0;

    while (offset < totalCorrupted) {
      console.log(`\nProcessing batch ${Math.floor(offset/BATCH_SIZE) + 1} (records ${offset + 1}-${Math.min(offset + BATCH_SIZE, totalCorrupted)})`);

      // Get batch of corrupted records
      const batchResult = await pool.query(`
        SELECT
          c.id,
          c.cruise_id,
          c.name,
          c.raw_data,
          cl.name as cruise_line_name
        FROM cruises c
        JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        WHERE c.raw_data::text LIKE '%"0":%'
          AND c.raw_data::text LIKE '%"1":%'
          AND c.raw_data::text LIKE '%"2":%'
        ORDER BY c.id
        LIMIT $1 OFFSET $2
      `, [BATCH_SIZE, offset]);

      let batchFixed = 0;
      let batchFailed = 0;

      for (const cruise of batchResult.rows) {
        const reconstructedData = reconstructJsonFromCorrupted(cruise.raw_data);

        if (!reconstructedData) {
          console.log(`  ❌ Failed: ${cruise.cruise_line_name} - ${cruise.cruise_id}`);
          batchFailed++;
          continue;
        }

        // Update cruise with reconstructed data
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

        batchFixed++;
      }

      console.log(`  Batch results: Fixed ${batchFixed}, Failed ${batchFailed}`);
      totalFixed += batchFixed;
      totalFailed += batchFailed;

      offset += BATCH_SIZE;

      // Show progress
      const progress = Math.min(100, Math.round((offset / totalCorrupted) * 100));
      console.log(`  Progress: ${progress}%`);
    }

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 FIX COMPLETE:');
    console.log('='.repeat(80));
    console.log(`Total processed: ${totalFixed + totalFailed}`);
    console.log(`✅ Successfully fixed: ${totalFixed}`);
    console.log(`❌ Failed to fix: ${totalFailed}`);
    console.log(`Success rate: ${totalFixed + totalFailed > 0 ? ((totalFixed/(totalFixed+totalFailed))*100).toFixed(1) : 100}%`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixCorruptedDataBatch();
