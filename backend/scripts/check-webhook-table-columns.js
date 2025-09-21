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

async function checkWebhookTableColumns() {
  console.log('\n=== Checking webhook_events Table Columns ===\n');

  try {
    // First check if table exists
    const tableExists = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'webhook_events'
    `);

    if (!tableExists || !tableExists.rows || tableExists.rows.length === 0) {
      console.log('❌ webhook_events table does not exist');
      await client.end();
      return;
    }

    console.log('✅ webhook_events table exists');

    // Get column details
    const columns = await db.execute(sql`
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'webhook_events'
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    console.log('\n📊 Table columns:');
    if (columns && columns.rows) {
      columns.rows.forEach(col => {
        const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`  - ${col.column_name}: ${col.data_type}${length} ${nullable}${defaultVal}`);
      });
    }

    // Check which columns are needed by the code
    console.log('\n📝 Checking required columns:');
    const requiredColumns = ['id', 'line_id', 'webhook_type', 'status', 'metadata'];
    const existingColumns = columns.rows.map(c => c.column_name);

    requiredColumns.forEach(col => {
      if (existingColumns.includes(col)) {
        console.log(`  ✅ ${col} exists`);
      } else {
        console.log(`  ❌ ${col} is MISSING`);
      }
    });

    // Check if there are any records
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM webhook_events
    `);

    console.log(`\n📈 Total records: ${countResult.rows[0].count}`);

    // Try a test insert with minimal data
    console.log('\n🧪 Testing insert with minimal data...');
    try {
      const testResult = await db.execute(sql`
        INSERT INTO webhook_events (line_id, webhook_type, status)
        VALUES (1, 'test', 'pending')
        RETURNING id
      `);

      if (testResult && testResult.rows && testResult.rows.length > 0) {
        const testId = testResult.rows[0].id;
        console.log(`  ✅ Test insert successful (id: ${testId})`);

        // Clean up
        await db.execute(sql`DELETE FROM webhook_events WHERE id = ${testId}`);
        console.log('  ✅ Test record cleaned up');
      }
    } catch (insertError) {
      console.log(`  ❌ Test insert failed: ${insertError.message}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkWebhookTableColumns();
