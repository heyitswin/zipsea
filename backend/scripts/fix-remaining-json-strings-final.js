/**
 * Final fix for remaining JSON string corruptions
 * Handles edge cases not caught by previous scripts
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

function isCorruptedRawData(rawData) {
  // Check if it's a string (PostgreSQL returns corrupted JSONB as string)
  if (typeof rawData === 'string') {
    try {
      const parsed = JSON.parse(rawData);
      // If it parses and has numeric keys, it's corrupted
      if (typeof parsed === 'object' && parsed !== null) {
        const keys = Object.keys(parsed);
        return keys.some(key => /^\d+$/.test(key));
      }
    } catch (e) {
      // If it doesn't parse, it's corrupted
      return true;
    }
  }

  // Check if it's an object with numeric keys
  if (typeof rawData === 'object' && rawData !== null) {
    const keys = Object.keys(rawData);
    if (keys.some(key => /^\d+$/.test(key))) {
      return true;
    }
  }

  return false;
}

function parseCorruptedRawData(rawData) {
  if (!rawData) return {};

  // If it's a string, parse it first
  if (typeof rawData === 'string') {
    try {
      rawData = JSON.parse(rawData);
    } catch (e) {
      console.error('Failed to parse string raw_data:', e.message);
      return {};
    }
  }

  // Handle numeric keys (character array pattern)
  if (typeof rawData === 'object' && rawData !== null) {
    const keys = Object.keys(rawData);
    if (keys.some(key => /^\d+$/.test(key))) {
      // Reconstruct the JSON string from the character array
      let jsonString = '';
      for (let i = 0; keys.includes(i.toString()); i++) {
        jsonString += rawData[i.toString()];
      }

      try {
        return JSON.parse(jsonString);
      } catch (e) {
        console.error('Failed to parse reconstructed JSON:', e.message);
        return {};
      }
    }
  }

  // If it's already valid, return as is
  return rawData;
}

async function main() {
  const args = process.argv.slice(2);
  const DRY_RUN = !args.includes('--execute');
  const BATCH_SIZE = 10;

  console.log('=' .repeat(80));
  console.log('FINAL FIX FOR REMAINING JSON STRING CORRUPTIONS');
  console.log('=' .repeat(80));
  console.log('Mode:', DRY_RUN ? '🔍 DRY RUN' : '⚠️  EXECUTE MODE');
  console.log();

  try {
    // Get total count
    console.log('Counting total cruises...');
    const totalCount = await sql`
      SELECT COUNT(*) as count FROM cruises WHERE is_active = true
    `;
    console.log(`Total active cruises: ${totalCount[0].count}`);

    // Process in batches to find corrupted entries
    console.log('\nScanning for corrupted raw_data...\n');

    let offset = 0;
    let corrupted = [];
    let processed = 0;

    while (true) {
      const batch = await sql`
        SELECT id, name, raw_data
        FROM cruises
        WHERE is_active = true
        ORDER BY id
        LIMIT ${BATCH_SIZE}
        OFFSET ${offset}
      `;

      if (batch.length === 0) break;

      for (const cruise of batch) {
        if (isCorruptedRawData(cruise.raw_data)) {
          corrupted.push({
            id: cruise.id,
            name: cruise.name,
            raw_data: cruise.raw_data
          });

          if (corrupted.length <= 5) {
            console.log(`  Found corrupted: ${cruise.id} - ${cruise.name}`);
            console.log(`    Type: ${typeof cruise.raw_data}`);
            if (typeof cruise.raw_data === 'string') {
              console.log(`    First 100 chars: ${cruise.raw_data.substring(0, 100)}...`);
            } else {
              console.log(`    Keys: ${Object.keys(cruise.raw_data).slice(0, 10).join(', ')}...`);
            }
          }
        }
      }

      processed += batch.length;
      offset += BATCH_SIZE;

      // Progress update every 1000 cruises
      if (processed % 1000 === 0) {
        console.log(`  Scanned ${processed}/${totalCount[0].count} cruises, found ${corrupted.length} corrupted`);
      }
    }

    console.log('\n' + '=' .repeat(80));
    console.log(`SCAN COMPLETE: Found ${corrupted.length} corrupted cruises`);
    console.log('=' .repeat(80) + '\n');

    if (corrupted.length === 0) {
      console.log('✅ No corrupted raw_data found!');
      return;
    }

    if (!DRY_RUN) {
      console.log('FIXING CORRUPTED DATA...\n');

      let fixed = 0;
      let errors = 0;

      // Process in smaller batches for updates
      for (let i = 0; i < corrupted.length; i += 5) {
        const batch = corrupted.slice(i, i + 5);

        for (const cruise of batch) {
          try {
            const fixedData = parseCorruptedRawData(cruise.raw_data);

            // Update the database
            await sql`
              UPDATE cruises
              SET raw_data = ${fixedData}
              WHERE id = ${cruise.id}
            `;

            fixed++;

            if (fixed <= 10 || fixed % 100 === 0) {
              console.log(`  Fixed ${fixed}/${corrupted.length}: cruise ${cruise.id}`);
            }
          } catch (error) {
            console.error(`  Error fixing cruise ${cruise.id}:`, error.message);
            errors++;
          }
        }

        // Small delay between batches
        if (i % 100 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log('\n' + '=' .repeat(80));
      console.log('FIX COMPLETE');
      console.log('=' .repeat(80));
      console.log(`Total fixed: ${fixed}`);
      console.log(`Total errors: ${errors}`);

      // Verify by checking again
      console.log('\nVerifying fix...');

      let stillCorrupted = 0;
      offset = 0;

      while (true) {
        const batch = await sql`
          SELECT id, raw_data
          FROM cruises
          WHERE is_active = true
          ORDER BY id
          LIMIT 100
          OFFSET ${offset}
        `;

        if (batch.length === 0) break;

        for (const cruise of batch) {
          if (isCorruptedRawData(cruise.raw_data)) {
            stillCorrupted++;
          }
        }

        offset += 100;
      }

      if (stillCorrupted === 0) {
        console.log('✅ SUCCESS: All JSON string corruptions have been fixed!');
      } else {
        console.log(`⚠️  WARNING: ${stillCorrupted} cruises still have corrupted raw_data`);
      }

    } else {
      console.log('DRY RUN SUMMARY');
      console.log('=' .repeat(80));
      console.log(`Would fix ${corrupted.length} cruises with corrupted raw_data`);
      console.log('\nTo execute the fix, run:');
      console.log('  node scripts/fix-remaining-json-strings-final.js --execute');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
