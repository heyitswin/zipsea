const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkAllVikingCabins() {
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION;
  const pool = new Pool({ connectionString });

  try {
    console.log('Finding all Viking cruises (cruise_line_id = 21)...\n');

    // Find Viking cruises
    const cruisesResult = await pool.query(`
      SELECT c.id, c.name, c.sailing_date, s.name as ship_name, c.ship_id
      FROM cruises c
      LEFT JOIN ships s ON c.ship_id = s.id
      WHERE c.cruise_line_id = 21
      AND c.is_active = true
      AND c.cheapest_price IS NOT NULL
      ORDER BY c.sailing_date
      LIMIT 20
    `);

    console.log(`Found ${cruisesResult.rows.length} active Viking cruises with prices\n`);

    // For each cruise, check if ship has cabin categories
    const shipIds = [...new Set(cruisesResult.rows.map(c => c.ship_id))];

    for (const shipId of shipIds) {
      const cabinResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM cabin_categories
        WHERE ship_id = $1 AND is_active = true
      `, [shipId]);

      const shipName = cruisesResult.rows.find(c => c.ship_id === shipId)?.ship_name || 'Unknown';
      console.log(`Ship ${shipId} (${shipName}): ${cabinResult.rows[0].count} active cabin categories`);
    }

    // Check a few specific Viking cruises for raw_data
    console.log('\nChecking if cruises have raw_data with cabins:');
    for (const cruise of cruisesResult.rows.slice(0, 5)) {
      const rawDataResult = await pool.query(`
        SELECT
          CASE
            WHEN raw_data IS NULL THEN 'No raw_data'
            WHEN raw_data::text LIKE '%"cabins":%' THEN 'Has cabins in raw_data'
            ELSE 'raw_data exists but no cabins'
          END as status
        FROM cruises
        WHERE id = $1
      `, [cruise.id]);

      console.log(`- Cruise ${cruise.id} (${cruise.name}): ${rawDataResult.rows[0].status}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkAllVikingCabins();
