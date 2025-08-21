#!/usr/bin/env node

/**
 * Fix the staging database ports table to match production schema
 * Adds missing country_code column
 */

const { Pool } = require('pg');
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

async function fixPortsSchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing Ports Table Schema\n');
    console.log('========================================\n');
    
    // Check if country_code column exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ports' 
        AND column_name = 'country_code'
    `);
    
    if (checkColumn.rows.length === 0) {
      console.log('❌ Missing country_code column - adding it now...');
      
      // Add the missing column
      await client.query(`
        ALTER TABLE ports 
        ADD COLUMN IF NOT EXISTS country_code VARCHAR(2)
      `);
      
      console.log('✅ Added country_code column to ports table');
      
      // Set default values for existing rows
      await client.query(`
        UPDATE ports 
        SET country_code = 
          CASE 
            WHEN country ILIKE '%united states%' OR country ILIKE '%usa%' THEN 'US'
            WHEN country ILIKE '%canada%' THEN 'CA'
            WHEN country ILIKE '%mexico%' THEN 'MX'
            WHEN country ILIKE '%bahamas%' THEN 'BS'
            WHEN country ILIKE '%jamaica%' THEN 'JM'
            WHEN country ILIKE '%cayman%' THEN 'KY'
            WHEN country ILIKE '%belize%' THEN 'BZ'
            WHEN country ILIKE '%costa rica%' THEN 'CR'
            WHEN country ILIKE '%panama%' THEN 'PA'
            WHEN country ILIKE '%colombia%' THEN 'CO'
            WHEN country ILIKE '%aruba%' THEN 'AW'
            WHEN country ILIKE '%curacao%' THEN 'CW'
            WHEN country ILIKE '%barbados%' THEN 'BB'
            WHEN country ILIKE '%antigua%' THEN 'AG'
            WHEN country ILIKE '%dominican%' THEN 'DO'
            WHEN country ILIKE '%puerto rico%' THEN 'PR'
            WHEN country ILIKE '%virgin islands%' THEN 'VI'
            WHEN country ILIKE '%grenada%' THEN 'GD'
            WHEN country ILIKE '%trinidad%' THEN 'TT'
            WHEN country ILIKE '%st%lucia%' THEN 'LC'
            WHEN country ILIKE '%st%kitts%' THEN 'KN'
            WHEN country ILIKE '%martinique%' THEN 'MQ'
            WHEN country ILIKE '%guadeloupe%' THEN 'GP'
            WHEN country ILIKE '%honduras%' THEN 'HN'
            WHEN country ILIKE '%guatemala%' THEN 'GT'
            WHEN country ILIKE '%nicaragua%' THEN 'NI'
            WHEN country ILIKE '%bermuda%' THEN 'BM'
            WHEN country ILIKE '%turks%' THEN 'TC'
            WHEN country ILIKE '%haiti%' THEN 'HT'
            ELSE NULL
          END
        WHERE country_code IS NULL AND country IS NOT NULL
      `);
      
      console.log('✅ Updated country codes for existing ports');
      
    } else {
      console.log('✅ country_code column already exists');
    }
    
    // Check for other potentially missing columns
    const columns = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'ports'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 Current ports table structure:');
    columns.rows.forEach(col => {
      const type = col.character_maximum_length 
        ? `${col.data_type}(${col.character_maximum_length})`
        : col.data_type;
      console.log(`   - ${col.column_name}: ${type}`);
    });
    
    // Verify the schema matches what the sync script expects
    const requiredColumns = [
      'id', 'name', 'code', 'country', 'country_code', 
      'latitude', 'longitude', 'timezone', 'description', 
      'images', 'created_at', 'updated_at'
    ];
    
    const existingColumns = columns.rows.map(r => r.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.log('\n⚠️  Missing columns:', missingColumns.join(', '));
    } else {
      console.log('\n✅ All required columns are present');
    }
    
    // Get sample data
    const samplePorts = await client.query(`
      SELECT id, name, code, country, country_code
      FROM ports
      LIMIT 5
    `);
    
    if (samplePorts.rows.length > 0) {
      console.log('\n📍 Sample ports:');
      samplePorts.rows.forEach(port => {
        console.log(`   ${port.id}: ${port.name} (${port.code || 'no code'}) - ${port.country} [${port.country_code || 'no code'}]`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixPortsSchema()
  .then(() => {
    console.log('\n✅ Schema fix complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });