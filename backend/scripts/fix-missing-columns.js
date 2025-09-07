const { Pool } = require('pg');

async function fixMissingColumns() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔧 Applying missing columns migration...');

    // Add the columns if they don't exist
    await pool.query(`
      ALTER TABLE cruises
      ADD COLUMN IF NOT EXISTS needs_price_update BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS price_update_requested_at TIMESTAMP
    `);
    console.log('✅ Added columns to cruises table');

    // Create index for efficient queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cruises_needs_price_update
      ON cruises(needs_price_update)
      WHERE needs_price_update = true
    `);
    console.log('✅ Created index for needs_price_update');

    // Verify the columns exist
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'cruises'
      AND column_name IN ('needs_price_update', 'price_update_requested_at')
      ORDER BY column_name
    `);

    console.log('📋 Column verification:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default || 'none'})`);
    });

    if (result.rows.length === 2) {
      console.log('✅ Migration completed successfully!');
    } else {
      console.log('⚠️ Migration may be incomplete, only found', result.rows.length, 'columns');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixMissingColumns().catch(console.error);
