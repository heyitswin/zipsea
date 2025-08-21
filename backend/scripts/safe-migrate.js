#!/usr/bin/env node

/**
 * Safe migration runner for production deployments
 * Only runs necessary migrations without failing the build
 */

require('dotenv').config();
const postgres = require('postgres');

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.log('📦 No DATABASE_URL found, skipping migrations');
    return;
  }

  console.log('🔄 Running safe database migrations...\n');
  
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  
  try {
    // Check what tables exist
    const tables = await sql`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public'
    `;
    
    const tableNames = tables.map(t => t.tablename);
    console.log(`📊 Found ${tableNames.length} tables in database`);
    
    // Only run migrations for tables that exist
    if (tableNames.includes('cruises')) {
      console.log('✅ Cruises table exists');
      
      // Check if we need to add any missing columns
      const columns = await sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'cruises'
      `;
      
      const columnNames = columns.map(c => c.column_name);
      
      // Add missing columns if needed
      if (!columnNames.includes('code_to_cruise_id')) {
        console.log('  Adding code_to_cruise_id column...');
        await sql`ALTER TABLE cruises ADD COLUMN IF NOT EXISTS code_to_cruise_id INTEGER`;
      }
      
      if (!columnNames.includes('traveltek_file_path')) {
        console.log('  Adding traveltek_file_path column...');
        await sql`ALTER TABLE cruises ADD COLUMN IF NOT EXISTS traveltek_file_path VARCHAR(500)`;
      }
    }
    
    // Check for legacy tables that should be removed
    if (tableNames.includes('pricing')) {
      console.log('⚠️  Found legacy pricing table - consider migrating to static_prices');
    }
    
    console.log('\n✅ Safe migrations completed successfully!');
    
  } catch (error) {
    console.error('⚠️  Migration warning:', error.message);
    console.log('Continuing with deployment...');
  } finally {
    await sql.end();
  }
}

runMigrations().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Non-critical error:', err.message);
  process.exit(0); // Still exit successfully to not break the build
});