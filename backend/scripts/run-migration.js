#!/usr/bin/env node

/**
 * Production-safe migration runner
 * Uses Node.js directly without ts-node
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

async function runMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../src/db/migrations/0001_messy_banshee.sql');
    
    console.log('📄 Reading migration file...');
    let migrationSQL;
    
    try {
      migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    } catch (error) {
      console.error('❌ Could not read migration file:', error.message);
      console.log('\n📝 Running inline migration instead...\n');
      
      // Inline migration SQL
      migrationSQL = `
-- Create price_history table
CREATE TABLE IF NOT EXISTS "price_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cruise_id" integer NOT NULL,
  "cabin_code" varchar(10) NOT NULL,
  "rate_code" varchar(50) NOT NULL,
  "occupancy_code" varchar(10) NOT NULL,
  "base_price" numeric(10, 2),
  "taxes" numeric(10, 2),
  "ncf" numeric(10, 2),
  "gratuity" numeric(10, 2),
  "fuel" numeric(10, 2),
  "total_price" numeric(10, 2),
  "currency" varchar(3) DEFAULT 'USD',
  "price_type" varchar(10) DEFAULT 'static',
  "is_available" boolean DEFAULT true,
  "change_amount" numeric(10, 2),
  "change_percentage" numeric(5, 2),
  "batch_id" varchar(50),
  "trigger_source" varchar(50),
  "snapshot_date" timestamp DEFAULT now() NOT NULL,
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

-- Create indexes for price_history
CREATE INDEX IF NOT EXISTS "idx_price_history_cruise_id" ON "price_history" ("cruise_id");
CREATE INDEX IF NOT EXISTS "idx_price_history_cruise_cabin_rate" ON "price_history" ("cruise_id", "cabin_code", "rate_code");
CREATE INDEX IF NOT EXISTS "idx_price_history_snapshot_date" ON "price_history" ("snapshot_date" DESC);
CREATE INDEX IF NOT EXISTS "idx_price_history_batch_id" ON "price_history" ("batch_id");
CREATE INDEX IF NOT EXISTS "idx_price_history_trigger_source" ON "price_history" ("trigger_source");
CREATE INDEX IF NOT EXISTS "idx_price_history_change_percentage" ON "price_history" ("change_percentage") WHERE "change_percentage" IS NOT NULL;

-- Create indexes for price_trends
CREATE INDEX IF NOT EXISTS "idx_price_trends_cruise_id" ON "price_trends" ("cruise_id");
CREATE INDEX IF NOT EXISTS "idx_price_trends_cruise_cabin_rate" ON "price_trends" ("cruise_id", "cabin_code", "rate_code");
CREATE INDEX IF NOT EXISTS "idx_price_trends_period" ON "price_trends" ("period");
CREATE INDEX IF NOT EXISTS "idx_price_trends_trend_direction" ON "price_trends" ("trend_direction");
CREATE INDEX IF NOT EXISTS "idx_price_trends_analysis_date" ON "price_trends" ("analysis_date" DESC);
CREATE INDEX IF NOT EXISTS "idx_price_trends_volatility" ON "price_trends" ("volatility" DESC) WHERE "volatility" IS NOT NULL;

-- Add foreign key constraints if cruises table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cruises') THEN
    ALTER TABLE "price_history" ADD CONSTRAINT "price_history_cruise_id_cruises_id_fk" 
      FOREIGN KEY ("cruise_id") REFERENCES "cruises"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    
    ALTER TABLE "price_trends" ADD CONSTRAINT "price_trends_cruise_id_cruises_id_fk" 
      FOREIGN KEY ("cruise_id") REFERENCES "cruises"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;
      `;
    }

    console.log('🚀 Running migration...\n');
    
    // Split by semicolon and run each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        await client.query(statement + ';');
        successCount++;
        console.log(`✅ Statement ${successCount} executed successfully`);
      } catch (error) {
        errorCount++;
        if (error.message.includes('already exists')) {
          console.log(`⏭️  Skipping (already exists): ${error.message.substring(0, 50)}...`);
        } else {
          console.error(`❌ Error executing statement: ${error.message}`);
        }
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successful statements: ${successCount}`);
    console.log(`   ⚠️  Errors/Skipped: ${errorCount}`);

    // Verify tables were created
    console.log('\n🔍 Verifying tables...');
    const checkTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('price_history', 'price_trends')
    `);

    if (checkTables.rows.length === 2) {
      console.log('✅ Both price_history and price_trends tables exist!');
    } else if (checkTables.rows.length === 1) {
      console.log(`⚠️  Only ${checkTables.rows[0].table_name} table exists`);
    } else {
      console.log('❌ Tables were not created. Check the errors above.');
    }

    console.log('\n✨ Migration process completed!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
console.log('🗄️  Price History Migration Script');
console.log('==================================\n');

runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});