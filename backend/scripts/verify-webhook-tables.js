require('dotenv').config();
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { sql } = require('drizzle-orm');

const connectionString = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL or DATABASE_URL_PRODUCTION environment variable is required');
  process.exit(1);
}

const client = postgres(connectionString, {
  ssl: 'require'
});
const db = drizzle(client);

async function verifyWebhookTables() {
  console.log('\n=== Verifying Webhook Tables ===\n');

  try {
    // Check what webhook-related tables exist
    const tables = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('webhook_events', 'system_flags', 'price_snapshots', 'sync_locks', 'webhook_processing_log')
      ORDER BY table_name
    `);

    console.log('📊 Webhook-related tables:');
    if (tables && tables.rows) {
      tables.rows.forEach(t => console.log(`  ✅ ${t.table_name}`));
    } else {
      console.log('  ❌ No webhook tables found');
    }

    // For webhook_events, check the schema
    const webhookEventsColumns = await db.execute(sql`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'webhook_events'
      ORDER BY ordinal_position
    `);

    if (webhookEventsColumns && webhookEventsColumns.rows && webhookEventsColumns.rows.length > 0) {
      console.log('\n✅ webhook_events table structure:');
      webhookEventsColumns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default || 'none'})`);
      });

      // Check if required columns exist
      const requiredCols = ['id', 'status', 'created_at', 'processed_at'];
      const existingCols = webhookEventsColumns.rows.map(c => c.column_name);
      const missingCols = requiredCols.filter(rc => !existingCols.includes(rc));

      if (missingCols.length > 0) {
        console.log(`\n⚠️  Missing required columns: ${missingCols.join(', ')}`);
      } else {
        console.log('\n✅ All required columns exist');
      }

      // Test inserting a sample webhook event
      console.log('\n📝 Testing webhook_events table insert...');
      try {
        await db.execute(sql`
          INSERT INTO webhook_events (event_type, line_id, payload, status)
          VALUES ('test', 1, '{"test": true}'::jsonb, 'pending')
        `);
        console.log('✅ Successfully inserted test record');

        // Delete the test record
        await db.execute(sql`
          DELETE FROM webhook_events
          WHERE event_type = 'test'
          AND payload->>'test' = 'true'
        `);
        console.log('✅ Successfully cleaned up test record');
      } catch (insertErr) {
        console.error('❌ Insert test failed:', insertErr.message);
      }
    } else {
      console.log('\n❌ webhook_events table does not exist');
    }

  } catch (error) {
    console.error('❌ Verification error:', error.message);
  } finally {
    await client.end();
  }
}

verifyWebhookTables();
