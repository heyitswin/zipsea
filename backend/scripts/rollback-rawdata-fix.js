#!/usr/bin/env node

/**
 * Rollback script for corrupted raw_data fix
 *
 * This script restores raw_data from the backup table
 * created by backup-and-fix-corrupted-rawdata.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

async function rollbackRawDataFix() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔄 ROLLBACK RAW_DATA FIX');
    console.log('=' .repeat(60));

    // Check if backup table exists
    const checkBackupQuery = `
      SELECT COUNT(*) as count
      FROM cruises_rawdata_backup
    `;

    let backupCount;
    try {
      const result = await pool.query(checkBackupQuery);
      backupCount = result.rows[0].count;
    } catch (error) {
      console.log('❌ No backup table found. Cannot rollback.');
      return;
    }

    console.log(`Found ${backupCount} backups to restore`);

    if (backupCount === 0) {
      console.log('No backups to restore. Exiting.');
      return;
    }

    // Confirm rollback
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const response = await new Promise(resolve => {
      readline.question(`\n⚠️  This will restore ${backupCount} cruises to their corrupted state.\nAre you sure? (yes/no): `, answer => {
        readline.close();
        resolve(answer);
      });
    });

    if (response.toLowerCase() !== 'yes') {
      console.log('Rollback cancelled.');
      return;
    }

    // Perform rollback
    console.log('\n🔄 Rolling back...');

    const rollbackQuery = `
      UPDATE cruises c
      SET
        raw_data = b.raw_data,
        updated_at = NOW()
      FROM cruises_rawdata_backup b
      WHERE c.id = b.id
    `;

    const result = await pool.query(rollbackQuery);
    console.log(`✅ Rolled back ${result.rowCount} cruises`);

    // Verify rollback
    console.log('\n🔍 Verifying rollback...');

    const verifyQuery = `
      SELECT
        COUNT(*) as corrupted_again
      FROM cruises
      WHERE LENGTH(raw_data::text) > 100000
        AND raw_data::text LIKE '{"0":%'
    `;

    const verifyResult = await pool.query(verifyQuery);
    console.log(`  Corrupted cruises after rollback: ${verifyResult.rows[0].corrupted_again}`);

    // Ask about keeping backups
    const keepBackups = await new Promise(resolve => {
      const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question('\nKeep backup table for future use? (yes/no): ', answer => {
        rl.close();
        resolve(answer);
      });
    });

    if (keepBackups.toLowerCase() !== 'yes') {
      console.log('Dropping backup table...');
      await pool.query('DROP TABLE cruises_rawdata_backup');
      console.log('✅ Backup table dropped');
    } else {
      console.log('✅ Backup table retained');
    }

    console.log('\n✅ Rollback complete!');

  } catch (error) {
    console.error('❌ Rollback error:', error);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  rollbackRawDataFix();
}

module.exports = { rollbackRawDataFix };
