const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 30000,
});

async function getCruiseSlugs() {
  try {
    const result = await pool.query(`
      SELECT DISTINCT c.id, c.slug, c.name
      FROM cruises c
      INNER JOIN price_history ph ON c.id = ph.cruise_id
      WHERE c.slug IS NOT NULL
      ORDER BY ph.created_at DESC
      LIMIT 10
    `);
    
    console.log('Cruises with price history and slugs:');
    console.log(JSON.stringify(result.rows, null, 2));
    
    if (result.rows.length > 0) {
      console.log('\nSample URLs:');
      result.rows.forEach(cruise => {
        console.log(`https://zipsea.com/cruise/${cruise.slug}`);
      });
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

getCruiseSlugs();
