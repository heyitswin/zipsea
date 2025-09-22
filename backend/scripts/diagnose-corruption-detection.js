/**
 * Diagnose why corruption detection isn't working
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

async function main() {
  console.log('DIAGNOSING CORRUPTION DETECTION\n');
  console.log('=' .repeat(80));

  try {
    // First, check if we can find corrupted data using the text LIKE query
    console.log('1. Checking for corruption using text pattern...');
    const textCheck = await sql`
      SELECT COUNT(*) as count
      FROM cruises
      WHERE raw_data::text LIKE '{"0":%'
      AND is_active = true
    `;
    console.log(`   Found ${textCheck[0].count} cruises with {"0": pattern in raw_data\n`);

    // Get a specific cruise we know is corrupted (if it exists)
    console.log('2. Checking specific cruise 2144014 (known to be corrupted)...');
    const specific = await sql`
      SELECT
        id,
        name,
        cheapest_price,
        raw_data,
        raw_data::text as raw_text
      FROM cruises
      WHERE id = '2144014'
    `;

    if (specific.length > 0) {
      const cruise = specific[0];
      console.log(`   Found cruise: ${cruise.name}`);
      console.log(`   Cheapest price: $${cruise.cheapest_price}`);

      // Check raw_data type
      console.log(`   Type of raw_data: ${typeof cruise.raw_data}`);
      console.log(`   Is array: ${Array.isArray(cruise.raw_data)}`);
      console.log(`   Keys (first 10):`, Object.keys(cruise.raw_data).slice(0, 10));

      // Check if it has numeric keys
      if (cruise.raw_data['0'] !== undefined) {
        console.log(`   ✅ Has numeric key '0': "${cruise.raw_data['0']}"`);
        console.log(`   Value at '1': "${cruise.raw_data['1']}"`);
        console.log(`   Value at '2': "${cruise.raw_data['2']}"`);
        console.log(`   Length of value at '0': ${cruise.raw_data['0'].length}`);
      } else {
        console.log(`   ❌ No numeric key '0' found`);
        console.log(`   Has 'cheapestinside'?: ${cruise.raw_data.cheapestinside !== undefined}`);
        console.log(`   Has 'cheapest'?: ${cruise.raw_data.cheapest !== undefined}`);
      }

      // Show raw text pattern
      console.log(`   Raw text starts with: ${cruise.raw_text.substring(0, 100)}...`);
    } else {
      console.log('   Cruise 2144014 not found\n');
    }

    // Get samples of cheap cruises that should be corrupted
    console.log('\n3. Checking cruises with suspiciously low prices (<$100)...');
    const cheap = await sql`
      SELECT
        id,
        name,
        cheapest_price,
        raw_data
      FROM cruises
      WHERE cheapest_price::decimal < 100
      AND sailing_date >= '2025-10-01'
      AND is_active = true
      LIMIT 5
    `;

    console.log(`   Found ${cheap.length} cheap cruises:\n`);

    for (const cruise of cheap) {
      console.log(`   Cruise ${cruise.id}: $${cruise.cheapest_price}`);

      // Check structure
      const hasNumericKeys = cruise.raw_data['0'] !== undefined;
      const hasNormalKeys = cruise.raw_data.cheapestinside !== undefined ||
                            cruise.raw_data.cheapest !== undefined;

      if (hasNumericKeys) {
        console.log(`     ✅ HAS NUMERIC KEYS - Character array!`);
        console.log(`     First 3 chars: "${cruise.raw_data['0']}${cruise.raw_data['1']}${cruise.raw_data['2']}"`);
      } else if (hasNormalKeys) {
        console.log(`     ❌ Has normal structure`);
        if (cruise.raw_data.cheapestinside) {
          console.log(`     cheapestinside: ${cruise.raw_data.cheapestinside}`);
        }
      } else {
        console.log(`     ⚠️  Unknown structure`);
        console.log(`     Keys:`, Object.keys(cruise.raw_data).slice(0, 5));
      }
    }

    // Test the isCharacterArray function
    console.log('\n4. Testing isCharacterArray function...');

    function isCharacterArray(rawData) {
      if (typeof rawData === 'object' && rawData !== null && !Array.isArray(rawData)) {
        if (rawData['0'] !== undefined && rawData['1'] !== undefined && rawData['2'] !== undefined) {
          if (typeof rawData['0'] === 'string' && rawData['0'].length === 1) {
            return true;
          }
        }
      }
      return false;
    }

    // Test with a sample
    if (cheap.length > 0) {
      const testCruise = cheap[0];
      const result = isCharacterArray(testCruise.raw_data);
      console.log(`   Testing cruise ${testCruise.id}:`);
      console.log(`   isCharacterArray returned: ${result}`);
      console.log(`   raw_data['0'] exists: ${testCruise.raw_data['0'] !== undefined}`);
      if (testCruise.raw_data['0'] !== undefined) {
        console.log(`   Type of raw_data['0']: ${typeof testCruise.raw_data['0']}`);
        console.log(`   Value: "${testCruise.raw_data['0']}"`);
        console.log(`   Length: ${testCruise.raw_data['0'].length}`);
      }
    }

    // Final check: Count how many have the numeric key pattern
    console.log('\n5. Counting cruises with numeric keys in raw_data...');
    const sample = await sql`
      SELECT
        raw_data
      FROM cruises
      WHERE is_active = true
      AND raw_data IS NOT NULL
      LIMIT 1000
    `;

    let withNumericKeys = 0;
    let withNormalKeys = 0;

    for (const row of sample) {
      if (row.raw_data['0'] !== undefined) {
        withNumericKeys++;
      } else if (row.raw_data.cheapestinside !== undefined || row.raw_data.cheapest !== undefined) {
        withNormalKeys++;
      }
    }

    console.log(`   Out of 1000 sample cruises:`);
    console.log(`   ${withNumericKeys} have numeric keys (corrupted)`);
    console.log(`   ${withNormalKeys} have normal structure`);
    console.log(`   ${1000 - withNumericKeys - withNormalKeys} have other structure`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
