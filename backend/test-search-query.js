require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function testQuery() {
  console.log('Testing NCL December 2025 query...');

  const query = `
    SELECT COUNT(*) as count
    FROM cruises c
    WHERE c.is_active = true
      AND c.sailing_date >= '2025-12-01'
      AND c.sailing_date <= '2025-12-31'
      AND c.cruise_line_id = 17
      AND c.cheapest_price IS NOT NULL
      AND c.cheapest_price > 99
  `;

  console.log('Executing count query...');
  console.time('countQuery');
  try {
    const result = await pool.query(query);
    console.timeEnd('countQuery');
    console.log('Count result:', result.rows[0]);
  } catch (error) {
    console.timeEnd('countQuery');
    console.error('Count query failed:', error.message);
  }

  // Test the full query with JOINs
  const fullQuery = `
    SELECT
      c.id,
      c.cruise_id,
      c.name,
      c.voyage_code,
      c.sailing_date,
      c.nights,
      c.cruise_line_id,
      cl.name as cruise_line_name,
      c.ship_id,
      s.name as ship_name,
      c.embark_port_id,
      p1.name as embark_port_name,
      c.disembark_port_id,
      p2.name as disembark_port_name,
      c.interior_price,
      c.oceanview_price,
      c.balcony_price,
      c.suite_price,
      c.cheapest_price
    FROM cruises c
    LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
    LEFT JOIN ships s ON c.ship_id = s.id
    LEFT JOIN ports p1 ON c.embark_port_id = p1.id
    LEFT JOIN ports p2 ON c.disembark_port_id = p2.id
    WHERE c.is_active = true
      AND c.sailing_date >= '2025-12-01'
      AND c.sailing_date <= '2025-12-31'
      AND c.cruise_line_id = 17
      AND c.cheapest_price IS NOT NULL
      AND c.cheapest_price > 99
    ORDER BY c.sailing_date ASC
    LIMIT 5
  `;

  console.log('\nExecuting full query with JOINs (limit 5)...');
  console.time('fullQuery');
  try {
    const result = await pool.query(fullQuery);
    console.timeEnd('fullQuery');
    console.log('Results found:', result.rows.length);
    if (result.rows.length > 0) {
      console.log('First result:', {
        id: result.rows[0].id,
        name: result.rows[0].name,
        cruise_line_name: result.rows[0].cruise_line_name,
        sailing_date: result.rows[0].sailing_date,
        cheapest_price: result.rows[0].cheapest_price,
      });
    }
  } catch (error) {
    console.timeEnd('fullQuery');
    console.error('Full query failed:', error.message);
  }

  await pool.end();
}

testQuery();
