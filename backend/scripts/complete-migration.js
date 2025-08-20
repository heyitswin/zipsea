#!/usr/bin/env node

/**
 * Complete the price history migration
 * Creates missing price_trends table and indexes
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function completeMigration() {
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

    // Check what already exists
    console.log('\n🔍 Checking existing tables...');
    const checkTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('price_history', 'price_trends')
    `);
    
    const existingTables = checkTables.rows.map(r => r.table_name);
    console.log('Existing tables:', existingTables);

    // Create price_trends table if it doesn't exist
    if (!existingTables.includes('price_trends')) {
      console.log('\n📝 Creating price_trends table...');
      await client.query(`
        CREATE TABLE "price_trends" (
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
        )
      `);
      console.log('✅ price_trends table created');
    } else {
      console.log('⏭️  price_trends table already exists');
    }

    // Create indexes for price_history
    console.log('\n📝 Creating indexes for price_history...');
    const priceHistoryIndexes = [
      'CREATE INDEX IF NOT EXISTS "idx_price_history_cruise_id" ON "price_history" ("cruise_id")',
      'CREATE INDEX IF NOT EXISTS "idx_price_history_cruise_cabin_rate" ON "price_history" ("cruise_id", "cabin_code", "rate_code")',
      'CREATE INDEX IF NOT EXISTS "idx_price_history_snapshot_date" ON "price_history" ("snapshot_date" DESC)',
      'CREATE INDEX IF NOT EXISTS "idx_price_history_batch_id" ON "price_history" ("batch_id")',
      'CREATE INDEX IF NOT EXISTS "idx_price_history_trigger_source" ON "price_history" ("trigger_source")',
      'CREATE INDEX IF NOT EXISTS "idx_price_history_change_percentage" ON "price_history" ("change_percentage") WHERE "change_percentage" IS NOT NULL'
    ];

    for (const index of priceHistoryIndexes) {
      try {
        await client.query(index);
        console.log('✅ Index created/verified');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('⏭️  Index already exists');
        } else {
          console.error('❌ Error:', error.message);
        }
      }
    }

    // Create indexes for price_trends
    console.log('\n📝 Creating indexes for price_trends...');
    const priceTrendsIndexes = [
      'CREATE INDEX IF NOT EXISTS "idx_price_trends_cruise_id" ON "price_trends" ("cruise_id")',
      'CREATE INDEX IF NOT EXISTS "idx_price_trends_cruise_cabin_rate" ON "price_trends" ("cruise_id", "cabin_code", "rate_code")',
      'CREATE INDEX IF NOT EXISTS "idx_price_trends_period" ON "price_trends" ("period")',
      'CREATE INDEX IF NOT EXISTS "idx_price_trends_trend_direction" ON "price_trends" ("trend_direction")',
      'CREATE INDEX IF NOT EXISTS "idx_price_trends_analysis_date" ON "price_trends" ("analysis_date" DESC)',
      'CREATE INDEX IF NOT EXISTS "idx_price_trends_volatility" ON "price_trends" ("volatility" DESC) WHERE "volatility" IS NOT NULL'
    ];

    for (const index of priceTrendsIndexes) {
      try {
        await client.query(index);
        console.log('✅ Index created/verified');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('⏭️  Index already exists');
        } else {
          console.error('❌ Error:', error.message);
        }
      }
    }

    // Try to add foreign key constraints
    console.log('\n📝 Adding foreign key constraints...');
    
    // Check if cruises table exists
    const cruisesExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'cruises'
      )
    `);

    if (cruisesExists.rows[0].exists) {
      console.log('Found cruises table, adding foreign keys...');
      
      try {
        await client.query(`
          ALTER TABLE "price_history" 
          ADD CONSTRAINT "price_history_cruise_id_cruises_id_fk" 
          FOREIGN KEY ("cruise_id") REFERENCES "cruises"("id") 
          ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        console.log('✅ Added foreign key for price_history');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('⏭️  Foreign key already exists for price_history');
        } else {
          console.log('⚠️  Could not add foreign key for price_history:', error.message);
        }
      }

      try {
        await client.query(`
          ALTER TABLE "price_trends" 
          ADD CONSTRAINT "price_trends_cruise_id_cruises_id_fk" 
          FOREIGN KEY ("cruise_id") REFERENCES "cruises"("id") 
          ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        console.log('✅ Added foreign key for price_trends');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('⏭️  Foreign key already exists for price_trends');
        } else {
          console.log('⚠️  Could not add foreign key for price_trends:', error.message);
        }
      }
    } else {
      console.log('⚠️  No cruises table found, skipping foreign keys');
    }

    // Final verification
    console.log('\n🔍 Final verification...');
    const finalCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('price_history', 'price_trends')
      ORDER BY table_name
    `);

    console.log('\n✅ Tables created:');
    finalCheck.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // Count indexes
    const indexCount = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE tablename IN ('price_history', 'price_trends')
      AND schemaname = 'public'
    `);
    console.log(`\n✅ Total indexes: ${indexCount.rows[0].count}`);

    console.log('\n✨ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
console.log('🗄️  Complete Price History Migration');
console.log('=====================================\n');

completeMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});