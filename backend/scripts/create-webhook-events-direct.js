require('dotenv').config();
const { Client } = require('pg');

async function createWebhookEventsTable() {
  const connectionString = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL_PRODUCTION or DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('📡 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    // Create the webhook_events table
    console.log('\n📝 Creating webhook_events table...');
    const createTableQuery = `
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
    `;

    await client.query(createTableQuery);
    console.log('✅ Table created/verified');

    // Create indexes
    console.log('\n📝 Creating indexes...');

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status)',
      'CREATE INDEX IF NOT EXISTS idx_webhook_events_line_id ON webhook_events(line_id)',
      'CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at ON webhook_events(received_at)'
    ];

    for (const indexQuery of indexes) {
      await client.query(indexQuery);
      console.log(`✅ Index created: ${indexQuery.match(/idx_\w+/)[0]}`);
    }

    // Verify the table
    console.log('\n📊 Verifying table structure...');
    const verifyQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'webhook_events'
      ORDER BY ordinal_position
    `;

    const result = await client.query(verifyQuery);

    if (result.rows.length > 0) {
      console.log('✅ Table structure:');
      result.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    } else {
      console.log('⚠️  Could not verify table structure');
    }

    // Test insert
    console.log('\n🧪 Testing insert...');
    const testInsert = `
      INSERT INTO webhook_events (line_id, webhook_type, status)
      VALUES (1, 'test', 'pending')
      RETURNING id
    `;

    const testResult = await client.query(testInsert);
    const testId = testResult.rows[0].id;
    console.log(`✅ Test insert successful (id: ${testId})`);

    // Clean up test
    await client.query('DELETE FROM webhook_events WHERE id = $1', [testId]);
    console.log('✅ Test record cleaned up');

    console.log('\n🎉 webhook_events table is ready for use!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n👋 Database connection closed');
  }
}

createWebhookEventsTable();
