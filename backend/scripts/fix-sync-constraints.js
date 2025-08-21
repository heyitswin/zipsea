#!/usr/bin/env node

/**
 * Fix database constraints for Traveltek sync
 * Makes foreign keys more flexible to handle missing referenced data
 */

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixConstraints() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing Database Constraints for Sync');
    console.log('========================================\n');
    
    // Fix itineraries port constraint
    console.log('Fixing itineraries port constraint...');
    await client.query(`
      ALTER TABLE itineraries 
      DROP CONSTRAINT IF EXISTS itineraries_port_id_fkey
    `);
    
    // Make port_id nullable
    await client.query(`
      ALTER TABLE itineraries 
      ALTER COLUMN port_id DROP NOT NULL
    `);
    
    // Add back with SET NULL on delete
    await client.query(`
      ALTER TABLE itineraries 
      ADD CONSTRAINT itineraries_port_id_fkey 
      FOREIGN KEY (port_id) 
      REFERENCES ports(id) 
      ON DELETE SET NULL
    `);
    console.log('  ✓ Fixed itineraries port constraint\n');
    
    // Fix cruises port constraints
    console.log('Fixing cruises port constraints...');
    await client.query(`
      ALTER TABLE cruises 
      DROP CONSTRAINT IF EXISTS cruises_embark_port_id_fkey,
      DROP CONSTRAINT IF EXISTS cruises_disembark_port_id_fkey
    `);
    
    // Make port IDs nullable
    await client.query(`
      ALTER TABLE cruises 
      ALTER COLUMN embark_port_id DROP NOT NULL,
      ALTER COLUMN disembark_port_id DROP NOT NULL
    `);
    
    // Add back with SET NULL on delete
    await client.query(`
      ALTER TABLE cruises 
      ADD CONSTRAINT cruises_embark_port_id_fkey 
      FOREIGN KEY (embark_port_id) 
      REFERENCES ports(id) 
      ON DELETE SET NULL,
      ADD CONSTRAINT cruises_disembark_port_id_fkey 
      FOREIGN KEY (disembark_port_id) 
      REFERENCES ports(id) 
      ON DELETE SET NULL
    `);
    console.log('  ✓ Fixed cruises port constraints\n');
    
    // Show current constraints
    const constraints = await client.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_name IN ('itineraries', 'cruises')
        AND tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name, tc.constraint_name
    `);
    
    console.log('📊 Current foreign key constraints:');
    for (const row of constraints.rows) {
      console.log(`  ${row.table_name}.${row.column_name} → ${row.constraint_name}`);
    }
    
    console.log('\n✅ Constraints fixed successfully!');
    console.log('\nYou can now run the sync script without foreign key errors.');
    
  } catch (error) {
    console.error('❌ Error fixing constraints:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixConstraints()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed to fix constraints:', error);
    process.exit(1);
  });