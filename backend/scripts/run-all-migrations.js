#!/usr/bin/env node

/**
 * Run ALL database migrations from scratch
 * This creates all tables including cruises, ships, ports, etc.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Get database URL from environment
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
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get all migration files in order
    const migrationsDir = path.join(__dirname, '../src/db/migrations');
    let migrationFiles = [];
    
    try {
      const files = fs.readdirSync(migrationsDir);
      migrationFiles = files
        .filter(f => f.endsWith('.sql'))
        .sort(); // Ensures they run in order (0000, 0001, etc.)
      
      console.log(`📁 Found ${migrationFiles.length} migration files:`);
      migrationFiles.forEach(f => console.log(`   - ${f}`));
      console.log('');
    } catch (error) {
      console.error('❌ Could not read migrations directory:', error.message);
      console.log('\nMigrations directory might not exist in production.');
      console.log('Running inline migrations instead...\n');
      
      // Run inline migrations if files don't exist
      await runInlineMigrations(client);
      return;
    }

    // Run each migration file
    for (const migrationFile of migrationFiles) {
      console.log(`\n🚀 Running migration: ${migrationFile}`);
      console.log('─'.repeat(50));
      
      const migrationPath = path.join(migrationsDir, migrationFile);
      
      try {
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Split by semicolon and run each statement
        const statements = migrationSQL
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        let successCount = 0;
        let skipCount = 0;

        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          
          try {
            // Handle DO blocks specially
            if (statement.includes('DO $$')) {
              // Find the complete DO block
              let doBlock = statement;
              while (!doBlock.includes('END $$') && i < statements.length - 1) {
                i++;
                doBlock += '; ' + statements[i];
              }
              await client.query(doBlock + ';');
              successCount++;
            } else {
              await client.query(statement + ';');
              successCount++;
            }
          } catch (error) {
            if (error.message.includes('already exists') || 
                error.message.includes('duplicate key')) {
              skipCount++;
            } else {
              console.error(`   ❌ Error: ${error.message.substring(0, 100)}`);
            }
          }
        }

        console.log(`   ✅ Success: ${successCount} statements`);
        if (skipCount > 0) console.log(`   ⏭️  Skipped: ${skipCount} (already exist)`);
        
      } catch (error) {
        console.error(`❌ Failed to read/process ${migrationFile}:`, error.message);
      }
    }

    await verifyTables(client);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

async function runInlineMigrations(client) {
  console.log('🚀 Running inline migrations...\n');
  
  // First, create all main tables
  const createTablesSQL = `
-- Create users table
CREATE TABLE IF NOT EXISTS "users" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "email" varchar(255) NOT NULL,
  "first_name" varchar(100),
  "last_name" varchar(100),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create cruise_lines table
CREATE TABLE IF NOT EXISTS "cruise_lines" (
  "id" integer PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "code" varchar(50),
  "description" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create ships table
CREATE TABLE IF NOT EXISTS "ships" (
  "id" integer PRIMARY KEY NOT NULL,
  "cruise_line_id" integer NOT NULL,
  "name" varchar(255) NOT NULL,
  "code" varchar(50),
  "ship_class" varchar(100),
  "tonnage" integer,
  "total_cabins" integer,
  "capacity" integer,
  "rating" integer,
  "description" text,
  "highlights" text,
  "default_image_url" varchar(500),
  "default_image_url_hd" varchar(500),
  "images" json DEFAULT '[]'::json,
  "additional_info" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create ports table
CREATE TABLE IF NOT EXISTS "ports" (
  "id" integer PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "code" varchar(50),
  "country" varchar(100),
  "region" varchar(100),
  "latitude" numeric(10, 6),
  "longitude" numeric(10, 6),
  "description" text,
  "image_url" varchar(500),
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create regions table
CREATE TABLE IF NOT EXISTS "regions" (
  "id" integer PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "code" varchar(50),
  "description" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create cruises table
CREATE TABLE IF NOT EXISTS "cruises" (
  "id" integer PRIMARY KEY NOT NULL,
  "code_to_cruise_id" varchar(50),
  "cruise_line_id" integer NOT NULL,
  "ship_id" integer NOT NULL,
  "name" varchar(500),
  "itinerary_code" varchar(50),
  "voyage_code" varchar(50),
  "sailing_date" date,
  "return_date" date,
  "nights" integer,
  "sail_nights" integer,
  "sea_days" integer,
  "embark_port_id" integer,
  "disembark_port_id" integer,
  "region_ids" json DEFAULT '[]'::json,
  "port_ids" json DEFAULT '[]'::json,
  "market_id" integer,
  "owner_id" integer,
  "no_fly" boolean DEFAULT false,
  "depart_uk" boolean DEFAULT false,
  "show_cruise" boolean DEFAULT true,
  "fly_cruise_info" text,
  "line_content" text,
  "traveltek_file_path" varchar(500),
  "last_cached" timestamp,
  "cached_date" timestamp,
  "currency" varchar(3) DEFAULT 'USD',
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create alternative_sailings table
CREATE TABLE IF NOT EXISTS "alternative_sailings" (
  "id" serial PRIMARY KEY NOT NULL,
  "base_cruise_id" integer NOT NULL,
  "alternative_cruise_id" integer NOT NULL,
  "sailing_date" date,
  "price" numeric(10, 2),
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create itineraries table
CREATE TABLE IF NOT EXISTS "itineraries" (
  "id" serial PRIMARY KEY NOT NULL,
  "cruise_id" integer NOT NULL,
  "day_number" integer NOT NULL,
  "date" date,
  "port_name" varchar(255),
  "port_id" integer,
  "arrival_time" varchar(10),
  "departure_time" varchar(10),
  "status" varchar(50) DEFAULT 'port',
  "overnight" boolean DEFAULT false,
  "description" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create cabin_categories table
CREATE TABLE IF NOT EXISTS "cabin_categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "ship_id" integer NOT NULL,
  "name" varchar(255) NOT NULL,
  "cabin_code" varchar(10) NOT NULL,
  "cabin_code_alt" varchar(10),
  "category" varchar(50),
  "category_alt" varchar(50),
  "description" text,
  "color_code" varchar(20),
  "color_code_alt" varchar(20),
  "image_url" varchar(500),
  "image_url_hd" varchar(500),
  "is_default" boolean DEFAULT false,
  "valid_from" date,
  "valid_to" date,
  "max_occupancy" integer,
  "min_occupancy" integer DEFAULT 1,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create pricing table
CREATE TABLE IF NOT EXISTS "pricing" (
  "id" serial PRIMARY KEY NOT NULL,
  "cruise_id" integer NOT NULL,
  "rate_code" varchar(50) NOT NULL,
  "cabin_code" varchar(10) NOT NULL,
  "occupancy_code" varchar(10) NOT NULL,
  "cabin_type" varchar(50),
  "base_price" numeric(10, 2),
  "adult_price" numeric(10, 2),
  "child_price" numeric(10, 2),
  "infant_price" numeric(10, 2),
  "single_price" numeric(10, 2),
  "third_adult_price" numeric(10, 2),
  "fourth_adult_price" numeric(10, 2),
  "taxes" numeric(10, 2),
  "ncf" numeric(10, 2),
  "gratuity" numeric(10, 2),
  "fuel" numeric(10, 2),
  "non_comm" numeric(10, 2),
  "port_charges" numeric(10, 2),
  "government_fees" numeric(10, 2),
  "total_price" numeric(10, 2),
  "commission" numeric(10, 2),
  "is_available" boolean DEFAULT true,
  "inventory" integer,
  "waitlist" boolean DEFAULT false,
  "guarantee" boolean DEFAULT false,
  "price_type" varchar(10) DEFAULT 'static',
  "price_timestamp" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create cheapest_pricing table
CREATE TABLE IF NOT EXISTS "cheapest_pricing" (
  "id" serial PRIMARY KEY NOT NULL,
  "cruise_id" integer NOT NULL UNIQUE,
  "cheapest_price" numeric(10, 2),
  "cheapest_cabin_type" varchar(50),
  "cheapest_taxes" numeric(10, 2),
  "cheapest_ncf" numeric(10, 2),
  "cheapest_gratuity" numeric(10, 2),
  "cheapest_fuel" numeric(10, 2),
  "cheapest_non_comm" numeric(10, 2),
  "interior_price" numeric(10, 2),
  "interior_taxes" numeric(10, 2),
  "interior_ncf" numeric(10, 2),
  "interior_gratuity" numeric(10, 2),
  "interior_fuel" numeric(10, 2),
  "interior_non_comm" numeric(10, 2),
  "interior_price_code" varchar(50),
  "oceanview_price" numeric(10, 2),
  "oceanview_taxes" numeric(10, 2),
  "oceanview_ncf" numeric(10, 2),
  "oceanview_gratuity" numeric(10, 2),
  "oceanview_fuel" numeric(10, 2),
  "oceanview_non_comm" numeric(10, 2),
  "oceanview_price_code" varchar(50),
  "balcony_price" numeric(10, 2),
  "balcony_taxes" numeric(10, 2),
  "balcony_ncf" numeric(10, 2),
  "balcony_gratuity" numeric(10, 2),
  "balcony_fuel" numeric(10, 2),
  "balcony_non_comm" numeric(10, 2),
  "balcony_price_code" varchar(50),
  "suite_price" numeric(10, 2),
  "suite_taxes" numeric(10, 2),
  "suite_ncf" numeric(10, 2),
  "suite_gratuity" numeric(10, 2),
  "suite_fuel" numeric(10, 2),
  "suite_non_comm" numeric(10, 2),
  "suite_price_code" varchar(50),
  "currency" varchar(3) DEFAULT 'USD',
  "last_updated" timestamp DEFAULT now() NOT NULL
);

-- Create price_history table
CREATE TABLE IF NOT EXISTS "price_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cruise_id" integer NOT NULL,
  "cabin_code" varchar(10) NOT NULL,
  "rate_code" varchar(50) NOT NULL,
  "occupancy_code" varchar(10) NOT NULL,
  "price" numeric(10, 2),
  "total_price" numeric(10, 2),
  "snapshot_date" timestamp DEFAULT now() NOT NULL,
  "source" varchar(50),
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create price_trends table
CREATE TABLE IF NOT EXISTS "price_trends" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cruise_id" integer NOT NULL,
  "cabin_code" varchar(10),
  "rate_code" varchar(50),
  "period" varchar(20) NOT NULL,
  "trend_direction" varchar(20),
  "average_price" numeric(10, 2),
  "min_price" numeric(10, 2),
  "max_price" numeric(10, 2),
  "price_changes" integer DEFAULT 0,
  "volatility" numeric(5, 2),
  "last_price" numeric(10, 2),
  "last_change_date" timestamp,
  "analysis_date" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create quote_requests table
CREATE TABLE IF NOT EXISTS "quote_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255),
  "cruise_id" integer NOT NULL,
  "cabin_code" varchar(10),
  "rate_code" varchar(50),
  "occupancy" integer,
  "adults" integer,
  "children" integer,
  "infants" integer,
  "quoted_price" numeric(10, 2),
  "status" varchar(50) DEFAULT 'pending',
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create saved_searches table
CREATE TABLE IF NOT EXISTS "saved_searches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "name" varchar(255),
  "search_criteria" json NOT NULL,
  "frequency" varchar(50) DEFAULT 'daily',
  "last_notified" timestamp,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
  `;

  // Execute table creation
  const statements = createTablesSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let successCount = 0;
  let errorCount = 0;

  for (const statement of statements) {
    try {
      await client.query(statement + ';');
      successCount++;
      console.log(`✅ Statement executed successfully`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`⏭️  Skipping (already exists)`);
      } else {
        errorCount++;
        console.error(`❌ Error: ${error.message.substring(0, 100)}`);
      }
    }
  }

  console.log(`\n📊 Inline Migration Summary:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);

  await verifyTables(client);
}

async function verifyTables(client) {
  // Verify tables were created
  console.log('\n🔍 Verifying database schema...');
  console.log('─'.repeat(50));
  
  const checkTables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);

  console.log(`\n📊 Tables in database (${checkTables.rows.length} total):`);
  const importantTables = [
    'cruises', 'cruise_lines', 'ships', 'ports', 'regions',
    'pricing', 'cheapest_pricing', 'itineraries', 'cabin_categories',
    'price_history', 'price_trends', 'alternative_sailings'
  ];
  
  const existingTables = checkTables.rows.map(r => r.table_name);
  
  importantTables.forEach(table => {
    if (existingTables.includes(table)) {
      console.log(`   ✅ ${table}`);
    } else {
      console.log(`   ❌ ${table} (missing)`);
    }
  });
  
  // Count records in main tables
  console.log('\n📈 Record counts:');
  const tablesToCount = ['cruises', 'ships', 'ports', 'cruise_lines'];
  
  for (const table of tablesToCount) {
    try {
      const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`   ${table}: ${result.rows[0].count} records`);
    } catch (error) {
      console.log(`   ${table}: Unable to count (table might not exist)`);
    }
  }

  console.log('\n✨ Migration process completed!');
  console.log('\n📝 Next steps:');
  console.log('   1. Run the data sync: node scripts/sync-complete-data.js');
  console.log('   2. Or use the helper: ./scripts/run-complete-sync.sh');
}

// Run the migrations
console.log('🗄️  Complete Database Migration');
console.log('================================\n');

runAllMigrations().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});