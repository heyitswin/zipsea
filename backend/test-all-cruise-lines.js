require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testAllCruiseLines() {
  console.log('Testing December 2025 cruises for ALL cruise lines...\n');
  
  const query = `
    SELECT 
      cl.name as cruise_line,
      cl.id as cruise_line_id,
      COUNT(*) as total_cruises,
      COUNT(CASE WHEN c.cheapest_price IS NOT NULL THEN 1 END) as with_price,
      COUNT(CASE WHEN c.cheapest_price IS NULL THEN 1 END) as without_price
    FROM cruises c
    JOIN cruise_lines cl ON c.cruise_line_id = cl.id
    WHERE c.is_active = true
      AND c.sailing_date >= '2025-12-01'
      AND c.sailing_date <= '2025-12-31'
    GROUP BY cl.id, cl.name
    ORDER BY total_cruises DESC
  `;
  
  try {
    const result = await pool.query(query);
    console.log('Cruise Line                        | Total | With Price | Without Price');
    console.log('-----------------------------------|-------|------------|-------------');
    
    let totalCruises = 0;
    let totalWithPrice = 0;
    let totalWithoutPrice = 0;
    
    result.rows.forEach(row => {
      const name = row.cruise_line.padEnd(34);
      totalCruises += parseInt(row.total_cruises);
      totalWithPrice += parseInt(row.with_price);
      totalWithoutPrice += parseInt(row.without_price);
      console.log(`${name} | ${String(row.total_cruises).padStart(5)} | ${String(row.with_price).padStart(10)} | ${String(row.without_price).padStart(13)}`);
    });
    
    console.log('-----------------------------------|-------|------------|-------------');
    console.log(`${'TOTAL'.padEnd(34)} | ${String(totalCruises).padStart(5)} | ${String(totalWithPrice).padStart(10)} | ${String(totalWithoutPrice).padStart(13)}`);
    
    const percentWithPrice = ((totalWithPrice / totalCruises) * 100).toFixed(1);
    console.log(`\n${percentWithPrice}% of December 2025 cruises have prices`);
    
  } catch (error) {
    console.error('Query failed:', error.message);
  }
  
  await pool.end();
}

testAllCruiseLines();
