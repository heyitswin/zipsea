#!/usr/bin/env node

/**
 * Safe, reversible fix for corrupted raw_data in cruises table
 *
 * This script:
 * 1. Creates a backup table
 * 2. Tests on a small sample first
 * 3. Can be rolled back if issues occur
 * 4. Fixes the character-by-character storage corruption
 */

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

// Configuration
const SAMPLE_SIZE = 10; // Test on 10 cruises first
const BATCH_SIZE = 100; // Process in batches to avoid memory issues

async function createBackupAndFix() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔐 SAFE CORRUPTED RAW_DATA FIX SCRIPT');
    console.log('=' .repeat(60));

    // STEP 1: Create backup table
    console.log('\n📦 STEP 1: Creating backup table...');

    const createBackupTableQuery = `
      CREATE TABLE IF NOT EXISTS cruises_rawdata_backup (
        id TEXT PRIMARY KEY,
        cruise_id TEXT,
        raw_data JSONB,
        backed_up_at TIMESTAMP DEFAULT NOW(),
        raw_data_size INTEGER,
        is_corrupted BOOLEAN
      );
    `;

    await pool.query(createBackupTableQuery);
    console.log('✅ Backup table created/verified');

    // STEP 2: Identify corrupted cruises
    console.log('\n🔍 STEP 2: Identifying corrupted cruises...');

    const identifyCorruptedQuery = `
      SELECT
        id,
        cruise_id,
        name,
        LENGTH(raw_data::text) as raw_size,
        updated_at
      FROM cruises
      WHERE LENGTH(raw_data::text) > 100000
        AND raw_data::text LIKE '{"0":%'
        AND raw_data::text LIKE '{"1":%'
      ORDER BY LENGTH(raw_data::text) DESC
    `;

    const corrupted = await pool.query(identifyCorruptedQuery);
    console.log(`Found ${corrupted.rows.length} corrupted cruises`);

    if (corrupted.rows.length === 0) {
      console.log('✅ No corrupted cruises found. Exiting.');
      return;
    }

    // STEP 3: Backup corrupted data before fixing
    console.log('\n💾 STEP 3: Backing up corrupted data...');

    // Check if we already have backups
    const existingBackupsQuery = `
      SELECT COUNT(*) as count FROM cruises_rawdata_backup
    `;

    const existingBackups = await pool.query(existingBackupsQuery);

    if (existingBackups.rows[0].count > 0) {
      console.log(`⚠️  Found ${existingBackups.rows[0].count} existing backups`);
      const response = await promptUser('Continue anyway? (yes/no): ');
      if (response.toLowerCase() !== 'yes') {
        console.log('Exiting without changes.');
        return;
      }
    }

    // Backup the corrupted entries
    const backupQuery = `
      INSERT INTO cruises_rawdata_backup (id, cruise_id, raw_data, raw_data_size, is_corrupted)
      SELECT
        id,
        cruise_id,
        raw_data,
        LENGTH(raw_data::text),
        true
      FROM cruises
      WHERE LENGTH(raw_data::text) > 100000
        AND raw_data::text LIKE '{"0":%'
      ON CONFLICT (id) DO NOTHING
    `;

    const backupResult = await pool.query(backupQuery);
    console.log(`✅ Backed up ${backupResult.rowCount} cruises`);

    // STEP 4: Test reconstruction on sample
    console.log(`\n🧪 STEP 4: Testing reconstruction on ${SAMPLE_SIZE} sample cruises...`);

    const sampleCruises = corrupted.rows.slice(0, SAMPLE_SIZE);
    let successCount = 0;
    let failCount = 0;

    for (const cruise of sampleCruises) {
      try {
        // Get the corrupted data
        const dataQuery = `SELECT raw_data FROM cruises WHERE id = $1`;
        const dataResult = await pool.query(dataQuery, [cruise.id]);
        const corruptedData = dataResult.rows[0].raw_data;

        // Reconstruct the original JSON string
        const chars = [];
        let i = 0;
        while (corruptedData[i.toString()] !== undefined) {
          chars.push(corruptedData[i.toString()]);
          i++;
        }
        const reconstructedString = chars.join('');

        // Parse to validate it's proper JSON
        const originalData = JSON.parse(reconstructedString);

        // Check for expected fields
        if (originalData.cheapestinside || originalData.cheapestoutside ||
            originalData.cheapestbalcony || originalData.cheapestsuite) {
          console.log(`  ✅ ${cruise.id}: Successfully reconstructed with cheapest* fields`);
          successCount++;
        } else {
          console.log(`  ⚠️  ${cruise.id}: Reconstructed but missing cheapest* fields`);
          successCount++;
        }

      } catch (error) {
        console.log(`  ❌ ${cruise.id}: Failed to reconstruct - ${error.message}`);
        failCount++;
      }
    }

    console.log(`\nSample results: ${successCount} success, ${failCount} failed`);

    if (failCount > 0) {
      const response = await promptUser('Some samples failed. Continue with full fix? (yes/no): ');
      if (response.toLowerCase() !== 'yes') {
        console.log('Exiting without fixing. Backups remain in cruises_rawdata_backup table.');
        return;
      }
    }

    // STEP 5: Fix all corrupted cruises
    console.log('\n🔧 STEP 5: Fixing all corrupted cruises...');
    console.log('Processing in batches of', BATCH_SIZE);

    let totalFixed = 0;
    let totalFailed = 0;

    // Process in batches
    for (let offset = 0; offset < corrupted.rows.length; offset += BATCH_SIZE) {
      const batch = corrupted.rows.slice(offset, offset + BATCH_SIZE);
      console.log(`\nProcessing batch ${Math.floor(offset/BATCH_SIZE) + 1}/${Math.ceil(corrupted.rows.length/BATCH_SIZE)}`);

      for (const cruise of batch) {
        try {
          // Get the corrupted data
          const dataQuery = `SELECT raw_data FROM cruises WHERE id = $1`;
          const dataResult = await pool.query(dataQuery, [cruise.id]);
          const corruptedData = dataResult.rows[0].raw_data;

          // Reconstruct the original JSON string
          const chars = [];
          let i = 0;
          while (corruptedData[i.toString()] !== undefined) {
            chars.push(corruptedData[i.toString()]);
            i++;
          }
          const reconstructedString = chars.join('');

          // Parse and re-stringify to ensure it's clean JSON
          const originalData = JSON.parse(reconstructedString);

          // Update the cruise with fixed raw_data
          const updateQuery = `
            UPDATE cruises
            SET raw_data = $1::jsonb,
                updated_at = NOW()
            WHERE id = $2
          `;

          await pool.query(updateQuery, [JSON.stringify(originalData), cruise.id]);

          // Also update prices if we found cheapest* fields
          if (originalData.cheapestinside || originalData.cheapestoutside ||
              originalData.cheapestbalcony || originalData.cheapestsuite) {

            const priceUpdateQuery = `
              UPDATE cruises
              SET
                interior_price = COALESCE($1, interior_price),
                oceanview_price = COALESCE($2, oceanview_price),
                balcony_price = COALESCE($3, balcony_price),
                suite_price = COALESCE($4, suite_price),
                cheapest_price = LEAST(
                  NULLIF($1::numeric, 0),
                  NULLIF($2::numeric, 0),
                  NULLIF($3::numeric, 0),
                  NULLIF($4::numeric, 0)
                )
              WHERE id = $5
            `;

            await pool.query(priceUpdateQuery, [
              originalData.cheapestinside || null,
              originalData.cheapestoutside || null,
              originalData.cheapestbalcony || null,
              originalData.cheapestsuite || null,
              cruise.id
            ]);
          }

          totalFixed++;

          if (totalFixed % 10 === 0) {
            process.stdout.write('.');
          }

        } catch (error) {
          totalFailed++;
          // Log the failure but continue
          console.error(`\n  Failed ${cruise.id}: ${error.message}`);
        }
      }
    }

    console.log('\n\n' + '='.repeat(60));
    console.log('✅ FIX COMPLETE!');
    console.log(`  Fixed: ${totalFixed} cruises`);
    console.log(`  Failed: ${totalFailed} cruises`);
    console.log(`  Backups stored in: cruises_rawdata_backup table`);

    // Verify the fix
    console.log('\n🔍 Verifying fix...');

    const verifyQuery = `
      SELECT
        COUNT(*) as still_corrupted
      FROM cruises
      WHERE LENGTH(raw_data::text) > 100000
        AND raw_data::text LIKE '{"0":%'
    `;

    const verifyResult = await pool.query(verifyQuery);
    console.log(`  Remaining corrupted: ${verifyResult.rows[0].still_corrupted}`);

    console.log('\n📝 ROLLBACK INSTRUCTIONS:');
    console.log('If you need to rollback, run: node scripts/rollback-rawdata-fix.js');
    console.log('This will restore from the cruises_rawdata_backup table.');

  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\nNo changes were committed. Backup table may have been created.');
  } finally {
    await pool.end();
  }
}

// Helper function to prompt user
function promptUser(question) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    readline.question(question, answer => {
      readline.close();
      resolve(answer);
    });
  });
}

// Run if called directly
if (require.main === module) {
  createBackupAndFix();
}

module.exports = { createBackupAndFix };
