require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkCorruption() {
  try {
    // Check specific cruise 2145865
    const result = await pool.query(`
      SELECT 
        id,
        pg_typeof(raw_data) as data_type,
        jsonb_typeof(raw_data) as json_type,
        CASE 
          WHEN raw_data IS NULL THEN 'NULL'
          WHEN jsonb_typeof(raw_data) = 'string' THEN 'JSON_STRING'
          WHEN raw_data->>'0' IS NOT NULL THEN 'CHAR_BY_CHAR'
          ELSE 'NORMAL_JSON'
        END as corruption_status,
        pg_column_size(raw_data) as size_bytes
      FROM cruises
      WHERE id IN ('2145865', '2190299')
    `);
    
    console.log('Checking specific cruises:');
    result.rows.forEach(row => {
      console.log(`\nCruise ${row.id}:`);
      console.log(`  Data type: ${row.data_type}`);
      console.log(`  JSON type: ${row.json_type}`);
      console.log(`  Status: ${row.corruption_status}`);
      console.log(`  Size: ${row.size_bytes} bytes`);
    });
    
    // Get raw data for 2145865
    const rawResult = await pool.query(`
      SELECT raw_data
      FROM cruises
      WHERE id = '2145865'
    `);
    
    if (rawResult.rows.length > 0) {
      const data = rawResult.rows[0].raw_data;
      console.log('\nRaw data for 2145865:');
      console.log('  Type:', typeof data);
      console.log('  Is Array?', Array.isArray(data));
      console.log('  Has key "0"?', data && data['0'] !== undefined);
      console.log('  First few keys:', data ? Object.keys(data).slice(0, 10) : 'N/A');
      
      // Check if it's a string that needs parsing
      if (typeof data === 'string') {
        console.log('  String length:', data.length);
        console.log('  First 100 chars:', data.substring(0, 100));
      }
    }
    
    // Count different types
    const countResult = await pool.query(`
      SELECT 
        jsonb_typeof(raw_data) as json_type,
        COUNT(*) as count
      FROM cruises
      WHERE raw_data IS NOT NULL
      GROUP BY jsonb_typeof(raw_data)
    `);
    
    console.log('\nRaw_data types distribution:');
    countResult.rows.forEach(row => {
      console.log(`  ${row.json_type}: ${row.count}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkCorruption();
