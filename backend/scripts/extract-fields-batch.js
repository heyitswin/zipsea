const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function extractFieldsBatch() {
  console.log('Extracting missing fields from raw_data JSONB (batch mode)...\n');

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

    // Count records that need updating
    console.log('Counting records that need updates...');
    const countResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN ship_name IS NULL OR ship_name = '' THEN 1 END) as need_ship_name
      FROM cruises
      WHERE is_active = true
        AND raw_data IS NOT NULL
        AND raw_data::text != '{}'
    `);

    const stats = countResult.rows[0];
    console.log(`Total active cruises with data: ${stats.total}`);
    console.log(`Need ship_name update: ${stats.need_ship_name}\n`);

    if (stats.need_ship_name > 0) {
      console.log('Updating ship names in batches...');

      // Process in batches of 5000
      const batchSize = 5000;
      let totalUpdated = 0;
      let hasMore = true;

      while (hasMore) {
        const updateResult = await pool.query(`
          WITH to_update AS (
            SELECT id
            FROM cruises
            WHERE is_active = true
              AND (ship_name IS NULL OR ship_name = '')
              AND raw_data->'shipcontent'->>'name' IS NOT NULL
            LIMIT ${batchSize}
          )
          UPDATE cruises c
          SET ship_name = raw_data->'shipcontent'->>'name'
          FROM to_update tu
          WHERE c.id = tu.id
        `);

        if (updateResult.rowCount > 0) {
          totalUpdated += updateResult.rowCount;
          console.log(`  Updated batch: ${updateResult.rowCount} records (total: ${totalUpdated})`);
        } else {
          hasMore = false;
        }
      }

      console.log(`✅ Ship names updated: ${totalUpdated} records\n`);
    }

    // Now update other missing fields
    console.log('Checking other fields...');

    // Update voyage codes
    const voyageResult = await pool.query(`
      UPDATE cruises
      SET voyage_code = raw_data->>'voyagecode'
      WHERE is_active = true
        AND (voyage_code IS NULL OR voyage_code = '')
        AND raw_data->>'voyagecode' IS NOT NULL
    `);
    if (voyageResult.rowCount > 0) {
      console.log(`✅ Voyage codes updated: ${voyageResult.rowCount} records`);
    }

    // Update port IDs
    const portResult = await pool.query(`
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
      WHERE is_active = true
        AND (embarkation_port_id IS NULL OR disembarkation_port_id IS NULL)
        AND (raw_data->>'startportid' IS NOT NULL OR raw_data->>'endportid' IS NOT NULL)
    `);
    if (portResult.rowCount > 0) {
      console.log(`✅ Port IDs updated: ${portResult.rowCount} records`);
    }

    // Update region IDs
    const regionResult = await pool.query(`
      UPDATE cruises
      SET region_ids = raw_data->>'regionids'
      WHERE is_active = true
        AND (region_ids IS NULL OR region_ids = '')
        AND raw_data->>'regionids' IS NOT NULL
    `);
    if (regionResult.rowCount > 0) {
      console.log(`✅ Region IDs updated: ${regionResult.rowCount} records`);
    }

    // Update nights
    const nightsResult = await pool.query(`
      UPDATE cruises
      SET nights = (raw_data->>'nights')::INTEGER
      WHERE is_active = true
        AND nights IS NULL
        AND raw_data->>'nights' IS NOT NULL
        AND raw_data->>'nights' ~ '^[0-9]+$'
    `);
    if (nightsResult.rowCount > 0) {
      console.log(`✅ Nights updated: ${nightsResult.rowCount} records`);
    }

    // Final verification
    console.log('\n=== FINAL VERIFICATION ===\n');
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
    console.log(`Ship names: ${final.with_ship_name}/${final.total} (${(final.with_ship_name/final.total*100).toFixed(1)}%)`);
    console.log(`Voyage codes: ${final.with_voyage_code}/${final.total} (${(final.with_voyage_code/final.total*100).toFixed(1)}%)`);
    console.log(`Embarkation ports: ${final.with_embark_port}/${final.total} (${(final.with_embark_port/final.total*100).toFixed(1)}%)`);
    console.log(`Disembarkation ports: ${final.with_disembark_port}/${final.total} (${(final.with_disembark_port/final.total*100).toFixed(1)}%)`);
    console.log(`Region IDs: ${final.with_region_ids}/${final.total} (${(final.with_region_ids/final.total*100).toFixed(1)}%)`);
    console.log(`Nights: ${final.with_nights}/${final.total} (${(final.with_nights/final.total*100).toFixed(1)}%)`);

    console.log('\n✅ Field extraction completed successfully!');

  } catch (error) {
    console.error('Error extracting fields:', error);
  } finally {
    await pool.end();
  }
}

extractFieldsBatch();
