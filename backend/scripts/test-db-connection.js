const { Pool } = require('pg');

async function testAndMigrate() {
  // Use the production database URL from environment
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION;

  if (!connectionString) {
    console.error('❌ No DATABASE_URL found in environment');
    process.exit(1);
  }

  console.log('🔧 Connecting to database...');
  const pool = new Pool({ connectionString });

  try {
    // Test connection
    const testResult = await pool.query('SELECT current_database(), current_user, version()');
    console.log('✅ Connected to database:', testResult.rows[0].current_database);
    console.log('   User:', testResult.rows[0].current_user);

    // Check if columns exist
    const checkResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'cruises'
      AND column_name IN ('needs_price_update', 'price_update_requested_at')
    `);

    console.log(
      '📋 Existing columns:',
      checkResult.rows.map(r => r.column_name)
    );

    if (checkResult.rows.length < 2) {
      console.log('🔧 Adding missing columns...');

      // Add columns
      await pool.query(`
        ALTER TABLE cruises
        ADD COLUMN IF NOT EXISTS needs_price_update BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS price_update_requested_at TIMESTAMP
      `);
      console.log('✅ Columns added');

      // Create index
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_cruises_needs_price_update
        ON cruises(needs_price_update)
        WHERE needs_price_update = true
      `);
      console.log('✅ Index created');

      // Verify
      const verifyResult = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'cruises'
        AND column_name IN ('needs_price_update', 'price_update_requested_at')
        ORDER BY column_name
      `);

      console.log('✅ Migration complete! Columns now present:');
      verifyResult.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.log('✅ All required columns already exist');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testAndMigrate();
