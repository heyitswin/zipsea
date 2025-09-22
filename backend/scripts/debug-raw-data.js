/**
 * Debug exactly what raw_data looks like
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
  console.log('RAW DATA STRUCTURE DEBUG\n');
  console.log('=' .repeat(80));

  try {
    // Get a few cruises
    const cruises = await sql`
      SELECT
        id,
        name,
        cheapest_price,
        raw_data
      FROM cruises
      WHERE id IN ('2144014', '2148689', '2143804')
    `;

    for (const cruise of cruises) {
      console.log(`\nCruise ${cruise.id}: ${cruise.name}`);
      console.log(`Price: $${cruise.cheapest_price}`);

      const rd = cruise.raw_data;

      // Basic type info
      console.log(`\nType checks:`);
      console.log(`  typeof: ${typeof rd}`);
      console.log(`  constructor.name: ${rd?.constructor?.name}`);
      console.log(`  Is null: ${rd === null}`);
      console.log(`  Is undefined: ${rd === undefined}`);
      console.log(`  Is array: ${Array.isArray(rd)}`);
      console.log(`  Is string: ${typeof rd === 'string'}`);
      console.log(`  Is object: ${typeof rd === 'object'}`);

      // Key checks
      console.log(`\nKey checks:`);
      console.log(`  Has property '0': ${rd.hasOwnProperty('0')}`);
      console.log(`  Has key '0': ${rd['0'] !== undefined}`);
      console.log(`  Has property 'cheapestinside': ${rd.hasOwnProperty('cheapestinside')}`);
      console.log(`  Has key 'cheapestinside': ${rd['cheapestinside'] !== undefined}`);

      // If has numeric keys
      if (rd['0'] !== undefined) {
        console.log(`\nNumeric key values:`);
        console.log(`  rd['0'] = "${rd['0']}" (type: ${typeof rd['0']}, length: ${rd['0']?.length})`);
        console.log(`  rd['1'] = "${rd['1']}" (type: ${typeof rd['1']}, length: ${rd['1']?.length})`);
        console.log(`  rd['2'] = "${rd['2']}" (type: ${typeof rd['2']}, length: ${rd['2']?.length})`);
        console.log(`  rd['3'] = "${rd['3']}" (type: ${typeof rd['3']}, length: ${rd['3']?.length})`);

        // Try to reconstruct
        let reconstructed = '';
        for (let i = 0; i < 50; i++) {
          if (rd[i.toString()] !== undefined) {
            reconstructed += rd[i.toString()];
          } else {
            break;
          }
        }
        console.log(`\nFirst 50 chars reconstructed: "${reconstructed}"`);
      }

      // If has normal keys
      if (rd['cheapestinside'] !== undefined) {
        console.log(`\nNormal key values:`);
        console.log(`  cheapestinside: ${rd['cheapestinside']}`);
        console.log(`  cheapestoutside: ${rd['cheapestoutside']}`);
      }

      // All keys
      const keys = Object.keys(rd);
      console.log(`\nAll keys (first 20): ${keys.slice(0, 20).join(', ')}`);
      console.log(`Total keys: ${keys.length}`);

      console.log('-'.repeat(80));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
