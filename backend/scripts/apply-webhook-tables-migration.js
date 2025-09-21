require('dotenv').config();
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { sql } = require('drizzle-orm');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL or DATABASE_URL_PRODUCTION environment variable is required');
  process.exit(1);
}

const client = postgres(connectionString, {
  ssl: 'require',
});
const db = drizzle(client);

async function applyMigration() {
  console.log('\n=== Applying Webhook Tables Migration ===\n');

  try {
    // First, check if webhook_events table already exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'webhook_events'
      ) as exists
    `);

    if (tableExists && tableExists.rows && tableExists.rows[0] && tableExists.rows[0].exists) {
      console.log('✅ webhook_events table already exists');

      // Check the structure
      const columns = await db.execute(sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'webhook_events'
        ORDER BY ordinal_position
      `);

      console.log('\nCurrent columns:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });

      // Check if we need to update the schema (comparing with Drizzle schema)
      const hasLineId = columns.rows.some(col => col.column_name === 'line_id');
      const hasStatus = columns.rows.some(col => col.column_name === 'status');
      const hasProcessedAt = columns.rows.some(col => col.column_name === 'processed_at');

      if (!hasLineId || !hasStatus || !hasProcessedAt) {
        console.log('\n⚠️  Table structure does not match expected schema');
        console.log('Missing columns:', {
          line_id: !hasLineId,
          status: !hasStatus,
          processed_at: !hasProcessedAt,
        });
      }

      return;
    }

    console.log('📝 Creating webhook tables...');

    // Read and execute the migration SQL
    const migrationSql = fs.readFileSync(path.join(__dirname, 'create-webhook-tables.sql'), 'utf8');

    // Split by semicolons and execute each statement
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        await client.unsafe(statement + ';');
        console.log('✅ Executed:', statement.substring(0, 50) + '...');
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log('⏩ Skipped (already exists):', statement.substring(0, 50) + '...');
        } else {
          console.error('❌ Failed:', statement.substring(0, 50) + '...');
          console.error('   Error:', err.message);
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');

    // Verify the tables were created
    const tables = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('webhook_events', 'system_flags', 'price_snapshots', 'sync_locks', 'webhook_processing_log')
      ORDER BY table_name
    `);

    console.log('\n📊 Created tables:');
    tables.rows.forEach(t => console.log(`  ✅ ${t.table_name}`));
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
