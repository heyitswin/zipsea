#!/usr/bin/env node

/**
 * Initialize database with all required tables
 * Simple, direct SQL execution without complex DO blocks
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function initDatabase() {
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

    // Create tables one by one
    const tables = [
      {
        name: 'users',
        sql: `CREATE TABLE IF NOT EXISTS "users" (
          "id" varchar(255) PRIMARY KEY NOT NULL,
          "email" varchar(255) NOT NULL,
          "first_name" varchar(100),
          "last_name" varchar(100),
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )`
      },
      {
        name: 'cruise_lines',
        sql: `CREATE TABLE IF NOT EXISTS "cruise_lines" (
          "id" integer PRIMARY KEY NOT NULL,
          "name" varchar(255) NOT NULL,
          "code" varchar(50),
          "description" text,
          "is_active" boolean DEFAULT true,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )`
      },
      {
        name: 'ships',
        sql: `CREATE TABLE IF NOT EXISTS "ships" (
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
        )`
      },
      {
        name: 'ports',
        sql: `CREATE TABLE IF NOT EXISTS "ports" (
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
        )`
      },
      {
        name: 'regions',
        sql: `CREATE TABLE IF NOT EXISTS "regions" (
          "id" integer PRIMARY KEY NOT NULL,
          "name" varchar(255) NOT NULL,
          "code" varchar(50),
          "description" text,
          "is_active" boolean DEFAULT true,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )`
      },
      {
        name: 'cruises',
        sql: `CREATE TABLE IF NOT EXISTS "cruises" (
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
        )`
      },
      {
        name: 'alternative_sailings',
        sql: `CREATE TABLE IF NOT EXISTS "alternative_sailings" (
          "id" serial PRIMARY KEY NOT NULL,
          "base_cruise_id" integer NOT NULL,
          "alternative_cruise_id" integer NOT NULL,
          "sailing_date" date,
          "price" numeric(10, 2),
          "created_at" timestamp DEFAULT now() NOT NULL
        )`
      },
      {
        name: 'itineraries',
        sql: `CREATE TABLE IF NOT EXISTS "itineraries" (
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
        )`
      },
      {
        name: 'cabin_categories',
        sql: `CREATE TABLE IF NOT EXISTS "cabin_categories" (
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
          "updated_at" timestamp DEFAULT now() NOT NULL,
          UNIQUE("ship_id", "cabin_code")
        )`
      },
      {
        name: 'pricing',
        sql: `CREATE TABLE IF NOT EXISTS "pricing" (
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
        )`
      },
      {
        name: 'cheapest_pricing',
        sql: `CREATE TABLE IF NOT EXISTS "cheapest_pricing" (
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
        )`
      },
      {
        name: 'price_history',
        sql: `CREATE TABLE IF NOT EXISTS "price_history" (
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
        )`
      },
      {
        name: 'price_trends',
        sql: `CREATE TABLE IF NOT EXISTS "price_trends" (
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
        )`
      },
      {
        name: 'quote_requests',
        sql: `CREATE TABLE IF NOT EXISTS "quote_requests" (
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
        )`
      },
      {
        name: 'saved_searches',
        sql: `CREATE TABLE IF NOT EXISTS "saved_searches" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "user_id" varchar(255) NOT NULL,
          "name" varchar(255),
          "search_criteria" json NOT NULL,
          "frequency" varchar(50) DEFAULT 'daily',
          "last_notified" timestamp,
          "is_active" boolean DEFAULT true,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )`
      }
    ];

    // Create each table
    console.log('📝 Creating tables...\n');
    
    for (const table of tables) {
      try {
        await client.query(table.sql);
        console.log(`✅ ${table.name}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⏭️  ${table.name} (already exists)`);
        } else {
          console.error(`❌ ${table.name}: ${error.message.substring(0, 50)}`);
        }
      }
    }

    // Create indexes
    console.log('\n📝 Creating indexes...\n');
    
    const indexes = [
      // Cruise indexes
      'CREATE INDEX IF NOT EXISTS "idx_cruises_cruise_line_id" ON "cruises" ("cruise_line_id")',
      'CREATE INDEX IF NOT EXISTS "idx_cruises_ship_id" ON "cruises" ("ship_id")',
      'CREATE INDEX IF NOT EXISTS "idx_cruises_sailing_date" ON "cruises" ("sailing_date")',
      
      // Pricing indexes
      'CREATE INDEX IF NOT EXISTS "idx_pricing_cruise_id" ON "pricing" ("cruise_id")',
      'CREATE INDEX IF NOT EXISTS "idx_cheapest_pricing_cruise_id" ON "cheapest_pricing" ("cruise_id")',
      
      // Itinerary indexes
      'CREATE INDEX IF NOT EXISTS "idx_itineraries_cruise_id" ON "itineraries" ("cruise_id")',
      
      // Price history indexes
      'CREATE INDEX IF NOT EXISTS "idx_price_history_cruise_id" ON "price_history" ("cruise_id")',
      'CREATE INDEX IF NOT EXISTS "idx_price_history_snapshot_date" ON "price_history" ("snapshot_date" DESC)',
      
      // Alternative sailings indexes
      'CREATE INDEX IF NOT EXISTS "idx_alt_sailings_base_cruise_id" ON "alternative_sailings" ("base_cruise_id")',
      'CREATE INDEX IF NOT EXISTS "idx_alt_sailings_alternative_cruise_id" ON "alternative_sailings" ("alternative_cruise_id")'
    ];

    for (const index of indexes) {
      try {
        await client.query(index);
        console.log('✅ Index created');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('⏭️  Index already exists');
        } else {
          console.error(`❌ Index: ${error.message.substring(0, 50)}`);
        }
      }
    }

    // Add foreign key constraints
    console.log('\n📝 Adding foreign key constraints...\n');
    
    const constraints = [
      {
        name: 'ships -> cruise_lines',
        sql: 'ALTER TABLE "ships" ADD CONSTRAINT "ships_cruise_line_id_fk" FOREIGN KEY ("cruise_line_id") REFERENCES "cruise_lines"("id") ON DELETE CASCADE'
      },
      {
        name: 'cruises -> cruise_lines',
        sql: 'ALTER TABLE "cruises" ADD CONSTRAINT "cruises_cruise_line_id_fk" FOREIGN KEY ("cruise_line_id") REFERENCES "cruise_lines"("id") ON DELETE CASCADE'
      },
      {
        name: 'cruises -> ships',
        sql: 'ALTER TABLE "cruises" ADD CONSTRAINT "cruises_ship_id_fk" FOREIGN KEY ("ship_id") REFERENCES "ships"("id") ON DELETE CASCADE'
      },
      {
        name: 'itineraries -> cruises',
        sql: 'ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_cruise_id_fk" FOREIGN KEY ("cruise_id") REFERENCES "cruises"("id") ON DELETE CASCADE'
      },
      {
        name: 'pricing -> cruises',
        sql: 'ALTER TABLE "pricing" ADD CONSTRAINT "pricing_cruise_id_fk" FOREIGN KEY ("cruise_id") REFERENCES "cruises"("id") ON DELETE CASCADE'
      },
      {
        name: 'cheapest_pricing -> cruises',
        sql: 'ALTER TABLE "cheapest_pricing" ADD CONSTRAINT "cheapest_pricing_cruise_id_fk" FOREIGN KEY ("cruise_id") REFERENCES "cruises"("id") ON DELETE CASCADE'
      },
      {
        name: 'alternative_sailings -> cruises (base)',
        sql: 'ALTER TABLE "alternative_sailings" ADD CONSTRAINT "alt_sailings_base_cruise_id_fk" FOREIGN KEY ("base_cruise_id") REFERENCES "cruises"("id") ON DELETE CASCADE'
      },
      {
        name: 'alternative_sailings -> cruises (alt)',
        sql: 'ALTER TABLE "alternative_sailings" ADD CONSTRAINT "alt_sailings_alt_cruise_id_fk" FOREIGN KEY ("alternative_cruise_id") REFERENCES "cruises"("id") ON DELETE CASCADE'
      },
      {
        name: 'price_history -> cruises',
        sql: 'ALTER TABLE "price_history" ADD CONSTRAINT "price_history_cruise_id_fk" FOREIGN KEY ("cruise_id") REFERENCES "cruises"("id") ON DELETE CASCADE'
      },
      {
        name: 'cabin_categories -> ships',
        sql: 'ALTER TABLE "cabin_categories" ADD CONSTRAINT "cabin_categories_ship_id_fk" FOREIGN KEY ("ship_id") REFERENCES "ships"("id") ON DELETE CASCADE'
      }
    ];

    for (const constraint of constraints) {
      try {
        await client.query(constraint.sql);
        console.log(`✅ ${constraint.name}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⏭️  ${constraint.name} (already exists)`);
        } else if (error.message.includes('does not exist')) {
          console.log(`⚠️  ${constraint.name} (table missing, skipped)`);
        } else {
          console.error(`❌ ${constraint.name}: ${error.message.substring(0, 50)}`);
        }
      }
    }

    // Verify tables
    console.log('\n🔍 Verifying database schema...\n');
    
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    const existingTables = result.rows.map(r => r.table_name);
    const requiredTables = tables.map(t => t.name);
    
    console.log('📊 Required tables:');
    requiredTables.forEach(table => {
      if (existingTables.includes(table)) {
        console.log(`   ✅ ${table}`);
      } else {
        console.log(`   ❌ ${table} (missing)`);
      }
    });

    // Count records
    console.log('\n📈 Record counts:');
    for (const table of ['cruises', 'ships', 'ports', 'cruise_lines', 'regions']) {
      if (existingTables.includes(table)) {
        try {
          const count = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
          console.log(`   ${table}: ${count.rows[0].count} records`);
        } catch (e) {
          console.log(`   ${table}: Error counting`);
        }
      }
    }

    console.log('\n✨ Database initialization complete!');
    console.log('\n📝 Next steps:');
    console.log('   Run: ./scripts/run-complete-sync.sh');
    console.log('   Or:  FORCE_UPDATE=true SYNC_YEARS=2025 node scripts/sync-complete-data.js');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run initialization
console.log('🗄️  Database Initialization');
console.log('============================\n');

initDatabase().catch(error => {
  console.error('Fatal:', error);
  process.exit(1);
});