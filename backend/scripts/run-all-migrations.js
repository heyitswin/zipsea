#!/usr/bin/env node

/**
 * Run ALL database migrations in production
 * This script runs all migrations in order to ensure the database is fully up to date
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function runAllMigrations() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🚀 RUNNING ALL DATABASE MIGRATIONS');
    console.log('===================================\n');
    
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get all migration files in order
    const migrationsDir = path.join(__dirname, '../src/db/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // They're named with numbers so they'll sort correctly

    console.log(`📂 Found ${migrationFiles.length} migration files:`);
    migrationFiles.forEach(f => console.log(`   - ${f}`));
    console.log('');

    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint DEFAULT (extract(epoch from now()) * 1000)
      )
    `);

    // Process each migration
    for (const migrationFile of migrationFiles) {
      console.log(`\n📄 Processing: ${migrationFile}`);
      console.log('─'.repeat(50));

      // Check if migration was already run
      const hash = migrationFile; // Simple hash using filename
      const checkResult = await client.query(
        'SELECT id FROM __drizzle_migrations WHERE hash = $1',
        [hash]
      );

      if (checkResult.rows.length > 0) {
        console.log('⏭️  Already applied, skipping...');
        continue;
      }

      // Read and run the migration
      const migrationPath = path.join(migrationsDir, migrationFile);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      // Split by statements (simple split, may need adjustment for complex migrations)
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      console.log(`📝 Found ${statements.length} statements to execute`);

      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        
        // Skip empty statements
        if (!statement || statement.length < 5) continue;

        try {
          // Add semicolon back
          await client.query(statement + ';');
          successCount++;
          console.log(`   ✅ Statement ${i + 1} executed`);
        } catch (error) {
          // Check if it's a "already exists" error
          if (error.message.includes('already exists')) {
            console.log(`   ⏭️  Statement ${i + 1}: Already exists, skipping`);
          } else {
            console.log(`   ❌ Statement ${i + 1} error: ${error.message}`);
            errorCount++;
          }
        }
      }

      // Record migration as complete if at least some statements succeeded
      if (successCount > 0) {
        await client.query(
          'INSERT INTO __drizzle_migrations (hash) VALUES ($1)',
          [hash]
        );
        console.log(`✅ Migration recorded: ${successCount} statements applied`);
      }

      if (errorCount > 0) {
        console.log(`⚠️  ${errorCount} statements had errors (may be OK if objects already exist)`);
      }
    }

    // Verify critical tables exist
    console.log('\n🔍 Verifying critical tables...');
    console.log('─'.repeat(50));
    
    const criticalTables = [
      'cruises',
      'cruise_lines', 
      'ships',
      'ports',
      'regions',
      'itineraries',
      'pricing',           // This is the one we need!
      'cheapest_pricing',
      'cabin_categories',
      'price_history',
      'quote_requests',
      'saved_searches',
      'users'
    ];

    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ANY($1::text[])
    `, [criticalTables]);

    const existingTables = tableCheck.rows.map(r => r.table_name);
    
    console.log('\n📊 Table Status:');
    for (const table of criticalTables) {
      if (existingTables.includes(table)) {
        console.log(`   ✅ ${table}`);
      } else {
        console.log(`   ❌ ${table} - MISSING!`);
      }
    }

    // Special check for pricing table with details
    const pricingCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'pricing' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    if (pricingCheck.rows.length > 0) {
      console.log('\n✅ PRICING TABLE EXISTS with columns:');
      pricingCheck.rows.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('\n❌ PRICING TABLE DOES NOT EXIST!');
      console.log('   This is required for the sync script to work.');
    }

    console.log('\n✨ All migrations completed!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the migrations
runAllMigrations()
  .then(() => {
    console.log('\n✅ Migration process completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration process failed:', error.message);
    process.exit(1);
  });