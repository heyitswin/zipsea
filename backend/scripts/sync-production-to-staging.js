#!/usr/bin/env node

/**
 * Sync Cruise Data from Production to Staging
 *
 * This script copies cruise-related tables from production to staging database
 * while preserving staging-specific data (users, quotes, saved searches).
 *
 * Usage:
 *   DATABASE_URL_PRODUCTION=<prod_url> DATABASE_URL_STAGING=<staging_url> node sync-production-to-staging.js
 *
 * Or with npm script:
 *   npm run sync:production-to-staging
 */

const postgres = require('postgres');
const dotenv = require('dotenv');

dotenv.config();

// Configuration
const config = {
  production: process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL,
  staging: process.env.DATABASE_URL_STAGING,
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
  dryRun: process.env.DRY_RUN === 'true',
  verbose: process.env.VERBOSE === 'true' || true,
};

// Tables to sync from production to staging (order matters for FK constraints)
const TABLES_TO_SYNC = [
  'cruise_lines',
  'ships',
  'ports',
  'regions',
  'cruises',
  'itineraries',
  'cabin_categories',
  'pricing',
  'cruise_definitions', // if exists
  'price_snapshots', // optional - webhook related
  'webhook_events', // optional - for debugging
];

// Tables to preserve in staging (never overwrite)
const TABLES_TO_PRESERVE = ['users', 'quote_requests', 'saved_searches'];

class ProductionToStagingSync {
  constructor() {
    this.prodDb = null;
    this.stagingDb = null;
    this.stats = {
      tablesSucceeded: [],
      tablesFailed: [],
      rowsCopied: 0,
      startTime: new Date(),
    };
  }

