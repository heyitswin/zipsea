#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function testWebhookInsert() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();

    console.log('\n🧪 Testing webhook_events insert...');

    // Test insert with the exact structure we're using
    const insertQuery = `
      INSERT INTO webhook_events (line_id, webhook_type, status, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

    const testData = {
      lineId: 22,
      webhookType: 'test_direct',
      status: 'pending',
      metadata: { test: true, timestamp: new Date().toISOString() }
    };

    console.log('Inserting test record with data:', testData);

    const result = await client.query(insertQuery, [
      testData.lineId,
      testData.webhookType,
      testData.status,
      JSON.stringify(testData.metadata)
    ]);

    console.log('\n✅ Insert successful!');
    console.log('Inserted record:', result.rows[0]);

    // Clean up test record
    const deleteQuery = 'DELETE FROM webhook_events WHERE id = $1';
    await client.query(deleteQuery, [result.rows[0].id]);
    console.log('\n🧹 Test record cleaned up');

  } catch (error) {
    console.error('\n❌ Insert failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);

    if (error.message.includes('column') && error.message.includes('does not exist')) {
      console.log('\n⚠️  This suggests the table structure doesn\'t match what the code expects.');
      console.log('Run `node scripts/check-webhook-tables.js` to see the actual structure.');
    }
  } finally {
    await client.end();
  }
}

testWebhookInsert();
