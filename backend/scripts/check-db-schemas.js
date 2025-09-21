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

async function checkDatabaseSchemas() {
  console.log('\n=== Checking Database Schemas ===\n');

  try {
    // Get all schemas
    const schemas = await db.execute(sql`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `);

    console.log('📊 Available schemas:');
    if (schemas && schemas.rows) {
      schemas.rows.forEach(s => console.log(`  - ${s.schema_name}`));
    }

    // Check current schema
    const currentSchema = await db.execute(sql`
      SELECT current_schema()
    `);

    if (currentSchema && currentSchema.rows && currentSchema.rows[0]) {
      console.log(`\n📍 Current schema: ${currentSchema.rows[0].current_schema}`);
    }

    // Check search path
    const searchPath = await db.execute(sql`
      SHOW search_path
    `);

    if (searchPath && searchPath.rows && searchPath.rows[0]) {
      console.log(`🔍 Search path: ${searchPath.rows[0].search_path}`);
    }

    // Check for webhook_events in all schemas
    console.log('\n🔎 Searching for webhook_events table in all schemas:');
    const webhookTables = await db.execute(sql`
      SELECT
        table_schema,
        table_name
      FROM information_schema.tables
      WHERE table_name = 'webhook_events'
      ORDER BY table_schema
    `);

    if (webhookTables && webhookTables.rows && webhookTables.rows.length > 0) {
      webhookTables.rows.forEach(t => {
        console.log(`  ✅ Found in schema: ${t.table_schema}`);
      });
    } else {
      console.log('  ❌ Table webhook_events not found in any schema');
    }

    // List all tables in public schema
    console.log('\n📋 Tables in public schema:');
    const publicTables = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
      LIMIT 20
    `);

    if (publicTables && publicTables.rows) {
      publicTables.rows.forEach(t => console.log(`  - ${t.table_name}`));

      const totalCount = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `);

      if (totalCount.rows[0].count > 20) {
        console.log(`  ... and ${totalCount.rows[0].count - 20} more tables`);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkDatabaseSchemas();
