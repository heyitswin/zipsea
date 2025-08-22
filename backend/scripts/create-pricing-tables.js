#!/usr/bin/env node

/**
 * Create the missing pricing tables directly
 * This bypasses the complex migration files and just creates what we need
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function createPricingTables() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🚀 CREATING PRICING TABLES');
    console.log('===========================\n');
    
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database\n');

    // Create pricing table
    console.log('📝 Creating pricing table...');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "pricing" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "cruise_id" varchar NOT NULL,  -- Using varchar to match your id field
          "cruise_sailing_id" uuid,
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
          "currency" varchar(3) DEFAULT 'USD',
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log('✅ pricing table created successfully');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⏭️  pricing table already exists');
      } else {
        throw error;
      }
    }

    // Create indexes for pricing table
    console.log('\n📝 Creating pricing indexes...');
    const pricingIndexes = [
      'CREATE INDEX IF NOT EXISTS "idx_pricing_cruise_id" ON "pricing" ("cruise_id")',
      'CREATE INDEX IF NOT EXISTS "idx_pricing_rate_cabin_occupancy" ON "pricing" ("rate_code", "cabin_code", "occupancy_code")',
      'CREATE INDEX IF NOT EXISTS "idx_pricing_total_price" ON "pricing" ("total_price")',
      'CREATE UNIQUE INDEX IF NOT EXISTS "idx_pricing_unique" ON "pricing" ("cruise_id", "rate_code", "cabin_code", "occupancy_code")'
    ];

    for (const indexQuery of pricingIndexes) {
      try {
        await client.query(indexQuery);
        console.log('✅ Index created');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('⏭️  Index already exists');
        } else {
          console.log(`⚠️  Index error: ${error.message}`);
        }
      }
    }

    // Create cheapest_pricing table
    console.log('\n📝 Creating cheapest_pricing table...');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "cheapest_pricing" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "cruise_id" varchar UNIQUE NOT NULL,
          "cruise_sailing_id" uuid,
          
          -- Overall cheapest pricing
          "cheapest_price" numeric(10, 2),
          "cheapest_cabin_type" varchar(50),
          "cheapest_taxes" numeric(10, 2),
          "cheapest_ncf" numeric(10, 2),
          "cheapest_gratuity" numeric(10, 2),
          "cheapest_fuel" numeric(10, 2),
          "cheapest_non_comm" numeric(10, 2),
          
          -- Interior pricing
          "interior_price" numeric(10, 2),
          "interior_taxes" numeric(10, 2),
          "interior_ncf" numeric(10, 2),
          "interior_gratuity" numeric(10, 2),
          "interior_fuel" numeric(10, 2),
          "interior_non_comm" numeric(10, 2),
          "interior_price_code" varchar(50),
          
          -- Oceanview pricing
          "oceanview_price" numeric(10, 2),
          "oceanview_taxes" numeric(10, 2),
          "oceanview_ncf" numeric(10, 2),
          "oceanview_gratuity" numeric(10, 2),
          "oceanview_fuel" numeric(10, 2),
          "oceanview_non_comm" numeric(10, 2),
          "oceanview_price_code" varchar(50),
          
          -- Balcony pricing
          "balcony_price" numeric(10, 2),
          "balcony_taxes" numeric(10, 2),
          "balcony_ncf" numeric(10, 2),
          "balcony_gratuity" numeric(10, 2),
          "balcony_fuel" numeric(10, 2),
          "balcony_non_comm" numeric(10, 2),
          "balcony_price_code" varchar(50),
          
          -- Suite pricing
          "suite_price" numeric(10, 2),
          "suite_taxes" numeric(10, 2),
          "suite_ncf" numeric(10, 2),
          "suite_gratuity" numeric(10, 2),
          "suite_fuel" numeric(10, 2),
          "suite_non_comm" numeric(10, 2),
          "suite_price_code" varchar(50),
          
          "currency" varchar(3) DEFAULT 'USD',
          "last_updated" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log('✅ cheapest_pricing table created successfully');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⏭️  cheapest_pricing table already exists');
      } else {
        throw error;
      }
    }

    // Create indexes for cheapest_pricing table
    console.log('\n📝 Creating cheapest_pricing indexes...');
    const cheapestIndexes = [
      'CREATE INDEX IF NOT EXISTS "idx_cheapest_pricing_cruise_id" ON "cheapest_pricing" ("cruise_id")',
      'CREATE INDEX IF NOT EXISTS "idx_cheapest_pricing_prices" ON "cheapest_pricing" ("cheapest_price", "interior_price", "oceanview_price", "balcony_price", "suite_price")'
    ];

    for (const indexQuery of cheapestIndexes) {
      try {
        await client.query(indexQuery);
        console.log('✅ Index created');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('⏭️  Index already exists');
        } else {
          console.log(`⚠️  Index error: ${error.message}`);
        }
      }
    }

    // Verify tables were created
    console.log('\n🔍 Verifying tables...');
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('pricing', 'cheapest_pricing')
    `);

    const existingTables = tableCheck.rows.map(r => r.table_name);
    
    console.log('\n📊 Final Status:');
    if (existingTables.includes('pricing')) {
      console.log('   ✅ pricing table exists');
    } else {
      console.log('   ❌ pricing table NOT created');
    }
    
    if (existingTables.includes('cheapest_pricing')) {
      console.log('   ✅ cheapest_pricing table exists');
    } else {
      console.log('   ❌ cheapest_pricing table NOT created');
    }

    // Count columns in pricing table
    if (existingTables.includes('pricing')) {
      const columnCount = await client.query(`
        SELECT COUNT(*) as count
        FROM information_schema.columns 
        WHERE table_name = 'pricing' 
        AND table_schema = 'public'
      `);
      console.log(`   📝 pricing table has ${columnCount.rows[0].count} columns`);
    }

    console.log('\n✨ Pricing tables creation completed!');

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the script
createPricingTables()
  .then(() => {
    console.log('\n✅ Success! You can now run the sync script.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  });