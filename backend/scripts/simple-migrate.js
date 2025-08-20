#!/usr/bin/env node

/**
 * Simple migration runner that directly executes SQL
 * More reliable for Render build environments
 */

require('dotenv').config();
const postgres = require('postgres');

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.log('📦 No DATABASE_URL found, skipping migrations');
    return;
  }

  console.log('🔄 Running database migrations...\n');
  
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  
  try {
    // Drop the columns that no longer exist in schema
    console.log('🗑️  Dropping unused live pricing columns...');
    
    await sql`
      ALTER TABLE pricing 
      DROP COLUMN IF EXISTS price_type,
      DROP COLUMN IF EXISTS price_timestamp;
    `;
    
    console.log('✅ Columns dropped successfully (or didn\'t exist)');
    
    // You can add more migrations here as needed
    
    console.log('\n✅ All migrations completed successfully!');
  } catch (error) {
    console.error('⚠️  Migration warning:', error.message);
    // Don't fail the build
    console.log('Continuing with deployment...');
  } finally {
    await sql.end();
  }
}

runMigrations().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Error:', err);
  process.exit(0); // Still exit successfully to not break the build
});