import { sql } from 'drizzle-orm';
import { db } from '../src/db/connection.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.production' });

async function fixCabinCategoriesTable() {
  console.log('Checking and fixing cabin_categories table...');

  try {
    // Check if the category column exists
    const checkColumn = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'cabin_categories'
      AND column_name = 'category'
    `);

    if (checkColumn.length === 0) {
      console.log('Adding missing category column...');

      // Add the category column
      await db.execute(sql`
        ALTER TABLE cabin_categories
        ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'unknown'
      `);

      console.log('Category column added successfully');

      // Update existing rows to set category based on cabin code or name
      await db.execute(sql`
        UPDATE cabin_categories
        SET category =
          CASE
            WHEN LOWER(name) LIKE '%suite%' OR LOWER(cabin_code) LIKE '%suite%' THEN 'suite'
            WHEN LOWER(name) LIKE '%balcony%' OR LOWER(cabin_code) LIKE '%balcony%' THEN 'balcony'
            WHEN LOWER(name) LIKE '%ocean%' OR LOWER(name) LIKE '%outside%' OR LOWER(cabin_code) LIKE '%ocean%' THEN 'oceanview'
            WHEN LOWER(name) LIKE '%interior%' OR LOWER(name) LIKE '%inside%' OR LOWER(cabin_code) LIKE '%inside%' THEN 'interior'
            ELSE 'unknown'
          END
        WHERE category IS NULL OR category = 'unknown'
      `);

      console.log('Updated category values for existing rows');

      // Make the column NOT NULL after setting values
      await db.execute(sql`
        ALTER TABLE cabin_categories
        ALTER COLUMN category SET NOT NULL
      `);

      console.log('Made category column NOT NULL');
    } else {
      console.log('Category column already exists');
    }

    // Verify the fix
    const testQuery = await db.execute(sql`
      SELECT cabin_code, name, category
      FROM cabin_categories
      LIMIT 5
    `);

    console.log('Sample cabin categories after fix:');
    testQuery.forEach(row => {
      console.log(`- ${row.cabin_code}: ${row.name} (${row.category})`);
    });

    console.log('✅ Cabin categories table fixed successfully');

  } catch (error) {
    console.error('Error fixing cabin_categories table:', error);
    process.exit(1);
  }

  process.exit(0);
}

fixCabinCategoriesTable();
