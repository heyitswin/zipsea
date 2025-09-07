#!/usr/bin/env node
const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');
const logger = require('../dist/config/logger').default;

async function applyMigration() {
  try {
    logger.info('🔧 Applying price_update_requested_at migration...');

    // Add the columns if they don't exist
    await db.execute(sql`
      ALTER TABLE cruises
      ADD COLUMN IF NOT EXISTS needs_price_update BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS price_update_requested_at TIMESTAMP
    `);

    logger.info('✅ Added columns to cruises table');

    // Create index for efficient queries
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_cruises_needs_price_update
      ON cruises(needs_price_update)
      WHERE needs_price_update = true
    `);

    logger.info('✅ Created index for needs_price_update');

    // Add comments to explain usage
    await db.execute(sql`
      COMMENT ON COLUMN cruises.needs_price_update IS 'Flag indicating this cruise needs pricing data updated from FTP'
    `);

    await db.execute(sql`
      COMMENT ON COLUMN cruises.price_update_requested_at IS 'Timestamp when price update was requested via webhook'
    `);

    logger.info('✅ Added column comments');

    // Verify the columns exist
    const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'cruises'
      AND column_name IN ('needs_price_update', 'price_update_requested_at')
      ORDER BY column_name
    `);

    logger.info('📋 Column verification:', result);

    logger.info('✅ Migration applied successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();
