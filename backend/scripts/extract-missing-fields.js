const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function extractMissingFields() {
  console.log('Extracting missing fields from raw_data JSONB...\n');

  try {
    // First check if ship_name column exists
    const columnCheckResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'cruises'
        AND column_name = 'ship_name'
    `);

    if (columnCheckResult.rows.length === 0) {
      console.log('Adding ship_name column to cruises table...');
      await pool.query(`
        ALTER TABLE cruises
        ADD COLUMN IF NOT EXISTS ship_name VARCHAR(255)
      `);
      console.log('Column added successfully.\n');
    } else {
      console.log('ship_name column already exists.\n');
    }

    // Check if there's a ships table
    const shipsTableResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'ships'
    `);

    if (shipsTableResult.rows.length > 0) {
      console.log('Ships table exists. Checking its structure...');
      const shipsColumnsResult = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ships'
        ORDER BY ordinal_position
        LIMIT 10
      `);
      console.log('Ships table columns:');
      shipsColumnsResult.rows.forEach(row => {
        console.log(`  ${row.column_name} (${row.data_type})`);
      });
      console.log();
    }

    // Now extract ship_name from raw_data
    console.log('Extracting ship names from raw_data...');
    const updateResult = await pool.query(`
      UPDATE cruises
      SET ship_name = raw_data->'shipcontent'->>'name'
      WHERE raw_data->'shipcontent'->>'name' IS NOT NULL
        AND (ship_name IS NULL OR ship_name = '')
    `);
    console.log(`Updated ${updateResult.rowCount} cruise records with ship names.\n`);

    // Check how many records still need other fields populated
    console.log('Checking for missing data in existing columns...\n');

    const missingDataResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN voyage_code IS NULL OR voyage_code = '' THEN 1 END) as missing_voyage_code,
        COUNT(CASE WHEN embarkation_port_id IS NULL THEN 1 END) as missing_embark_port,
        COUNT(CASE WHEN disembarkation_port_id IS NULL THEN 1 END) as missing_disembark_port,
        COUNT(CASE WHEN region_ids IS NULL OR region_ids = '' THEN 1 END) as missing_region_ids,
        COUNT(CASE WHEN nights IS NULL THEN 1 END) as missing_nights
      FROM cruises
      WHERE is_active = true
    `);

    const stats = missingDataResult.rows[0];
    console.log('Missing data statistics:');
    console.log(`  Total active cruises: ${stats.total}`);
    console.log(`  Missing voyage_code: ${stats.missing_voyage_code}`);
    console.log(`  Missing embarkation_port_id: ${stats.missing_embark_port}`);
    console.log(`  Missing disembarkation_port_id: ${stats.missing_disembark_port}`);
    console.log(`  Missing region_ids: ${stats.missing_region_ids}`);
    console.log(`  Missing nights: ${stats.missing_nights}\n`);

    // Populate missing voyage codes
    if (stats.missing_voyage_code > 0) {
      console.log('Populating missing voyage codes...');
      const voyageUpdateResult = await pool.query(`
        UPDATE cruises
        SET voyage_code = raw_data->>'voyagecode'
        WHERE (voyage_code IS NULL OR voyage_code = '')
          AND raw_data->>'voyagecode' IS NOT NULL
      `);
      console.log(`Updated ${voyageUpdateResult.rowCount} records with voyage codes.\n`);
    }

    // Populate missing port IDs
    if (stats.missing_embark_port > 0 || stats.missing_disembark_port > 0) {
      console.log('Populating missing port IDs...');
      const portUpdateResult = await pool.query(`
        UPDATE cruises
        SET
          embarkation_port_id = CASE
            WHEN embarkation_port_id IS NULL AND raw_data->>'startportid' IS NOT NULL
            THEN (raw_data->>'startportid')::INTEGER
            ELSE embarkation_port_id
          END,
          disembarkation_port_id = CASE
            WHEN disembarkation_port_id IS NULL AND raw_data->>'endportid' IS NOT NULL
            THEN (raw_data->>'endportid')::INTEGER
            ELSE disembarkation_port_id
          END
        WHERE (embarkation_port_id IS NULL OR disembarkation_port_id IS NULL)
          AND (raw_data->>'startportid' IS NOT NULL OR raw_data->>'endportid' IS NOT NULL)
      `);
      console.log(`Updated ${portUpdateResult.rowCount} records with port IDs.\n`);
    }

    // Populate missing region IDs
    if (stats.missing_region_ids > 0) {
      console.log('Populating missing region IDs...');
      const regionUpdateResult = await pool.query(`
        UPDATE cruises
        SET region_ids = raw_data->>'regionids'
        WHERE (region_ids IS NULL OR region_ids = '')
          AND raw_data->>'regionids' IS NOT NULL
      `);
      console.log(`Updated ${regionUpdateResult.rowCount} records with region IDs.\n`);
    }

    // Populate missing nights
    if (stats.missing_nights > 0) {
      console.log('Populating missing nights...');
      const nightsUpdateResult = await pool.query(`
        UPDATE cruises
        SET nights = (raw_data->>'nights')::INTEGER
        WHERE nights IS NULL
          AND raw_data->>'nights' IS NOT NULL
      `);
      console.log(`Updated ${nightsUpdateResult.rowCount} records with nights.\n`);
    }

    // Final verification
    console.log('=== FINAL VERIFICATION ===\n');
    const finalCheckResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(ship_name) as with_ship_name,
        COUNT(voyage_code) as with_voyage_code,
        COUNT(embarkation_port_id) as with_embark_port,
        COUNT(disembarkation_port_id) as with_disembark_port,
        COUNT(region_ids) as with_region_ids,
        COUNT(nights) as with_nights
      FROM cruises
      WHERE is_active = true
    `);

    const final = finalCheckResult.rows[0];
    console.log(`Ship names populated: ${final.with_ship_name}/${final.total} (${(final.with_ship_name/final.total*100).toFixed(1)}%)`);
    console.log(`Voyage codes populated: ${final.with_voyage_code}/${final.total} (${(final.with_voyage_code/final.total*100).toFixed(1)}%)`);
    console.log(`Embarkation ports populated: ${final.with_embark_port}/${final.total} (${(final.with_embark_port/final.total*100).toFixed(1)}%)`);
    console.log(`Disembarkation ports populated: ${final.with_disembark_port}/${final.total} (${(final.with_disembark_port/final.total*100).toFixed(1)}%)`);
    console.log(`Region IDs populated: ${final.with_region_ids}/${final.total} (${(final.with_region_ids/final.total*100).toFixed(1)}%)`);
    console.log(`Nights populated: ${final.with_nights}/${final.total} (${(final.with_nights/final.total*100).toFixed(1)}%)`);

    console.log('\n✅ Field extraction completed successfully!');

  } catch (error) {
    console.error('Error extracting fields:', error);
  } finally {
    await pool.end();
  }
}

extractMissingFields();
