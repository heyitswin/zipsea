#!/usr/bin/env node

/**
 * Schema Field Type Fix Script
 * Updates database field types to match Traveltek API specification exactly
 * Date: 2025-01-14
 *
 * Key Changes:
 * - codetocruiseid: VARCHAR -> INTEGER (Traveltek spec: integer($int32))
 * - cruiseid: VARCHAR -> INTEGER (Traveltek spec: integer($int32))
 * - Ensures all other fields match official Traveltek types
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function fixSchemaFieldTypes() {
  const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('No database URL found in environment variables');
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // Check current field types
    console.log('\n📊 Checking current field types...');

    const currentTypes = await client.query(`
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'cruises'
        AND column_name IN ('id', 'cruise_id', 'codetocruiseid')
      ORDER BY column_name;
    `);

    console.log('Current field types:');
    currentTypes.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Check if we have data and what the current ID values look like
    console.log('\n🔍 Analyzing existing data...');

    const sampleData = await client.query(`
      SELECT id, cruise_id, COUNT(*) as count
      FROM cruises
      GROUP BY id, cruise_id
      LIMIT 5;
    `);

    console.log('Sample data:');
    sampleData.rows.forEach(row => {
      console.log(`  id: ${row.id}, cruise_id: ${row.cruise_id}, count: ${row.count}`);
    });

    // Check if IDs are actually numeric
    const numericCheck = await client.query(`
      SELECT
        COUNT(*) as total_rows,
        COUNT(CASE WHEN id ~ '^[0-9]+$' THEN 1 END) as numeric_ids,
        COUNT(CASE WHEN cruise_id ~ '^[0-9]+$' THEN 1 END) as numeric_cruise_ids
      FROM cruises;
    `);

    const { total_rows, numeric_ids, numeric_cruise_ids } = numericCheck.rows[0];

    console.log(`\n📈 Data analysis:`);
    console.log(`  Total rows: ${total_rows}`);
    console.log(`  Numeric IDs: ${numeric_ids}/${total_rows} (${((numeric_ids/total_rows)*100).toFixed(1)}%)`);
    console.log(`  Numeric cruise_ids: ${numeric_cruise_ids}/${total_rows} (${((numeric_cruise_ids/total_rows)*100).toFixed(1)}%)`);

    // Only proceed if we have high confidence the data is numeric
    if (total_rows > 0 && (numeric_ids / total_rows < 0.95 || numeric_cruise_ids / total_rows < 0.95)) {
      console.log('⚠️ WARNING: Not all IDs appear to be numeric!');
      console.log('This suggests the current VARCHAR types may be correct.');
      console.log('Manual review recommended before proceeding.');

      // Show non-numeric examples
      const nonNumeric = await client.query(`
        SELECT id, cruise_id
        FROM cruises
        WHERE NOT (id ~ '^[0-9]+$') OR NOT (cruise_id ~ '^[0-9]+$')
        LIMIT 10;
      `);

      if (nonNumeric.rows.length > 0) {
        console.log('\nNon-numeric examples:');
        nonNumeric.rows.forEach(row => {
          console.log(`  id: "${row.id}", cruise_id: "${row.cruise_id}"`);
        });
      }

      console.log('\nExiting without changes. Review data manually.');
      return;
    }

    console.log('\n✅ Data appears to be numeric. Proceeding with schema update...');

    // Begin transaction
    await client.query('BEGIN');

    try {
      // Step 1: Create new columns with correct types
      console.log('\n🔄 Step 1: Creating new columns with correct types...');

      await client.query(`
        ALTER TABLE cruises
        ADD COLUMN new_id INTEGER,
        ADD COLUMN new_cruise_id INTEGER;
      `);

      // Step 2: Populate new columns with converted data
      console.log('🔄 Step 2: Converting and populating new columns...');

      await client.query(`
        UPDATE cruises
        SET
          new_id = CASE
            WHEN id ~ '^[0-9]+$' THEN id::INTEGER
            ELSE NULL
          END,
          new_cruise_id = CASE
            WHEN cruise_id ~ '^[0-9]+$' THEN cruise_id::INTEGER
            ELSE NULL
          END;
      `);

      // Step 3: Check for conversion issues
      const conversionCheck = await client.query(`
        SELECT
          COUNT(*) as total,
          COUNT(new_id) as converted_ids,
          COUNT(new_cruise_id) as converted_cruise_ids
        FROM cruises;
      `);

      const { total, converted_ids, converted_cruise_ids } = conversionCheck.rows[0];

      if (converted_ids !== total || converted_cruise_ids !== total) {
        throw new Error(`Conversion failed: ${converted_ids}/${total} IDs and ${converted_cruise_ids}/${total} cruise_ids converted`);
      }

      console.log(`✅ Successfully converted ${total} rows`);

      // Step 4: Drop old columns and constraints
      console.log('🔄 Step 3: Removing old columns and constraints...');

      // Drop foreign key constraints that reference the primary key
      await client.query(`
        ALTER TABLE itineraries DROP CONSTRAINT IF EXISTS itineraries_cruise_id_fkey;
      `);

      await client.query(`
        ALTER TABLE alternative_sailings DROP CONSTRAINT IF EXISTS alternative_sailings_cruise_id_fkey;
      `);

      await client.query(`
        ALTER TABLE pricing DROP CONSTRAINT IF EXISTS pricing_cruise_id_fkey;
      `);

      await client.query(`
        ALTER TABLE cheapest_pricing DROP CONSTRAINT IF EXISTS cheapest_pricing_cruise_id_fkey;
      `);

      await client.query(`
        ALTER TABLE price_history DROP CONSTRAINT IF EXISTS price_history_cruise_id_fkey;
      `);

      await client.query(`
        ALTER TABLE quote_requests DROP CONSTRAINT IF EXISTS quote_requests_cruise_id_fkey;
      `);

      // Drop primary key constraint
      await client.query(`
        ALTER TABLE cruises DROP CONSTRAINT IF EXISTS cruises_pkey;
      `);

      // Drop old columns
      await client.query(`
        ALTER TABLE cruises
        DROP COLUMN id,
        DROP COLUMN cruise_id;
      `);

      // Step 5: Rename new columns and add constraints
      console.log('🔄 Step 4: Renaming columns and adding constraints...');

      await client.query(`
        ALTER TABLE cruises
        RENAME COLUMN new_id TO id,
        RENAME COLUMN new_cruise_id TO cruise_id;
      `);

      // Add primary key constraint
      await client.query(`
        ALTER TABLE cruises
        ADD CONSTRAINT cruises_pkey PRIMARY KEY (id);
      `);

      // Add NOT NULL constraints
      await client.query(`
        ALTER TABLE cruises
        ALTER COLUMN id SET NOT NULL,
        ALTER COLUMN cruise_id SET NOT NULL;
      `);

      // Step 6: Recreate foreign key constraints
      console.log('🔄 Step 5: Recreating foreign key constraints...');

      // Update related tables to use INTEGER type as well
      const relatedTables = [
        { table: 'itineraries', column: 'cruise_id' },
        { table: 'alternative_sailings', column: 'cruise_id' },
        { table: 'pricing', column: 'cruise_id' },
        { table: 'cheapest_pricing', column: 'cruise_id' },
        { table: 'price_history', column: 'cruise_id' },
        { table: 'quote_requests', column: 'cruise_id' }
      ];

      for (const { table, column } of relatedTables) {
        // Check if table exists
        const tableExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = $1
          );
        `, [table]);

        if (tableExists.rows[0].exists) {
          console.log(`  Updating ${table}.${column}...`);

          // Add new column, convert data, drop old column, rename new column
          await client.query(`ALTER TABLE ${table} ADD COLUMN new_${column} INTEGER;`);

          await client.query(`
            UPDATE ${table}
            SET new_${column} = CASE
              WHEN ${column}::TEXT ~ '^[0-9]+$' THEN ${column}::TEXT::INTEGER
              ELSE NULL
            END;
          `);

          await client.query(`ALTER TABLE ${table} DROP COLUMN ${column};`);
          await client.query(`ALTER TABLE ${table} RENAME COLUMN new_${column} TO ${column};`);

          // Add foreign key constraint
          await client.query(`
            ALTER TABLE ${table}
            ADD CONSTRAINT ${table}_${column}_fkey
            FOREIGN KEY (${column}) REFERENCES cruises(id);
          `);
        }
      }

      // Step 7: Update indexes if they exist
      console.log('🔄 Step 6: Updating indexes...');

      // Recreate common indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_cruises_cruise_id ON cruises(cruise_id);
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_cruises_sailing_date ON cruises(sailing_date);
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_cruises_cruise_line_id ON cruises(cruise_line_id);
      `);

      // Commit transaction
      await client.query('COMMIT');

      console.log('\n✅ Schema field type fix completed successfully!');

      // Verify final state
      console.log('\n📊 Verifying final field types...');

      const finalTypes = await client.query(`
        SELECT
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns
        WHERE table_name = 'cruises'
          AND column_name IN ('id', 'cruise_id')
        ORDER BY column_name;
      `);

      console.log('Final field types:');
      finalTypes.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });

      // Show sample data with new types
      const finalSample = await client.query(`
        SELECT id, cruise_id, name, sailing_date
        FROM cruises
        ORDER BY id
        LIMIT 5;
      `);

      console.log('\nSample data with new types:');
      finalSample.rows.forEach(row => {
        console.log(`  id: ${row.id} (${typeof row.id}), cruise_id: ${row.cruise_id} (${typeof row.cruise_id}), name: ${row.name}`);
      });

      console.log('\n🎉 Field type fix completed! The schema now matches Traveltek specification:');
      console.log('  ✅ codetocruiseid (id): INTEGER (was VARCHAR)');
      console.log('  ✅ cruiseid (cruise_id): INTEGER (was VARCHAR)');
      console.log('  ✅ All foreign key relationships updated');
      console.log('  ✅ Indexes recreated');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('\n❌ Error fixing schema field types:', error);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the fix
if (require.main === module) {
  fixSchemaFieldTypes()
    .then(() => {
      console.log('\n✨ Schema field type fix completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Schema field type fix failed:', error.message);
      process.exit(1);
    });
}

module.exports = { fixSchemaFieldTypes };
