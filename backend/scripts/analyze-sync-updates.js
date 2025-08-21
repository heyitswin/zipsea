#!/usr/bin/env node

/**
 * Analyze why sync keeps updating cruises that should already be up to date
 * 
 * Possible reasons:
 * 1. Data is actually changing in FTP files
 * 2. We're not checking if data changed before updating
 * 3. Timestamps or other fields are causing false positives
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Generate a hash of the cruise data to detect changes
function generateDataHash(data) {
  // Remove volatile fields that change every sync
  const stableData = {
    ...data,
    lastupdated: undefined,
    timestamp: undefined,
    _syncTime: undefined
  };
  
  return crypto
    .createHash('md5')
    .update(JSON.stringify(stableData))
    .digest('hex');
}

async function analyzeSyncBehavior() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Analyzing Sync Update Behavior\n');
    console.log('========================================\n');
    
    // 1. Check if we have data_hash column
    console.log('1. Checking for data_hash column...');
    const hashColumnExists = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cruises' 
      AND column_name = 'data_hash'
    `);
    
    if (hashColumnExists.rows.length === 0) {
      console.log('❌ No data_hash column found - this is why everything updates!');
      console.log('   Without a hash, we can\'t detect if data actually changed.\n');
      
      console.log('SOLUTION: Add data_hash column to track changes:');
      console.log('ALTER TABLE cruises ADD COLUMN IF NOT EXISTS data_hash VARCHAR(32);');
      console.log('ALTER TABLE cruises ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP;');
      console.log('');
    } else {
      console.log('✅ data_hash column exists\n');
    }
    
    // 2. Check recent updates
    console.log('2. Analyzing recent updates...');
    const recentUpdates = await client.query(`
      SELECT 
        DATE(updated_at) as update_date,
        COUNT(*) as cruises_updated,
        COUNT(DISTINCT cruise_line_id) as lines_affected,
        MIN(updated_at) as first_update,
        MAX(updated_at) as last_update
      FROM cruises
      WHERE updated_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(updated_at)
      ORDER BY update_date DESC
      LIMIT 7
    `);
    
    console.log('Recent update patterns:');
    recentUpdates.rows.forEach(row => {
      console.log(`  ${row.update_date}: ${row.cruises_updated} cruises from ${row.lines_affected} lines`);
    });
    console.log('');
    
    // 3. Check pricing updates
    console.log('3. Analyzing pricing updates...');
    const pricingUpdates = await client.query(`
      SELECT 
        c.id,
        c.name,
        COUNT(DISTINCT p.updated_at::date) as days_with_updates,
        COUNT(*) as total_price_records,
        MIN(p.updated_at) as first_price_update,
        MAX(p.updated_at) as last_price_update
      FROM cruises c
      JOIN pricing p ON c.id = p.cruise_id
      WHERE p.updated_at > NOW() - INTERVAL '3 days'
      GROUP BY c.id, c.name
      ORDER BY days_with_updates DESC
      LIMIT 10
    `);
    
    console.log('Cruises with most frequent pricing updates:');
    pricingUpdates.rows.forEach(row => {
      console.log(`  ${row.name}: ${row.days_with_updates} days, ${row.total_price_records} records`);
    });
    console.log('');
    
    // 4. Check if we're deleting and re-inserting
    console.log('4. Checking delete/re-insert pattern...');
    const pricingPattern = await client.query(`
      SELECT 
        COUNT(*) as total_pricing_records,
        COUNT(DISTINCT cruise_id) as unique_cruises,
        MIN(created_at) as oldest_record,
        MAX(created_at) as newest_record,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_lifetime_seconds
      FROM pricing
      WHERE created_at > NOW() - INTERVAL '1 day'
    `);
    
    const pattern = pricingPattern.rows[0];
    if (pattern.avg_lifetime_seconds < 60) {
      console.log('⚠️  Pricing records have very short lifetime!');
      console.log('   This suggests we\'re deleting and re-creating on every sync.');
    } else {
      console.log('✅ Pricing records seem stable');
    }
    console.log(`   Average record lifetime: ${Math.round(pattern.avg_lifetime_seconds / 60)} minutes`);
    console.log(`   Total records today: ${pattern.total_pricing_records}`);
    console.log('');
    
    // 5. Suggest optimizations
    console.log('========================================');
    console.log('OPTIMIZATION RECOMMENDATIONS:');
    console.log('========================================\n');
    
    console.log('1. Implement change detection:');
    console.log('   - Add data_hash column to cruises table');
    console.log('   - Compare hash before updating');
    console.log('   - Only update if data actually changed\n');
    
    console.log('2. Use UPSERT instead of DELETE/INSERT:');
    console.log('   - Use ON CONFLICT DO UPDATE for pricing');
    console.log('   - Only update changed fields\n');
    
    console.log('3. Add sync tracking:');
    console.log('   - Track last_sync_at timestamp');
    console.log('   - Skip files not modified since last sync');
    console.log('   - Use FTP MDTM command to check file timestamps\n');
    
    console.log('4. Batch updates more efficiently:');
    console.log('   - Use single transaction per cruise');
    console.log('   - Bulk insert pricing records');
    console.log('   - Use COPY command for large datasets\n');
    
    // Create the optimization script
    console.log('========================================');
    console.log('SQL TO ADD OPTIMIZATION COLUMNS:');
    console.log('========================================\n');
    
    console.log(`
-- Add optimization columns to cruises table
ALTER TABLE cruises 
ADD COLUMN IF NOT EXISTS data_hash VARCHAR(32),
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS sync_version INTEGER DEFAULT 0;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_cruises_data_hash ON cruises(data_hash);
CREATE INDEX IF NOT EXISTS idx_cruises_last_sync ON cruises(last_sync_at);

-- Add similar columns to pricing for change detection
ALTER TABLE pricing
ADD COLUMN IF NOT EXISTS price_hash VARCHAR(32),
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_pricing_hash ON pricing(cruise_id, rate_code, cabin_code, price_hash);
    `);
    
  } catch (error) {
    console.error('❌ Error analyzing sync behavior:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the analysis
analyzeSyncBehavior()
  .then(() => {
    console.log('\n✅ Analysis complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Analysis failed:', error);
    process.exit(1);
  });