import { db, sql } from '../src/db/connection';

async function runMigration() {
  try {
    console.log('Creating unique constraint on cruises table...');
    
    // Create the unique index
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_cruises_unique_sailing
      ON cruises (cruise_line_id, ship_id, sailing_date, COALESCE(voyage_code, ''));
    `);
    console.log('✅ Unique index created');
    
    // Create performance indexes
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_cruises_sailing_date_future
      ON cruises (sailing_date)
      WHERE sailing_date >= CURRENT_DATE;
    `);
    console.log('✅ Sailing date index created');
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_cruises_line_ship_date
      ON cruises (cruise_line_id, ship_id, sailing_date);
    `);
    console.log('✅ Line/ship/date index created');
    
    console.log('\n✅ All indexes created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