  async connect() {
    if (!config.production) {
      throw new Error('DATABASE_URL_PRODUCTION environment variable is required');
    }
    if (!config.staging) {
      throw new Error('DATABASE_URL_STAGING environment variable is required');
    }

    console.log('🔌 Connecting to databases...');

    // Connect to production database
    this.prodDb = postgres(config.production, {
      ssl: config.production.includes('render.com') ? { rejectUnauthorized: false } : false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    // Connect to staging database
    this.stagingDb = postgres(config.staging, {
      ssl: config.staging.includes('render.com') ? { rejectUnauthorized: false } : false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    // Test connections
    await this.prodDb`SELECT 1`;
    console.log('✅ Connected to production database');

    await this.stagingDb`SELECT 1`;
    console.log('✅ Connected to staging database');
  }

  async checkTableExists(db, tableName) {
    const result = await db`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = ${tableName}
      ) as exists
    `;
    return result[0].exists;
  }

  async getRowCount(db, tableName) {
    const result = await db`
      SELECT COUNT(*) as count FROM ${db(tableName)}
    `;
    return parseInt(result[0].count);
  }

  async backupStagingQuotes() {
    console.log('\n📦 Backing up staging quote_requests...');

    // Create backup table if it doesn't exist
    await this.stagingDb`
      CREATE TABLE IF NOT EXISTS quote_requests_backup AS
      SELECT * FROM quote_requests WHERE false
    `;

    // Clear old backup and insert current data
    await this.stagingDb`TRUNCATE TABLE quote_requests_backup`;
    const backed = await this.stagingDb`
      INSERT INTO quote_requests_backup
      SELECT * FROM quote_requests
      RETURNING id
    `;

    console.log(`  ✅ Backed up ${backed.length} quote requests`);
    return backed.length;
  }

  async getCommonColumns(tableName) {
    // Get columns that exist in BOTH production and staging databases
    const prodColumns = await this.prodDb`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = ${tableName}
      ORDER BY ordinal_position
    `;

    const stagingColumns = await this.stagingDb`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = ${tableName}
      ORDER BY ordinal_position
    `;

    const prodColNames = new Set(prodColumns.map(c => c.column_name));
    const stagingColNames = new Set(stagingColumns.map(c => c.column_name));

    // Return only columns that exist in both databases
    const commonColumns = prodColumns
      .map(c => c.column_name)
      .filter(col => stagingColNames.has(col));

    if (config.verbose) {
      const prodOnly = [...prodColNames].filter(c => !stagingColNames.has(c));
      const stagingOnly = [...stagingColNames].filter(c => !prodColNames.has(c));

      if (prodOnly.length > 0) {
        console.log(`  ℹ️  Columns only in production: ${prodOnly.join(', ')}`);
      }
      if (stagingOnly.length > 0) {
        console.log(`  ℹ️  Columns only in staging: ${stagingOnly.join(', ')}`);
      }
    }

    return commonColumns;
  }

  async syncTable(tableName) {
    try {
      console.log(`\n🔄 Syncing table: ${tableName}`);

      // Check if table exists in production
      const existsInProd = await this.checkTableExists(this.prodDb, tableName);
      if (!existsInProd) {
        console.log(`  ⚠️  Table ${tableName} does not exist in production, skipping`);
        return { success: true, skipped: true };
      }

      // Check if table exists in staging
      const existsInStaging = await this.checkTableExists(this.stagingDb, tableName);
      if (!existsInStaging) {
        console.log(`  ⚠️  Table ${tableName} does not exist in staging, skipping`);
        return { success: true, skipped: true };
      }

      // Get columns that exist in BOTH databases
      const columns = await this.getCommonColumns(tableName);

      if (columns.length === 0) {
        console.log(
          `  ⚠️  No common columns found between production and staging for ${tableName}, skipping`
        );
        return { success: true, skipped: true };
      }

      console.log(`  📋 Syncing ${columns.length} common columns`);

      // Get row counts before
      const prodCount = await this.getRowCount(this.prodDb, tableName);
      const stagingCountBefore = await this.getRowCount(this.stagingDb, tableName);

      if (config.verbose) {
        console.log(`  📊 Production rows: ${prodCount}`);
        console.log(`  📊 Staging rows before: ${stagingCountBefore}`);
      }

      if (config.dryRun) {
        console.log(`  🔍 DRY RUN: Would copy ${prodCount} rows`);
        return { success: true, dryRun: true, rowCount: prodCount };
      }

      // Clear staging table first (outside transaction to avoid holding locks)
      await this.stagingDb`TRUNCATE TABLE ${this.stagingDb(tableName)} CASCADE`;

      // For efficiency, use postgres COPY instead of INSERT for large tables
      if (prodCount > 1000) {
        // Use efficient COPY approach for large tables
        const columnList = columns.map(col => `"${col}"`).join(', ');

        // Export from production
        const selectQuery = `COPY (SELECT ${columnList} FROM ${tableName} ORDER BY 1) TO STDOUT WITH (FORMAT CSV, HEADER false)`;
        const copyData = await this.prodDb.unsafe(selectQuery);

        // Import to staging
        const importQuery = `COPY ${tableName} (${columnList}) FROM STDIN WITH (FORMAT CSV, HEADER false)`;
        await this.stagingDb.unsafe(importQuery, copyData);

        totalCopied = prodCount;
        console.log(`    ... used COPY for ${totalCopied} rows (faster)`);
      } else {
        // Use INSERT for smaller tables (more compatible with schema differences)
        const chunkSize = 500;
        const insertBatchSize = 50;
        let offset = 0;
        let totalCopied = 0;

        while (offset < prodCount) {
          // Fetch small chunk from production - SELECT only common columns
          const columnList = columns.map(col => `"${col}"`).join(', ');
          const selectQuery = `SELECT ${columnList} FROM ${tableName} ORDER BY 1 LIMIT ${chunkSize} OFFSET ${offset}`;
          const rows = await this.prodDb.unsafe(selectQuery);

          if (rows.length === 0) break;

          // Insert in tiny batches to avoid large query strings
          for (let i = 0; i < rows.length; i += insertBatchSize) {
            const batch = rows.slice(i, i + insertBatchSize);

            // Use postgres.js's insert helper which handles nulls better
            try {
              await this.stagingDb`
                INSERT INTO ${this.stagingDb(tableName)} ${this.stagingDb(batch, ...columns)}
              `;
              totalCopied += batch.length;
            } catch (insertError) {
              console.log(`    ⚠️  Batch insert failed, trying row-by-row...`);
              // Fall back to row-by-row for this batch
              for (const row of batch) {
                try {
                  await this.stagingDb`
                    INSERT INTO ${this.stagingDb(tableName)} ${this.stagingDb(row, ...columns)}
                  `;
                  totalCopied++;
                } catch (rowError) {
                  console.log(`    ⚠️  Skipping row due to: ${rowError.message}`);
                }
              }
            }

            // Clear batch from memory immediately
            batch.length = 0;
          }

          // Clear rows from memory before fetching next chunk
          rows.length = 0;
          offset += chunkSize;

          if (config.verbose && totalCopied % 2000 === 0) {
            console.log(`    ... copied ${totalCopied} rows`);
          }

          // Force garbage collection hint
          if (global.gc && totalCopied % 5000 === 0) {
            global.gc();
          }
        }
      }

      // Update sequences after all inserts
      await this.updateSequences(tableName);

      // Get final count
      const stagingCountAfter = await this.getRowCount(this.stagingDb, tableName);

      console.log(`  ✅ Successfully synced ${stagingCountAfter} rows`);
      this.stats.rowsCopied += stagingCountAfter;

      return { success: true, rowCount: stagingCountAfter };
    } catch (error) {
      console.error(`  ❌ Error syncing ${tableName}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async updateSequencesWithTransaction(sql, tableName) {
    try {
      // Find all serial columns
      const sequences = await sql`
        SELECT
          column_name,
          column_default
        FROM information_schema.columns
        WHERE table_name = ${tableName}
          AND column_default LIKE 'nextval%'
      `;

      for (const seq of sequences) {
        const sequenceName = seq.column_default.match(/nextval\('(.+?)'/)?.[1];
        if (sequenceName) {
          // Reset sequence to max value + 1
          await sql`
            SELECT setval(
              ${sequenceName}::regclass,
              COALESCE(
                (SELECT MAX(${sql(seq.column_name)}) FROM ${sql(tableName)}),
                1
              )
            )
          `;
        }
      }
    } catch (error) {
      // Ignore errors for tables without sequences
    }
  }

  async updateSequences(tableName) {
    try {
      // Find all serial columns
      const sequences = await this.stagingDb`
        SELECT
          column_name,
          column_default
        FROM information_schema.columns
        WHERE table_name = ${tableName}
          AND column_default LIKE 'nextval%'
      `;

      for (const seq of sequences) {
        const sequenceName = seq.column_default.match(/nextval\('(.+?)'/)?.[1];
        if (sequenceName) {
          // Reset sequence to max value + 1
          await this.stagingDb`
            SELECT setval(
              ${sequenceName}::regclass,
              COALESCE(
                (SELECT MAX(${this.stagingDb(seq.column_name)}) FROM ${this.stagingDb(tableName)}),
                1
              )
            )
          `;
        }
      }
    } catch (error) {
      console.log(`  ⚠️  Could not update sequences for ${tableName}:`, error.message);
    }
  }

  async restoreInvalidatedQuotes() {
    console.log('\n🔧 Checking for invalidated quote_requests...');

    // Find quotes that reference non-existent cruises
    const invalidQuotes = await this.stagingDb`
      SELECT qr.id, qr.cruise_id
      FROM quote_requests qr
      LEFT JOIN cruises c ON qr.cruise_id = c.id
      WHERE c.id IS NULL
    `;

    if (invalidQuotes.length > 0) {
      console.log(`  ⚠️  Found ${invalidQuotes.length} quotes with invalid cruise references`);

      // Remove invalid quotes (they're backed up)
      await this.stagingDb`
        DELETE FROM quote_requests
        WHERE cruise_id NOT IN (SELECT id FROM cruises)
      `;

      console.log(`  ✅ Removed invalid quotes (backed up in quote_requests_backup)`);
    } else {
      console.log(`  ✅ All quote_requests have valid cruise references`);
    }
  }

  async validateSync() {
    console.log('\n🔍 Validating sync...');

    const validationResults = [];

    for (const tableName of TABLES_TO_SYNC) {
      const existsInProd = await this.checkTableExists(this.prodDb, tableName);
      const existsInStaging = await this.checkTableExists(this.stagingDb, tableName);

      if (!existsInProd || !existsInStaging) {
        continue;
      }

      const prodCount = await this.getRowCount(this.prodDb, tableName);
      const stagingCount = await this.getRowCount(this.stagingDb, tableName);

      const match = prodCount === stagingCount;
      validationResults.push({
        table: tableName,
        prodCount,
        stagingCount,
        match,
      });

      if (!match) {
        console.log(`  ⚠️  ${tableName}: Production (${prodCount}) != Staging (${stagingCount})`);
      }
    }

    const allMatch = validationResults.every(r => r.match);
    if (allMatch) {
      console.log('  ✅ All synced tables have matching row counts');
    }

    return validationResults;
  }

  async sendSlackNotification(success, message, details) {
    if (!config.slackWebhookUrl) return;

    try {
      const payload = {
        text: success ? '✅ Cruise Data Sync Successful' : '❌ Cruise Data Sync Failed',
        attachments: [
          {
            color: success ? 'good' : 'danger',
            fields: [
              {
                title: 'Environment',
                value: 'Production → Staging',
                short: true,
              },
              {
                title: 'Status',
                value: message,
                short: true,
              },
              {
                title: 'Details',
                value: details,
                short: false,
              },
              {
                title: 'Duration',
                value: `${Math.round((Date.now() - this.stats.startTime) / 1000)}s`,
                short: true,
              },
            ],
            footer: 'Cruise Data Sync',
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      };

      await fetch(config.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.log('Could not send Slack notification:', error.message);
    }
  }

  async run() {
    try {
      console.log('🚀 Starting Production to Staging Cruise Data Sync');
      console.log('================================================');

      if (config.dryRun) {
        console.log('⚠️  DRY RUN MODE - No data will be modified');
      }

      await this.connect();

      // Backup staging quotes before sync
      if (!config.dryRun) {
        await this.backupStagingQuotes();
      }

      // Sync each table
      for (const tableName of TABLES_TO_SYNC) {
        const result = await this.syncTable(tableName);

        if (result.success && !result.skipped) {
          this.stats.tablesSucceeded.push(tableName);
        } else if (!result.success) {
          this.stats.tablesFailed.push(tableName);
        }
      }

      // Clean up invalidated quotes
      if (!config.dryRun) {
        await this.restoreInvalidatedQuotes();
      }

      // Validate sync
      const validationResults = await this.validateSync();

      // Summary
      const duration = Math.round((Date.now() - this.stats.startTime) / 1000);

      console.log('\n📊 Sync Summary');
      console.log('================');
      console.log(`✅ Tables succeeded: ${this.stats.tablesSucceeded.length}`);
      console.log(`❌ Tables failed: ${this.stats.tablesFailed.length}`);
      console.log(`📝 Total rows copied: ${this.stats.rowsCopied.toLocaleString()}`);
      console.log(`⏱️  Duration: ${duration}s`);

      if (this.stats.tablesFailed.length > 0) {
        console.log(`\n❌ Failed tables: ${this.stats.tablesFailed.join(', ')}`);
      }

      // Send Slack notification
      await this.sendSlackNotification(
        this.stats.tablesFailed.length === 0,
        `Synced ${this.stats.tablesSucceeded.length} tables, ${this.stats.rowsCopied.toLocaleString()} rows`,
        this.stats.tablesFailed.length > 0
          ? `Failed tables: ${this.stats.tablesFailed.join(', ')}`
          : 'All tables synced successfully'
      );

      // Exit with appropriate code
      process.exit(this.stats.tablesFailed.length > 0 ? 1 : 0);
    } catch (error) {
      console.error('\n❌ Fatal error:', error);
      await this.sendSlackNotification(false, 'Fatal error during sync', error.message);
      process.exit(1);
    } finally {
      // Clean up connections
      if (this.prodDb) await this.prodDb.end();
      if (this.stagingDb) await this.stagingDb.end();
    }
  }
}

// Run sync
const sync = new ProductionToStagingSync();
sync.run().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
