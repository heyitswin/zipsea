/**
 * Test if current syncs are still creating corrupted raw_data
 * This will check recently updated cruises to see if they have the character array issue
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prodUrl =
  process.env.DATABASE_URL_PRODUCTION ||
  'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';
const sql = postgres(prodUrl, { ssl: { rejectUnauthorized: false } });

function isCharacterArray(rawData) {
  // Check if raw_data has numeric string keys "0", "1", "2", etc.
  if (typeof rawData === 'object' && rawData !== null) {
    // Check for sequential numeric keys starting from 0
    if (rawData['0'] !== undefined && rawData['1'] !== undefined && rawData['2'] !== undefined) {
      // Check if values are single characters
      if (
        typeof rawData['0'] === 'string' &&
        rawData['0'].length === 1 &&
        typeof rawData['1'] === 'string' &&
        rawData['1'].length === 1
      ) {
        return true;
      }
    }
  }
  return false;
}

function reconstructJsonFromCharArray(rawData) {
  if (!isCharacterArray(rawData)) {
    return rawData;
  }

  // Reconstruct the JSON string from character array
  let jsonString = '';
  let i = 0;
  const maxChars = 10000000; // Safety limit

  while (rawData[i.toString()] !== undefined && i < maxChars) {
    jsonString += rawData[i.toString()];
    i++;
  }

  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('Failed to parse reconstructed JSON:', e.message);
    return null;
  }
}

async function main() {
  console.log('=' .repeat(80));
  console.log('TESTING CURRENT SYNC CORRUPTION STATUS');
  console.log('=' .repeat(80));
  console.log();

  try {
    // Get cruises updated in the last 24 hours
    console.log('Checking cruises updated in the last 24 hours...\n');

    const recentCruises = await sql`
      SELECT
        id,
        cruise_id,
        name,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price,
        updated_at,
        raw_data,
        cruise_line_id
      FROM cruises
      WHERE updated_at >= NOW() - INTERVAL '24 hours'
      AND raw_data IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 20
    `;

    console.log(`Found ${recentCruises.length} recently updated cruises\n`);

    let corruptedCount = 0;
    let validCount = 0;
    const corruptedCruises = [];

    for (const cruise of recentCruises) {
      const isCorrupted = isCharacterArray(cruise.raw_data);

      if (isCorrupted) {
        corruptedCount++;
        corruptedCruises.push(cruise);
        console.log(`❌ CORRUPTED: Cruise ${cruise.id} (${cruise.name})`);
        console.log(`   Updated: ${cruise.updated_at}`);
        console.log(`   Line ID: ${cruise.cruise_line_id}`);

        // Try to reconstruct and check prices
        const reconstructed = reconstructJsonFromCharArray(cruise.raw_data);
        if (reconstructed) {
          const realInterior = parseFloat(reconstructed.cheapestinside) || null;
          const dbInterior = parseFloat(cruise.interior_price) || null;

          if (realInterior && dbInterior) {
            const priceDiff = Math.abs(realInterior - dbInterior);
            if (priceDiff > 0.01) {
              console.log(`   ⚠️  Price mismatch: DB shows $${dbInterior}, should be $${realInterior}`);
            }
          }
        }
      } else {
        validCount++;
        console.log(`✅ VALID: Cruise ${cruise.id} (${cruise.name})`);
        console.log(`   Updated: ${cruise.updated_at}`);
      }
    }

    console.log('\n' + '=' .repeat(80));
    console.log('SUMMARY OF RECENT SYNCS:');
    console.log('=' .repeat(80));
    console.log(`Total checked: ${recentCruises.length}`);
    console.log(`Valid: ${validCount} (${(validCount/recentCruises.length*100).toFixed(1)}%)`);
    console.log(`Corrupted: ${corruptedCount} (${(corruptedCount/recentCruises.length*100).toFixed(1)}%)`);

    if (corruptedCount > 0) {
      console.log('\n⚠️  WARNING: New syncs are STILL creating corrupted data!');
      console.log('The webhook processor needs to be fixed immediately to prevent further corruption.');

      // Show details of one corrupted cruise
      console.log('\nExample of corrupted data structure:');
      const example = corruptedCruises[0];
      console.log(`Cruise ${example.id}:`);
      console.log('First 5 characters in raw_data:');
      for (let i = 0; i < 5; i++) {
        console.log(`  "${i}": "${example.raw_data[i.toString()]}"`);
      }
    } else {
      console.log('\n✅ GOOD NEWS: Recent syncs are NOT creating corrupted data!');
      console.log('The webhook processor appears to be working correctly.');
    }

    // Also check cruises updated in different time windows
    console.log('\n' + '=' .repeat(80));
    console.log('CORRUPTION TREND ANALYSIS:');
    console.log('=' .repeat(80));

    const timeWindows = [
      { interval: '1 hour', label: 'Last hour' },
      { interval: '6 hours', label: 'Last 6 hours' },
      { interval: '24 hours', label: 'Last 24 hours' },
      { interval: '7 days', label: 'Last 7 days' },
    ];

    for (const window of timeWindows) {
      const stats = await sql`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN raw_data::text LIKE '%"0":%"1":%"2":%' THEN 1 END) as corrupted
        FROM cruises
        WHERE updated_at >= NOW() - INTERVAL ${window.interval}
        AND raw_data IS NOT NULL
      `;

      const total = parseInt(stats[0].total);
      const corrupted = parseInt(stats[0].corrupted);
      const percentage = total > 0 ? (corrupted / total * 100).toFixed(1) : 0;

      console.log(`${window.label}: ${corrupted}/${total} corrupted (${percentage}%)`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
