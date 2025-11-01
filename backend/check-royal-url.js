const { drizzle } = require('drizzle-orm/node-postgres');
const { Client } = require('pg');

async function checkUrl() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to production database');
    
    const result = await client.query(`
      SELECT id, name, cancellation_policy_url 
      FROM cruise_lines 
      WHERE name ILIKE '%royal caribbean%' 
      LIMIT 5
    `);
    
    console.log('\n📋 Royal Caribbean cancellation URLs:');
    console.log('===========================================');
    result.rows.forEach(row => {
      console.log(`ID: ${row.id}`);
      console.log(`Name: ${row.name}`);
      console.log(`URL: ${row.cancellation_policy_url || 'NULL'}`);
      console.log('-------------------------------------------');
    });
    
    if (result.rows.length === 0) {
      console.log('⚠️  No Royal Caribbean cruise lines found');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

checkUrl();
