const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function updateFieldsIncremental() {
  console.log('Updating fields from raw_data (incremental approach)...\n');

  try {
    const batchSize = 1000;
    let totalUpdated = 0;
    let batchNumber = 0;

    while (true) {
      batchNumber++;
      console.log(`Processing batch ${batchNumber} (${batchSize} records)...`);

      // Update a batch of records
      const result = await pool.query(`
        WITH batch AS (
          SELECT id
          FROM cruises
          WHERE is_active = true
            AND (ship_name IS NULL OR ship_name = '')
            AND raw_data->'shipcontent'->>'name' IS NOT NULL
          LIMIT ${batchSize}
        )
        UPDATE cruises c
        SET ship_name = raw_data->'shipcontent'->>'name'
        FROM batch b
        WHERE c.id = b.id
      `);

      if (result.rowCount === 0) {
        console.log('No more records to update.\n');
        break;
      }

      totalUpdated += result.rowCount;
      console.log(`  Updated: ${result.rowCount} records (Total: ${totalUpdated})`);

      // Show progress every 10 batches
      if (batchNumber % 10 === 0) {
        const progressResult = await pool.query(`
          SELECT COUNT(*) as remaining
          FROM cruises
          WHERE is_active = true
            AND (ship_name IS NULL OR ship_name = '')
            AND raw_data->'shipcontent'->>'name' IS NOT NULL
        `);
        console.log(`  Remaining: ${progressResult.rows[0].remaining} records\n`);
      }
    }

    console.log(`✅ Ship name update completed! Total updated: ${totalUpdated}\n`);

    // Now update other fields
    console.log('Updating other fields...\n');

    // Update voyage codes
    console.log('Updating voyage codes...');
    const voyageResult = await pool.query(`
      UPDATE cruises
      SET voyage_code = raw_data->>'voyagecode'
      WHERE is_active = true
        AND (voyage_code IS NULL OR voyage_code = '')
        AND raw_data->>'voyagecode' IS NOT NULL
    `);
    console.log(`✅ Voyage codes updated: ${voyageResult.rowCount} records\n`);

    // Update port IDs (with error handling for invalid integers)
    console.log('Updating port IDs...');
    const portResult = await pool.query(`
      UPDATE cruises
      SET
        embarkation_port_id = CASE
          WHEN embarkation_port_id IS NULL
            AND raw_data->>'startportid' IS NOT NULL
            AND raw_data->>'startportid' ~ '^[0-9]+$'
          THEN (raw_data->>'startportid')::INTEGER
          ELSE embarkation_port_id
        END,
        disembarkation_port_id = CASE
          WHEN disembarkation_port_id IS NULL
            AND raw_data->>'endportid' IS NOT NULL
            AND raw_data->>'endportid' ~ '^[0-9]+$'
          THEN (raw_data->>'endportid')::INTEGER
          ELSE disembarkation_port_id
        END
      WHERE is_active = true
        AND (embarkation_port_id IS NULL OR disembarkation_port_id IS NULL)
        AND (raw_data->>'startportid' IS NOT NULL OR raw_data->>'endportid' IS NOT NULL)
    `);
    console.log(`✅ Port IDs updated: ${portResult.rowCount} records\n`);

    // Update nights
    console.log('Updating nights...');
    const nightsResult = await pool.query(`
      UPDATE cruises
      SET nights = (raw_data->>'nights')::INTEGER
      WHERE is_active = true
        AND nights IS NULL
        AND raw_data->>'nights' IS NOT NULL
        AND raw_data->>'nights' ~ '^[0-9]+$'
    `);
    console.log(`✅ Nights updated: ${nightsResult.rowCount} records\n`);

    // Final verification
    console.log('=== FINAL VERIFICATION ===\n');
    const verifyResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(ship_name) as with_ship_name,
        COUNT(voyage_code) as with_voyage_code,
        COUNT(embarkation_port_id) as with_embark_port,
        COUNT(disembarkation_port_id) as with_disembark_port,
        COUNT(nights) as with_nights
      FROM cruises
      WHERE is_active = true
    `);

    const stats = verifyResult.rows[0];
    console.log(`Total active cruises: ${stats.total}`);
    console.log(`Ship names: ${stats.with_ship_name} (${(stats.with_ship_name/stats.total*100).toFixed(1)}%)`);
    console.log(`Voyage codes: ${stats.with_voyage_code} (${(stats.with_voyage_code/stats.total*100).toFixed(1)}%)`);
    console.log(`Embarkation ports: ${stats.with_embark_port} (${(stats.with_embark_port/stats.total*100).toFixed(1)}%)`);
    console.log(`Disembarkation ports: ${stats.with_disembark_port} (${(stats.with_disembark_port/stats.total*100).toFixed(1)}%)`);
    console.log(`Nights: ${stats.with_nights} (${(stats.with_nights/stats.total*100).toFixed(1)}%)`);

    console.log('\n✅ All field updates completed successfully!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

updateFieldsIncremental();
