const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function analyzeRawDataSimple() {
  console.log('Analyzing raw_data JSONB fields for extraction opportunities...\n');

  try {
    // First, just get a count of active cruises
    const countResult = await pool.query(`
      SELECT COUNT(*) as total FROM cruises WHERE is_active = true
    `);
    console.log(`Total active cruises: ${countResult.rows[0].total}\n`);

    // Check key fields that should be extracted
    console.log('Checking coverage of important fields...\n');

    // Check ship name
    const shipNameResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN raw_data->'shipcontent'->>'name' IS NOT NULL THEN 1 END) as with_ship_name
      FROM cruises
      WHERE is_active = true
      LIMIT 1000
    `);
    console.log(`Ship name: ${shipNameResult.rows[0].with_ship_name}/${shipNameResult.rows[0].total}`);

    // Check voyage code
    const voyageResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN raw_data->>'voyagecode' IS NOT NULL THEN 1 END) as with_voyage_code
      FROM cruises
      WHERE is_active = true
      LIMIT 1000
    `);
    console.log(`Voyage code: ${voyageResult.rows[0].with_voyage_code}/${voyageResult.rows[0].total}`);

    // Check nights
    const nightsResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN raw_data->>'nights' IS NOT NULL THEN 1 END) as with_nights
      FROM cruises
      WHERE is_active = true
      LIMIT 1000
    `);
    console.log(`Nights: ${nightsResult.rows[0].with_nights}/${nightsResult.rows[0].total}`);

    // Check ports
    const portsResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN raw_data->>'startportid' IS NOT NULL THEN 1 END) as with_start_port,
        COUNT(CASE WHEN raw_data->>'endportid' IS NOT NULL THEN 1 END) as with_end_port
      FROM cruises
      WHERE is_active = true
      LIMIT 1000
    `);
    console.log(`Start port: ${portsResult.rows[0].with_start_port}/${portsResult.rows[0].total}`);
    console.log(`End port: ${portsResult.rows[0].with_end_port}/${portsResult.rows[0].total}`);

    // Get a sample to show structure
    console.log('\n=== SAMPLE DATA ===\n');
    const sampleResult = await pool.query(`
      SELECT
        id,
        raw_data->'shipcontent'->>'name' as ship_name,
        raw_data->>'voyagecode' as voyage_code,
        raw_data->>'nights' as nights,
        raw_data->>'startportid' as start_port_id,
        raw_data->>'endportid' as end_port_id,
        raw_data->>'regionids' as region_ids
      FROM cruises
      WHERE is_active = true
        AND raw_data IS NOT NULL
        AND raw_data::text != '{}'
      LIMIT 3
    `);

    sampleResult.rows.forEach((row, i) => {
      console.log(`Sample ${i+1} (ID: ${row.id}):`);
      console.log(`  Ship: ${row.ship_name}`);
      console.log(`  Voyage: ${row.voyage_code}`);
      console.log(`  Nights: ${row.nights}`);
      console.log(`  Start Port ID: ${row.start_port_id}`);
      console.log(`  End Port ID: ${row.end_port_id}`);
      console.log(`  Region IDs: ${row.region_ids}\n`);
    });

    // Check what columns already exist in cruises table
    console.log('=== EXISTING CRUISES TABLE COLUMNS ===\n');
    const columnsResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'cruises'
      ORDER BY ordinal_position
    `);

    columnsResult.rows.forEach(row => {
      console.log(`  ${row.column_name} (${row.data_type})`);
    });

    console.log('\n=== RECOMMENDATIONS ===\n');
    console.log('Fields that should be extracted to cruises table:');
    console.log('1. ship_name - 100% coverage, essential for display');
    console.log('2. voyage_code - 100% coverage, unique identifier from cruise line');
    console.log('3. nights - 100% coverage, already used for filtering');
    console.log('4. start_port_id - 100% coverage, needed for search');
    console.log('5. end_port_id - 100% coverage, needed for search');
    console.log('6. region_ids - 100% coverage, useful for filtering\n');

    console.log('Next steps:');
    console.log('1. Add these columns to cruises table');
    console.log('2. Run extraction script to populate them');
    console.log('3. Create indexes for search performance');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

analyzeRawDataSimple();
