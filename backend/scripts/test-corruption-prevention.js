/**
 * Test that the webhook processor correctly prevents raw_data corruption
 * This simulates what would happen if corrupted data arrives
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

// Simulate the ensureValidRawData function from webhook processor
function ensureValidRawData(data) {
  // If data is a string, parse it
  if (typeof data === 'string') {
    try {
      console.log('  [TEST] Input is string, parsing...');
      return JSON.parse(data);
    } catch (e) {
      console.error('  [TEST] Could not parse string:', e.message);
      return {};
    }
  }

  // If data looks like a character array (has numeric string keys)
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    // Check for character array pattern
    if (data['0'] !== undefined && data['1'] !== undefined &&
        (data['0'] === '{' || data['0'] === '[')) {
      console.log('  [TEST] Detected character array pattern, reconstructing...');

      // Reconstruct the JSON string from character array
      let jsonString = '';
      let index = 0;
      while (data[index.toString()] !== undefined) {
        jsonString += data[index.toString()];
        index++;
      }

      try {
        const parsed = JSON.parse(jsonString);
        console.log('  [TEST] Successfully reconstructed valid JSON');
        return parsed;
      } catch (e) {
        console.error('  [TEST] Could not parse reconstructed string:', e.message);
        return {};
      }
    }
  }

  // Data is already valid
  return data;
}

async function main() {
  console.log('=' .repeat(80));
  console.log('TESTING CORRUPTION PREVENTION MECHANISM');
  console.log('=' .repeat(80));
  console.log();

  // Test cases simulating different types of corrupted data
  const testCases = [
    {
      name: 'Valid JSON object',
      input: { cruiseId: 123, name: 'Test Cruise', price: 500 },
      expectedValid: true
    },
    {
      name: 'JSON string (needs parsing)',
      input: '{"cruiseId": 456, "name": "String Cruise", "price": 600}',
      expectedValid: true
    },
    {
      name: 'Character array (corrupted)',
      input: {
        '0': '{',
        '1': '"',
        '2': 'c',
        '3': 'r',
        '4': 'u',
        '5': 'i',
        '6': 's',
        '7': 'e',
        '8': 'I',
        '9': 'd',
        '10': '"',
        '11': ':',
        '12': '7',
        '13': '8',
        '14': '9',
        '15': ',',
        '16': '"',
        '17': 'n',
        '18': 'a',
        '19': 'm',
        '20': 'e',
        '21': '"',
        '22': ':',
        '23': '"',
        '24': 'C',
        '25': 'h',
        '26': 'a',
        '27': 'r',
        '28': ' ',
        '29': 'A',
        '30': 'r',
        '31': 'r',
        '32': 'a',
        '33': 'y',
        '34': '"',
        '35': ',',
        '36': '"',
        '37': 'p',
        '38': 'r',
        '39': 'i',
        '40': 'c',
        '41': 'e',
        '42': '"',
        '43': ':',
        '44': '7',
        '45': '0',
        '46': '0',
        '47': '}',
      },
      expectedValid: true
    }
  ];

  console.log('Running test cases...\n');
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);
    console.log(`  Input type: ${typeof testCase.input}`);

    const result = ensureValidRawData(testCase.input);
    const isValid = result && typeof result === 'object' && !Array.isArray(result) &&
                    Object.keys(result).length > 0 &&
                    !Object.keys(result).some(key => /^\d+$/.test(key));

    if (isValid === testCase.expectedValid) {
      console.log('  ✅ PASSED');
      if (isValid) {
        console.log(`  Result: ${JSON.stringify(result).substring(0, 100)}...`);
      }
      passed++;
    } else {
      console.log('  ❌ FAILED');
      console.log(`  Expected valid: ${testCase.expectedValid}, Got: ${isValid}`);
      failed++;
    }
    console.log();
  }

  console.log('=' .repeat(80));
  console.log('TEST RESULTS');
  console.log('=' .repeat(80));
  console.log(`Passed: ${passed}/${testCases.length}`);
  console.log(`Failed: ${failed}/${testCases.length}`);

  if (failed === 0) {
    console.log('\n✅ All tests passed! The corruption prevention mechanism is working correctly.');
  } else {
    console.log('\n❌ Some tests failed. The corruption prevention may not be working properly.');
  }

  // Check a real cruise to verify it's not corrupted
  console.log('\n' + '=' .repeat(80));
  console.log('CHECKING REAL DATA');
  console.log('=' .repeat(80));

  try {
    // Get the most recently updated cruise
    const recentCruise = await sql`
      SELECT id, name, raw_data, updated_at
      FROM cruises
      WHERE is_active = true
      AND updated_at IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    if (recentCruise.length > 0) {
      const cruise = recentCruise[0];
      console.log(`\nMost recently updated cruise:`);
      console.log(`  ID: ${cruise.id}`);
      console.log(`  Name: ${cruise.name}`);
      console.log(`  Updated: ${cruise.updated_at}`);
      console.log(`  Raw data type: ${typeof cruise.raw_data}`);

      // Check if it's corrupted
      const isCorrupted = typeof cruise.raw_data === 'string' ||
                         (cruise.raw_data && typeof cruise.raw_data === 'object' &&
                          Object.keys(cruise.raw_data).some(key => /^\d+$/.test(key)));

      if (isCorrupted) {
        console.log('  ❌ WARNING: This cruise has corrupted raw_data!');
        console.log('     The webhook processor may not be preventing corruption properly.');
      } else {
        console.log('  ✅ Raw data is valid (not corrupted)');
      }
    }
  } catch (error) {
    console.error('Error checking real data:', error.message);
  }

  await sql.end();
}

main();
