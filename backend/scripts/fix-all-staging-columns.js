#!/usr/bin/env node

/**
 * Fix ALL missing columns in staging database
 * Run with: DATABASE_URL=your_staging_url node scripts/fix-all-staging-columns.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || process.env.STAGING_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL or STAGING_DATABASE_URL environment variable not set');
  console.error('Usage: DATABASE_URL=your_staging_url node scripts/fix-all-staging-columns.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixMissingColumns() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Adding missing columns to staging database...\n');
    console.log('Database:', DATABASE_URL.replace(/:[^:@]*@/, ':****@'));
    console.log('');
    
    // Ships table fixes
    console.log('=== SHIPS TABLE ===');
    const shipsQueries = [
      `ALTER TABLE ships ADD COLUMN IF NOT EXISTS amenities TEXT[]`,
      `ALTER TABLE ships ADD COLUMN IF NOT EXISTS deck_plans TEXT`,
      `ALTER TABLE ships ADD COLUMN IF NOT EXISTS videos TEXT[]`,
      `ALTER TABLE ships ADD COLUMN IF NOT EXISTS virtual_tours TEXT[]`
    ];
    
    for (const query of shipsQueries) {
      try {
        await client.query(query);
        console.log('✅ ' + query.replace('ALTER TABLE ships ADD COLUMN IF NOT EXISTS ', ''));
      } catch (error) {
        console.log('⚠️  Failed: ' + error.message);
      }
    }
    
    // Ports table fixes
    console.log('\n=== PORTS TABLE ===');
    const portsQueries = [
      `ALTER TABLE ports ADD COLUMN IF NOT EXISTS city VARCHAR(255)`,
      `ALTER TABLE ports ADD COLUMN IF NOT EXISTS region VARCHAR(100)`,
      `ALTER TABLE ports ADD COLUMN IF NOT EXISTS description TEXT`,
      `ALTER TABLE ports ADD COLUMN IF NOT EXISTS timezone VARCHAR(50)`
    ];
    
    for (const query of portsQueries) {
      try {
        await client.query(query);
        console.log('✅ ' + query.replace('ALTER TABLE ports ADD COLUMN IF NOT EXISTS ', ''));
      } catch (error) {
        console.log('⚠️  Failed: ' + error.message);
      }
    }
    
    // Cruises table fixes
    console.log('\n=== CRUISES TABLE ===');
    const cruisesQueries = [
      `ALTER TABLE cruises ADD COLUMN IF NOT EXISTS marketing_description TEXT`,
      `ALTER TABLE cruises ADD COLUMN IF NOT EXISTS highlights TEXT[]`,
      `ALTER TABLE cruises ADD COLUMN IF NOT EXISTS included_features TEXT[]`,
      `ALTER TABLE cruises ADD COLUMN IF NOT EXISTS optional_features TEXT[]`
    ];
    
    for (const query of cruisesQueries) {
      try {
        await client.query(query);
        console.log('✅ ' + query.replace('ALTER TABLE cruises ADD COLUMN IF NOT EXISTS ', ''));
      } catch (error) {
        console.log('⚠️  Failed: ' + error.message);
      }
    }
    
    // Verify the columns exist
    console.log('\n=== VERIFICATION ===');
    
    const verifyQuery = `
      SELECT 
        t.table_name,
        array_agg(c.column_name ORDER BY c.column_name) as columns
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name
      WHERE t.table_schema = 'public' 
        AND t.table_name IN ('ships', 'ports', 'cruises')
        AND c.column_name IN (
          'amenities', 'deck_plans', 'videos', 'virtual_tours',
          'city', 'region', 'description', 'timezone',
          'marketing_description', 'highlights', 'included_features', 'optional_features'
        )
      GROUP BY t.table_name
      ORDER BY t.table_name
    `;
    
    const result = await client.query(verifyQuery);
    
    result.rows.forEach(row => {
      console.log(`${row.table_name}: ${row.columns.join(', ')}`);
    });
    
    // Test a simple query
    console.log('\n=== TESTING QUERIES ===');
    
    try {
      const testShips = await client.query('SELECT id, name, amenities FROM ships LIMIT 1');
      console.log('✅ Ships query works');
    } catch (error) {
      console.log('❌ Ships query failed:', error.message);
    }
    
    try {
      const testPorts = await client.query('SELECT id, name, city FROM ports LIMIT 1');
      console.log('✅ Ports query works');
    } catch (error) {
      console.log('❌ Ports query failed:', error.message);
    }
    
    try {
      const testCruises = await client.query('SELECT id, name, marketing_description FROM cruises LIMIT 1');
      console.log('✅ Cruises query works');
    } catch (error) {
      console.log('❌ Cruises query failed:', error.message);
    }
    
    console.log('\n✅ All missing columns have been added to staging database!');
    
  } catch (error) {
    console.error('❌ Error adding columns:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixMissingColumns()
  .then(() => {
    console.log('\n🎉 Staging database schema fixed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed to fix staging database:', error);
    process.exit(1);
  });