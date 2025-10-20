/**
 * Migration script to add itemkey column to booking_sessions table
 * Run this on production to fix the 500 error
 */

const { Pool } = require('pg');

async function addItemkeyColumn() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔍 Checking if itemkey column already exists...');

    // Check if column exists
    const checkResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'booking_sessions'
      AND column_name = 'itemkey'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ Column "itemkey" already exists in booking_sessions table');
      await pool.end();
      return;
    }

    console.log('📝 Adding itemkey column to booking_sessions table...');

    // Add the column
    await pool.query(`
      ALTER TABLE "booking_sessions"
      ADD COLUMN "itemkey" varchar(255)
    `);

    console.log('✅ Successfully added itemkey column!');

    // Verify the column was added
    const verifyResult = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'booking_sessions'
      AND column_name = 'itemkey'
    `);

    console.log('✅ Verification:', verifyResult.rows[0]);

  } catch (error) {
    console.error('❌ Error adding itemkey column:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addItemkeyColumn()
  .then(() => {
    console.log('🎉 Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
