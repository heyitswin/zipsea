require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function checkCruise() {
  try {
    const result = await pool.query(`
      SELECT
        id,
        jsonb_typeof(raw_data) as raw_type,
        CASE
          WHEN raw_data->>'0' IS NOT NULL AND raw_data->>'1' IS NOT NULL
          THEN 'Corrupted (character-by-character)'
          ELSE 'Normal JSON'
        END as status,
        pg_column_size(raw_data) as size_bytes,
        SUBSTRING(raw_data::text, 1, 200) as preview
      FROM cruises
      WHERE id = '2190299'
    `);

    if (result.rows.length > 0) {
      const cruise = result.rows[0];
      console.log('\nCruise 2190299 raw_data status:');
      console.log('--------------------------------');
      console.log('Type:', cruise.raw_type);
      console.log('Status:', cruise.status);
      console.log('Size:', cruise.size_bytes, 'bytes');
      console.log('Preview:', cruise.preview.substring(0, 100) + '...');

      // Check if it's corrupted
      const rawDataResult = await pool.query(`
        SELECT raw_data
        FROM cruises
        WHERE id = '2190299'
      `);

      const rawData = rawDataResult.rows[0].raw_data;
      if (rawData && typeof rawData === 'object' && rawData['0'] !== undefined) {
        console.log('\n⚠️  CONFIRMED: This cruise has corrupted character-by-character storage');
        console.log(
          'First 10 characters:',
          Object.keys(rawData)
            .slice(0, 10)
            .map(k => rawData[k])
            .join('')
        );
      } else if (rawData && typeof rawData === 'object' && rawData.id) {
        console.log('\n✅ This cruise has valid JSON data');
        console.log('Cruise name:', rawData.name);
        console.log('Has cheapest data?', !!rawData.cheapest);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkCruise();
