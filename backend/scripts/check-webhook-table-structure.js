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
  ssl: 'require',
});
const db = drizzle(client);

async function checkWebhookTable() {
  console.log('\n=== Checking Webhook Events Table Structure ===\n');

  try {
    // Check if table exists and get column info
    const tableInfo = await db.execute(sql`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'webhook_events'
      ORDER BY ordinal_position
    `);

    if (!tableInfo || !tableInfo.rows || tableInfo.rows.length === 0) {
      console.log('⚠️  webhook_events table does not exist!');

      // Check what tables do exist
      const tables = await db.execute(sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name LIKE '%webhook%'
        ORDER BY table_name
      `);

      console.log('\nTables with "webhook" in name:');
      if (tables && tables.rows) {
        tables.rows.forEach(t => console.log(`  - ${t.table_name}`));
      }
    } else {
      console.log('✅ webhook_events table exists with columns:');
      tableInfo.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });

      // Count records
      const count = await db.execute(sql`
        SELECT COUNT(*) as total FROM webhook_events
      `);
      console.log(`\nTotal records: ${count.rows[0].total}`);

      // Get sample record
      const sample = await db.execute(sql`
        SELECT * FROM webhook_events LIMIT 1
      `);

      if (sample.rows.length > 0) {
        console.log('\nSample record:');
        console.log(JSON.stringify(sample.rows[0], null, 2));
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkWebhookTable();
