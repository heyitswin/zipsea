require('dotenv').config();
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { sql } = require('drizzle-orm');

const dbUrl = process.env.DATABASE_URL;
const sqlClient = postgres(dbUrl, {
  ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
});
const db = drizzle(sqlClient);

async function checkPricingSample() {
  console.log('Checking December 2025 cruises by cruise line...\n');
  
  try {
    // Check December 2025 cruises for all lines
    const result = await db.execute(sql`
      SELECT 
        cl.name as cruise_line,
        COUNT(*) as total,
        COUNT(CASE WHEN c.cheapest_price IS NOT NULL AND c.cheapest_price > 99 THEN 1 END) as with_valid_price
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.is_active = true
        AND c.sailing_date >= '2025-12-01'
        AND c.sailing_date <= '2025-12-31'
      GROUP BY cl.id, cl.name
      HAVING COUNT(*) > 0
      ORDER BY COUNT(*) DESC
    `);
    
    console.log('Cruise Line                    | Total | With Price | % Coverage');
    console.log('--------------------------------|-------|------------|----------');
    result.forEach(row => {
      const pct = ((row.with_valid_price / row.total) * 100).toFixed(0);
      console.log(`${row.cruise_line.padEnd(31)} | ${String(row.total).padStart(5)} | ${String(row.with_valid_price).padStart(10)} | ${pct.padStart(8)}%`);
    });
    
    // Sample check - get 5 random cruises from different lines
    console.log('\n\nSample of cruises with pricing data:\n');
    const samples = await db.execute(sql`
      SELECT DISTINCT ON (c.cruise_line_id)
        cl.name as cruise_line,
        c.name,
        c.sailing_date,
        c.cheapest_price,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        c.updated_at
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.is_active = true
        AND c.sailing_date >= '2025-12-01'
        AND c.sailing_date <= '2025-12-31'
        AND c.cheapest_price IS NOT NULL
      ORDER BY c.cruise_line_id, c.updated_at DESC
      LIMIT 5
    `);
    
    samples.forEach((cruise, i) => {
      console.log(`${i + 1}. ${cruise.cruise_line} - ${cruise.name}`);
      console.log(`   Date: ${cruise.sailing_date}`);
      console.log(`   Cheapest: $${cruise.cheapest_price}`);
      console.log(`   Prices - Interior: $${cruise.interior_price || 'N/A'}, Ocean: $${cruise.oceanview_price || 'N/A'}, Balcony: $${cruise.balcony_price || 'N/A'}, Suite: $${cruise.suite_price || 'N/A'}`);
      console.log(`   Last Updated: ${cruise.updated_at}\n`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await sqlClient.end();
  }
}

checkPricingSample();
