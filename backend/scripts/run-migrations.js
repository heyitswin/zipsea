#!/usr/bin/env node

/**
 * Run database migrations on production
 * This creates all necessary tables and indexes
 */

require('dotenv').config();
const { migrate } = require('drizzle-orm/postgres-js/migrator');
const { db } = require('../dist/db/connection');
const path = require('path');

console.log('🗄️  Running Database Migrations');
console.log('================================\n');

async function runMigrations() {
  try {
    console.log('📍 Migration folder:', path.join(__dirname, '../src/db/migrations'));
    console.log('🔗 Database URL:', process.env.DATABASE_URL ? 'Connected' : 'Not found');
    console.log('\nStarting migrations...\n');

    // Run the migrations
    await migrate(db, { 
      migrationsFolder: path.join(__dirname, '../src/db/migrations')
    });

    console.log('✅ Migrations completed successfully!\n');
    
    // Verify tables exist
    console.log('Verifying tables...');
    const tables = await db.execute(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);
    
    console.log('\n📊 Tables created:');
    if (tables.rows) {
      tables.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.tablename}`);
      });
    }
    
    console.log('\n✨ Database is ready for data sync!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();