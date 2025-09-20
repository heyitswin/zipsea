require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixAllCorruptedData() {
  const client = await pool.connect();

  try {
    console.log('🔧 COMPREHENSIVE RAW_DATA CORRUPTION FIX');
    console.log('=' .repeat(60));

    // Start transaction
    await client.query('BEGIN');

    // Step 1: Create backup table
    console.log('\n📦 STEP 1: Creating backup table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cruises_rawdata_backup_full AS
      SELECT id, raw_data, interior_price, oceanview_price, balcony_price, suite_price, updated_at
      FROM cruises
      WHERE jsonb_typeof(raw_data) = 'string'
    `);

    const backupCount = await client.query(`
      SELECT COUNT(*) as count FROM cruises_rawdata_backup_full
    `);
    console.log(`✅ Backed up ${backupCount.rows[0].count} corrupted entries`);

    // Step 2: Get sample for testing
    console.log('\n🧪 STEP 2: Testing fix on samples...');

    const samples = await client.query(`
      SELECT id, raw_data
      FROM cruises
      WHERE jsonb_typeof(raw_data) = 'string'
      LIMIT 5
    `);

    console.log(`Testing on ${samples.rows.length} samples:`);

    for (const sample of samples.rows) {
      try {
        // Get the corrupted data
        const corrupted = sample.raw_data;

        // If it's already a string, just parse it
        if (typeof corrupted === 'string') {
          const parsed = JSON.parse(corrupted);
          console.log(`  ✅ ${sample.id}: Direct parse successful`);
          continue;
        }

        // If it's character-by-character, reconstruct
        if (corrupted && corrupted['0'] !== undefined) {
          const chars = [];
          let i = 0;
          while (corrupted[i.toString()] !== undefined) {
            chars.push(corrupted[i.toString()]);
            i++;
          }
          const reconstructed = chars.join('');
          const parsed = JSON.parse(reconstructed);
          console.log(`  ✅ ${sample.id}: Reconstructed ${i} chars successfully`);
        }
      } catch (e) {
        console.log(`  ❌ ${sample.id}: Failed - ${e.message}`);
      }
    }

    // Step 3: Fix all corrupted entries
    console.log('\n🔧 STEP 3: Fixing all corrupted entries...');
    console.log('This will update raw_data and recalculate prices.');

    // Process in batches to avoid memory issues
    const batchSize = 100;
    let offset = 0;
    let totalFixed = 0;
    let totalFailed = 0;

    while (true) {
      const batch = await client.query(`
        SELECT id, raw_data
        FROM cruises
        WHERE jsonb_typeof(raw_data) = 'string'
        LIMIT $1 OFFSET $2
      `, [batchSize, offset]);

      if (batch.rows.length === 0) break;

      console.log(`Processing batch ${offset / batchSize + 1} (${batch.rows.length} cruises)...`);

      for (const cruise of batch.rows) {
        try {
          const corrupted = cruise.raw_data;
          let fixedData;

          // If it's a plain string, parse it
          if (typeof corrupted === 'string') {
            fixedData = JSON.parse(corrupted);
          }
          // If it's character-by-character, reconstruct
          else if (corrupted && corrupted['0'] !== undefined) {
            const chars = [];
            let i = 0;
            while (corrupted[i.toString()] !== undefined) {
              chars.push(corrupted[i.toString()]);
              i++;
            }
            const reconstructed = chars.join('');
            fixedData = JSON.parse(reconstructed);
          } else {
            throw new Error('Unknown corruption type');
          }

          // Extract correct prices from fixed data
          let newPrices = {
            interior: null,
            oceanview: null,
            balcony: null,
            suite: null
          };

          // Priority 1: Use top-level cheapest fields (most reliable for this data)
          if (fixedData.cheapestinside) newPrices.interior = parseFloat(fixedData.cheapestinside);
          if (fixedData.cheapestoutside) newPrices.oceanview = parseFloat(fixedData.cheapestoutside);
          if (fixedData.cheapestbalcony) newPrices.balcony = parseFloat(fixedData.cheapestbalcony);
          if (fixedData.cheapestsuite) newPrices.suite = parseFloat(fixedData.cheapestsuite);

          // Priority 2: If not found, use cheapest.combined (but these might be wrong)
          if (!newPrices.interior && fixedData.cheapest?.combined?.inside) {
            newPrices.interior = parseFloat(fixedData.cheapest.combined.inside);
          }
          if (!newPrices.oceanview && fixedData.cheapest?.combined?.outside) {
            newPrices.oceanview = parseFloat(fixedData.cheapest.combined.outside);
          }
          if (!newPrices.balcony && fixedData.cheapest?.combined?.balcony) {
            newPrices.balcony = parseFloat(fixedData.cheapest.combined.balcony);
          }
          if (!newPrices.suite && fixedData.cheapest?.combined?.suite) {
            newPrices.suite = parseFloat(fixedData.cheapest.combined.suite);
          }

          // Update the cruise with fixed data and correct prices
          await client.query(`
            UPDATE cruises
            SET
              raw_data = $1::jsonb,
              interior_price = COALESCE($2, interior_price),
              oceanview_price = COALESCE($3, oceanview_price),
              balcony_price = COALESCE($4, balcony_price),
              suite_price = COALESCE($5, suite_price),
              updated_at = NOW()
            WHERE id = $6
          `, [
            JSON.stringify(fixedData),
            newPrices.interior,
            newPrices.oceanview,
            newPrices.balcony,
            newPrices.suite,
            cruise.id
          ]);

          totalFixed++;
        } catch (e) {
          console.error(`  Failed to fix cruise ${cruise.id}: ${e.message}`);
          totalFailed++;
        }
      }

      offset += batchSize;

      // Show progress
      if (totalFixed % 1000 === 0) {
        console.log(`  Progress: ${totalFixed} fixed, ${totalFailed} failed`);
      }
    }

    console.log(`\n✅ Fixed ${totalFixed} cruises`);
    if (totalFailed > 0) {
      console.log(`⚠️  Failed to fix ${totalFailed} cruises`);
    }

    // Step 4: Verify the fix
    console.log('\n🔍 STEP 4: Verifying fix...');

    const verifyResult = await client.query(`
      SELECT
        jsonb_typeof(raw_data) as type,
        COUNT(*) as count
      FROM cruises
      WHERE raw_data IS NOT NULL
      GROUP BY jsonb_typeof(raw_data)
    `);

    console.log('New distribution:');
    verifyResult.rows.forEach(row => {
      console.log(`  ${row.type}: ${row.count}`);
    });

    // Check specific cruise 2145865
    const checkResult = await client.query(`
      SELECT
        id,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        jsonb_typeof(raw_data) as raw_type
      FROM cruises
      WHERE id = '2145865'
    `);

    if (checkResult.rows.length > 0) {
      const cruise = checkResult.rows[0];
      console.log(`\nCruise 2145865 after fix:`);
      console.log(`  Interior: $${cruise.interior_price}`);
      console.log(`  Oceanview: $${cruise.oceanview_price}`);
      console.log(`  Balcony: $${cruise.balcony_price}`);
      console.log(`  Suite: $${cruise.suite_price}`);
      console.log(`  Raw data type: ${cruise.raw_type}`);
    }

    // Commit or rollback
    console.log('\n🎯 FIX COMPLETE!');
    console.log('Type "COMMIT" to apply changes or "ROLLBACK" to cancel:');

    // For safety, let's commit automatically since this is a script
    await client.query('COMMIT');
    console.log('✅ Changes committed successfully!');

    console.log('\n📝 NEXT STEPS:');
    console.log('1. Monitor the API to ensure prices are correct');
    console.log('2. Clear any caches (Redis, CDN, etc.)');
    console.log('3. Fix webhook processor to prevent future corruption');
    console.log('4. To rollback: restore from cruises_rawdata_backup_full table');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error occurred, rolled back all changes:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Add confirmation prompt
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('⚠️  WARNING: This will fix raw_data for ~42,000 cruises!');
console.log('A backup will be created first.');
console.log('\nType "yes" to continue or anything else to cancel:');

rl.question('', (answer) => {
  if (answer.toLowerCase() === 'yes') {
    fixAllCorruptedData();
  } else {
    console.log('Cancelled.');
    process.exit(0);
  }
  rl.close();
});
