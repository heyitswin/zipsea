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

async function createWebhookEventsTable() {
  console.log('\n=== Creating webhook_events Table ===\n');

  try {
    // Create the webhook_events table based on Drizzle schema
    console.log('📝 Creating webhook_events table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id SERIAL PRIMARY KEY,
        line_id INTEGER NOT NULL,
        webhook_type VARCHAR(50),
        status VARCHAR(50) DEFAULT 'pending',
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP,
        metadata JSONB,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0
      )
    `);
    console.log('✅ Table created');

    // Create indexes
    console.log('\n📝 Creating indexes...');

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_webhook_events_status
      ON webhook_events(status)
    `);
    console.log('✅ Created status index');

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_webhook_events_line_id
      ON webhook_events(line_id)
    `);
    console.log('✅ Created line_id index');

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at
      ON webhook_events(received_at)
    `);
    console.log('✅ Created received_at index');

    // Verify the table was created
    const verification = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'webhook_events'
      ORDER BY ordinal_position
    `);

    if (verification && verification.rows && verification.rows.length > 0) {
      console.log('\n✅ Table created successfully with columns:');
      verification.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    }

    // Test insert
    console.log('\n📝 Testing insert...');
    const testResult = await db.execute(sql`
      INSERT INTO webhook_events (line_id, webhook_type, status, metadata)
      VALUES (1, 'test', 'pending', '{"test": true}'::jsonb)
      RETURNING id
    `);

    if (testResult && testResult.rows && testResult.rows.length > 0) {
      const testId = testResult.rows[0].id;
      console.log(`✅ Test insert successful (id: ${testId})`);

      // Clean up test
      await db.execute(sql`
        DELETE FROM webhook_events WHERE id = ${testId}
      `);
      console.log('✅ Test record cleaned up');
    }

    console.log('\n✅ webhook_events table is ready for use!');

  } catch (error) {
    console.error('❌ Failed to create table:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createWebhookEventsTable();
