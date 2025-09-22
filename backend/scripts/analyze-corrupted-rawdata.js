/**
 * Analyze corrupted raw_data issue
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prodUrl = process.env.DATABASE_URL_PRODUCTION || 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';
const sql = postgres(prodUrl, { ssl: { rejectUnauthorized: false } });

async function main() {
  console.log('=' .repeat(80));
  console.log('ANALYZING CORRUPTED RAW_DATA');
  console.log('=' .repeat(80));
  console.log();

  try {
    // Get sample of corrupted cruises
    const samples = await sql`
      SELECT
        id,
        cruise_id,
        name,
        cheapest_price,
        sailing_date,
        updated_at,
        raw_data::text as raw_text,
        LENGTH(raw_data::text) as raw_size,
        created_at
      FROM cruises
      WHERE cheapest_price::decimal < 300
      AND sailing_date >= '2025-10-01'
      AND is_active = true
      ORDER BY cheapest_price ASC
      LIMIT 5
    `;

    console.log('SAMPLE OF CORRUPTED DATA:');
    console.log('=' .repeat(80));

    for (const cruise of samples) {
      console.log(`\nCruise ${cruise.id}: ${cruise.name}`);
      console.log(`  Price: $${cruise.cheapest_price}`);
      console.log(`  Raw data size: ${cruise.raw_size} bytes`);
      console.log(`  Created: ${cruise.created_at}`);
      console.log(`  Updated: ${cruise.updated_at}`);

      // Check if it's the numeric key pattern
      if (cruise.raw_text.includes('"0":') && cruise.raw_text.includes('"1":') && cruise.raw_text.includes('"2":')) {
        console.log('  ❌ CORRUPTED: Contains numeric keys pattern');

        // Extract a sample to see what the values are
        const match = cruise.raw_text.match(/"0":"([^"]+)"/);
        if (match) {
          console.log(`  Sample value at key "0": "${match[1]}"`);
        }
      } else if (cruise.raw_text.includes('cheapest')) {
        console.log('  ✅ VALID: Contains proper cruise data structure');
      } else {
        console.log('  ⚠️  UNKNOWN: Different data structure');
      }
    }

    // Get statistics
    console.log();
    console.log('CORRUPTION STATISTICS:');
    console.log('=' .repeat(80));

    const stats = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN raw_data::text LIKE '%"0":%"1":%"2":%' THEN 1 END) as corrupted,
        COUNT(CASE WHEN raw_data::text LIKE '%cheapest%' THEN 1 END) as valid,
        MIN(updated_at) as oldest_update,
        MAX(updated_at) as newest_update
      FROM cruises
      WHERE cheapest_price::decimal < 300
      AND sailing_date >= '2025-10-01'
      AND is_active = true
    `;

    console.log(`Total cruises under $300: ${stats[0].total}`);
    console.log(`Corrupted (numeric keys): ${stats[0].corrupted} (${(stats[0].corrupted/stats[0].total*100).toFixed(1)}%)`);
    console.log(`Valid structure: ${stats[0].valid} (${(stats[0].valid/stats[0].total*100).toFixed(1)}%)`);
    console.log(`Oldest update: ${stats[0].oldest_update}`);
    console.log(`Newest update: ${stats[0].newest_update}`);

    // Check if these are actually character arrays
    console.log();
    console.log('ANALYZING CORRUPTION PATTERN:');
    console.log('=' .repeat(80));

    const testCruise = await sql`
      SELECT raw_data
      FROM cruises
      WHERE id = '2148689'
    `;

    if (testCruise[0]?.raw_data) {
      const rd = testCruise[0].raw_data;

      // Check if values are single characters
      console.log('First 10 key-value pairs:');
      for (let i = 0; i < 10; i++) {
        if (rd[i.toString()] !== undefined) {
          console.log(`  "${i}": "${rd[i.toString()]}"`);
        }
      }

      // Try to reconstruct as string
      let reconstructed = '';
      for (let i = 0; i < 100; i++) {
        if (rd[i.toString()] !== undefined) {
          reconstructed += rd[i.toString()];
        } else {
          break;
        }
      }

      console.log('\nReconstructed string (first 100 chars):');
      console.log(reconstructed);

      // Check if it looks like JSON that was split into characters
      if (reconstructed.includes('{') || reconstructed.includes('"')) {
        console.log('\n⚠️  This appears to be JSON that was incorrectly stored as character array!');

        // Try to reconstruct full JSON
        let fullJson = '';
        let i = 0;
        while (rd[i.toString()] !== undefined && i < 1000000) {
          fullJson += rd[i.toString()];
          i++;
        }

        console.log(`\nTotal characters: ${i}`);

        try {
          const parsed = JSON.parse(fullJson);
          console.log('✅ Successfully reconstructed and parsed JSON!');
          console.log('Keys in reconstructed data:', Object.keys(parsed).slice(0, 20));

          // Check for price data
          if (parsed.cheapestinside) console.log('Found cheapestinside:', parsed.cheapestinside);
          if (parsed.cheapest) console.log('Found cheapest object');
        } catch (e) {
          console.log('❌ Could not parse reconstructed string as JSON');
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
