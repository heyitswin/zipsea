const { db } = require('./dist/db/connection');
const { sql } = require('drizzle-orm');

async function test() {
  try {
    console.log('Searching for any ships...');
    const result = await db.execute(sql`
      SELECT s.id, s.name, COUNT(c.id) as cruise_count
      FROM ships s
      LEFT JOIN cruises c ON s.id = c.ship_id
        AND c.sailing_date >= CURRENT_DATE
        AND c.is_active = true
      GROUP BY s.id, s.name
      HAVING COUNT(c.id) > 0
      ORDER BY COUNT(c.id) DESC
      LIMIT 10
    `);

    console.log('Ships with cruises:', JSON.stringify(result.rows, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

setTimeout(() => {
  test();
}, 100);
