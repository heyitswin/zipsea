#!/usr/bin/env node

/**
 * Apply all webhook system improvements
 * This script sets up the database and configurations for the enhanced webhook system
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function applyWebhookImprovements() {
  console.log('🚀 Applying Webhook System Improvements');
  console.log('=========================================\n');

  const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ No database URL found');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // 1. Check and fix system_flags table
    console.log('1️⃣ Checking system_flags table...');

    // Check if table exists and has correct structure
    const columnCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'system_flags'
      AND column_name = 'key'
    `);

    if (columnCheck.rows.length === 0) {
      // Table doesn't exist or has wrong structure
      console.log('Table missing or has wrong structure, recreating...');
      await client.query('DROP TABLE IF EXISTS system_flags CASCADE');

      await client.query(`
        CREATE TABLE system_flags (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT,
          description TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_by VARCHAR(100)
        )
      `);
      console.log('✅ system_flags table created with correct structure\n');
    } else {
      console.log('✅ system_flags table structure verified\n');
    }

    // 2. Insert default flags
    console.log('2️⃣ Inserting system flags...');
    const flags = [
      {
        key: 'webhooks_paused',
        value: 'false',
        description:
          'Controls whether webhooks are processed. Set to true during large sync operations.',
      },
      {
        key: 'batch_sync_paused',
        value: 'false',
        description:
          'Controls whether batch sync cron job processes. Set to true during initial FTP sync.',
      },
      {
        key: 'sync_in_progress',
        value: 'false',
        description: 'Indicates if a large sync operation is currently running.',
      },
      {
        key: 'webhook_deduplication_window',
        value: '300',
        description: 'Seconds to prevent duplicate webhook processing (default 5 minutes)',
      },
      {
        key: 'max_cruises_per_webhook',
        value: '500',
        description: 'Maximum cruises to process per webhook batch',
      },
    ];

    for (const flag of flags) {
      await client.query(
        `
        INSERT INTO system_flags (key, value, description, updated_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            description = EXCLUDED.description,
            updated_at = CURRENT_TIMESTAMP
      `,
        [flag.key, flag.value, flag.description, 'system']
      );
    }
    console.log('✅ System flags configured\n');

    // 3. Add webhook tracking columns to cruises table
    console.log('3️⃣ Adding webhook tracking columns to cruises table...');

    // Check if columns exist first
    const columnsToAdd = [
      { name: 'webhook_priority', type: 'INTEGER DEFAULT 0' },
      { name: 'last_webhook_at', type: 'TIMESTAMP' },
      { name: 'webhook_source', type: 'VARCHAR(50)' },
      { name: 'last_price_snapshot_at', type: 'TIMESTAMP' },
      { name: 'price_change_count', type: 'INTEGER DEFAULT 0' },
    ];

    for (const column of columnsToAdd) {
      const checkResult = await client.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'cruises'
        AND column_name = $1
      `,
        [column.name]
      );

      if (checkResult.rows.length === 0) {
        await client.query(`
          ALTER TABLE cruises
          ADD COLUMN ${column.name} ${column.type}
        `);
        console.log(`   ✅ Added column: ${column.name}`);
      } else {
        console.log(`   ⏭️ Column already exists: ${column.name}`);
      }
    }
    console.log('✅ Cruise table enhanced\n');

    // 4. Create webhook_processing_log table for tracking
    console.log('4️⃣ Creating webhook processing log table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_processing_log (
        id SERIAL PRIMARY KEY,
        webhook_id VARCHAR(100) UNIQUE,
        line_id INTEGER,
        event_type VARCHAR(50),
        cruises_processed INTEGER DEFAULT 0,
        cruises_created INTEGER DEFAULT 0,
        cruises_updated INTEGER DEFAULT 0,
        cruises_failed INTEGER DEFAULT 0,
        processing_time_ms INTEGER,
        status VARCHAR(20),
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);
    console.log('✅ Webhook processing log table created\n');

    // 5. Create index for better performance
    console.log('5️⃣ Creating performance indexes...');

    const indexes = [
      {
        name: 'idx_cruises_needs_price_update',
        query:
          'CREATE INDEX IF NOT EXISTS idx_cruises_needs_price_update ON cruises(needs_price_update) WHERE needs_price_update = true',
      },
      {
        name: 'idx_cruises_webhook_priority',
        query:
          'CREATE INDEX IF NOT EXISTS idx_cruises_webhook_priority ON cruises(webhook_priority DESC, last_webhook_at ASC)',
      },
      {
        name: 'idx_cruises_sailing_date_future',
        query:
          'CREATE INDEX IF NOT EXISTS idx_cruises_sailing_date_future ON cruises(sailing_date)',
      },
      {
        name: 'idx_webhook_log_created',
        query:
          'CREATE INDEX IF NOT EXISTS idx_webhook_log_created ON webhook_processing_log(created_at DESC)',
      },
    ];

    for (const index of indexes) {
      try {
        await client.query(index.query);
        console.log(`   ✅ Created index: ${index.name}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`   ⏭️ Index already exists: ${index.name}`);
        } else {
          throw error;
        }
      }
    }
    console.log('✅ Performance indexes created\n');

    // 6. Verify the setup
    console.log('6️⃣ Verifying setup...');

    // Check system flags
    const flagCheck = await client.query('SELECT COUNT(*) as count FROM system_flags');
    console.log(`   System flags: ${flagCheck.rows[0].count}`);

    // Check cruise columns
    const cruiseColumnCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'cruises'
      AND column_name IN ('webhook_priority', 'last_webhook_at', 'webhook_source')
    `);
    console.log(`   Webhook tracking columns: ${cruiseColumnCheck.rows.length}/3`);

    // Check tables
    const tableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN ('system_flags', 'webhook_processing_log')
      AND table_schema = 'public'
    `);
    console.log(`   Required tables: ${tableCheck.rows.length}/2`);

    console.log('✅ Setup verification complete\n');

    // 7. Display current configuration
    console.log('7️⃣ Current Configuration:');
    const currentFlags = await client.query(`
      SELECT key, value, description
      FROM system_flags
      ORDER BY key
    `);
    console.table(currentFlags.rows);

    // 8. Check for any cruises that need processing
    const pendingCheck = await client.query(`
      SELECT
        COUNT(*) as total_pending,
        COUNT(*) FILTER (WHERE sailing_date >= CURRENT_DATE) as future_pending,
        MIN(sailing_date) as earliest_sailing,
        MAX(sailing_date) as latest_sailing
      FROM cruises
      WHERE needs_price_update = true
    `);

    const pending = pendingCheck.rows[0];
    console.log('\n📊 Pending Updates:');
    console.log(`   Total cruises needing update: ${pending.total_pending}`);
    console.log(`   Future cruises needing update: ${pending.future_pending}`);
    if (pending.total_pending > 0) {
      console.log(`   Date range: ${pending.earliest_sailing} to ${pending.latest_sailing}`);
    }

    console.log('\n✅ All webhook improvements applied successfully!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Deploy the enhanced webhook service');
    console.log('   2. Update webhook routes to use enhancedWebhookService');
    console.log('   3. Test with a small webhook before full deployment');
    console.log('   4. Monitor webhook_processing_log table for results');
  } catch (error) {
    console.error('❌ Error applying improvements:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
applyWebhookImprovements().catch(console.error);
