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

async function fixDisneyCorruptedData() {
  console.log('🔧 Fixing Disney Cruise Line corrupted raw_data...\n');

  try {
    // Get Disney Cruise Line ID
    const lineResult = await pool.query(
      `SELECT id, name FROM cruise_lines WHERE LOWER(name) LIKE '%disney%'`
    );

    if (lineResult.rows.length === 0) {
      console.log('❌ Disney Cruise Line not found');
      return;
    }

    const disneyLine = lineResult.rows[0];
    console.log(`Found: ${disneyLine.name} (ID: ${disneyLine.id})\n`);

    // Get all Disney cruises with raw_data
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
    `, [disneyLine.id]);

    console.log(`Found ${cruisesResult.rows.length} Disney cruises with raw_data\n`);

    let fixedCount = 0;
    let alreadyValidCount = 0;
    let failedCount = 0;

    for (const cruise of cruisesResult.rows) {
      const rawData = cruise.raw_data;

      // Check if data is corrupted
      const keys = Object.keys(rawData);
      const hasNumericKeys = keys.some(key => /^\d+$/.test(key));

      if (!hasNumericKeys) {
        alreadyValidCount++;
        continue;
      }

      console.log(`Fixing cruise ${cruise.cruise_id}: ${cruise.name}`);

      const reconstructedData = reconstructJsonFromCorrupted(rawData);

      if (!reconstructedData) {
        console.log(`  ❌ Failed to reconstruct data`);
        failedCount++;
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

      console.log(`  ✅ Fixed and updated prices: Interior=$${prices.interior}, Ocean=$${prices.oceanview}, Balcony=$${prices.balcony}, Suite=$${prices.suite}`);
      fixedCount++;
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 DISNEY CRUISE LINE FIX SUMMARY:');
    console.log('='.repeat(80));
    console.log(`Total cruises examined: ${cruisesResult.rows.length}`);
    console.log(`Already valid: ${alreadyValidCount}`);
    console.log(`Fixed: ${fixedCount}`);
    console.log(`Failed: ${failedCount}`);
    console.log(`Success rate: ${((fixedCount/(fixedCount+failedCount))*100).toFixed(1)}%`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixDisneyCorruptedData();
