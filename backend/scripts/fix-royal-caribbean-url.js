/**
 * Fix Royal Caribbean cancellation policy URL in production database
 * 
 * Run this on Render production backend:
 * node scripts/fix-royal-caribbean-url.js
 */

const { Client } = require('pg');

const CORRECT_URL = 'https://www.royalcaribbean.com/faq/questions/booking-cancellation-refund-policy';

async function fixRoyalCaribbeanUrl() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Check current URL
    const checkResult = await client.query(`
      SELECT id, name, cancellation_policy_url 
      FROM cruise_lines 
      WHERE name ILIKE '%royal caribbean%'
    `);
    
    console.log('\n📋 Current Royal Caribbean entries:');
    console.log('===========================================');
    checkResult.rows.forEach(row => {
      console.log(`ID: ${row.id}`);
      console.log(`Name: ${row.name}`);
      console.log(`Current URL: ${row.cancellation_policy_url || 'NULL'}`);
      console.log('-------------------------------------------');
    });
    
    if (checkResult.rows.length === 0) {
      console.log('⚠️  No Royal Caribbean cruise lines found');
      return;
    }
    
    // Check if any need updating
    const needsUpdate = checkResult.rows.some(row => 
      row.cancellation_policy_url !== CORRECT_URL
    );
    
    if (!needsUpdate) {
      console.log('\n✅ All Royal Caribbean URLs are already correct!');
      return;
    }
    
    // Update to correct URL
    console.log(`\n🔧 Updating to correct URL: ${CORRECT_URL}`);
    const updateResult = await client.query(`
      UPDATE cruise_lines 
      SET cancellation_policy_url = $1 
      WHERE name ILIKE '%royal caribbean%'
      RETURNING id, name, cancellation_policy_url
    `, [CORRECT_URL]);
    
    console.log('\n✅ Updated entries:');
    console.log('===========================================');
    updateResult.rows.forEach(row => {
      console.log(`ID: ${row.id}`);
      console.log(`Name: ${row.name}`);
      console.log(`New URL: ${row.cancellation_policy_url}`);
      console.log('-------------------------------------------');
    });
    
    console.log(`\n✅ Successfully updated ${updateResult.rowCount} Royal Caribbean entries`);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

fixRoyalCaribbeanUrl().catch(err => {
  console.error('Failed to fix URL:', err);
  process.exit(1);
});
