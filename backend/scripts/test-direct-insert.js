require('dotenv').config();
const { Client } = require('pg');

async function testDirectInsert() {
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

    // Test direct insert
    console.log('\n📝 Testing direct insert into webhook_events...');
    const insertQuery = `
      INSERT INTO webhook_events (line_id, webhook_type, status, metadata)
      VALUES ($1, $2, $3, $4::jsonb)
      RETURNING *
    `;

    const testData = {
      event: 'cruiseline-pricing-updated',
      test: true,
      timestamp: new Date().toISOString()
    };

    const result = await client.query(insertQuery, [
      1, // line_id
      'cruiseline-pricing-updated', // webhook_type
      'pending', // status
      JSON.stringify(testData) // metadata
    ]);

    if (result.rows.length > 0) {
      const event = result.rows[0];
      console.log('✅ Successfully inserted webhook event:');
      console.log(`  ID: ${event.id}`);
      console.log(`  Line ID: ${event.line_id}`);
      console.log(`  Type: ${event.webhook_type}`);
      console.log(`  Status: ${event.status}`);
      console.log(`  Received: ${event.received_at}`);

      // Check if we can query it back
      console.log('\n📊 Querying webhook events...');
      const queryResult = await client.query(
        'SELECT * FROM webhook_events ORDER BY id DESC LIMIT 5'
      );

      console.log(`Found ${queryResult.rows.length} events:`);
      queryResult.rows.forEach(row => {
        console.log(`  - Event ${row.id}: ${row.webhook_type} (status: ${row.status}, line: ${row.line_id})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
  } finally {
    await client.end();
    console.log('\n👋 Database connection closed');
  }
}

testDirectInsert();
