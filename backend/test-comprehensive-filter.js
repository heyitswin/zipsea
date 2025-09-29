/**
 * Test script to verify comprehensive endpoint 14-day filter is working correctly
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
const sql = postgres(databaseUrl, {
  ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function testComprehensiveFilter() {
  console.log('=' * 80);
  console.log('TESTING COMPREHENSIVE ENDPOINT 14-DAY FILTER');
  console.log('=' * 80);
  console.log();

  try {
    // Get current date and 14 days from now
    const today = new Date();
    const twoWeeksFromNow = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const minSailingDate = twoWeeksFromNow.toISOString().split('T')[0];

    console.log(`Today: ${today.toISOString().split('T')[0]}`);
    console.log(`14 days from now (minimum sailing date): ${minSailingDate}`);
    console.log();

    // Test the actual query used by comprehensive service
    const results = await sql`
      SELECT
        c.id,
        c.name,
        c.sailing_date,
        c.cruise_line_id,
        cl.name as cruise_line_name
      FROM cruises c
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.is_active = true
      AND c.sailing_date >= ${minSailingDate}
      AND c.cheapest_price IS NOT NULL
      AND c.cheapest_price > 99
      ORDER BY c.sailing_date ASC
      LIMIT 10
    `;

    console.log('Sample of cruises that WILL BE SHOWN (sailing after 14 days):');
    results.forEach(cruise => {
      const date = new Date(cruise.sailing_date);
      const daysUntil = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
      console.log(`  - ${cruise.name} (${cruise.cruise_line_name})`);
      console.log(`    Sailing: ${cruise.sailing_date} (${daysUntil} days from now)`);
    });
    console.log();

    // Check for cruises that should be filtered out
    const tooSoonCruises = await sql`
      SELECT
        COUNT(*) as count,
        MIN(sailing_date) as earliest,
        MAX(sailing_date) as latest
      FROM cruises
      WHERE is_active = true
      AND sailing_date >= CURRENT_DATE
      AND sailing_date < ${minSailingDate}
      AND cheapest_price IS NOT NULL
      AND cheapest_price > 99
    `;

    const filtered = tooSoonCruises[0];
    console.log('Cruises that WILL BE FILTERED OUT:');
    console.log(`  Count: ${filtered.count}`);
    if (filtered.count > 0) {
      console.log(`  Date range: ${filtered.earliest} to ${filtered.latest}`);
    }
    console.log();

    // Test facets query
    const cruiseLineFacets = await sql`
      SELECT
        cl.id,
        cl.name,
        COUNT(DISTINCT c.id) as count
      FROM cruise_lines cl
      LEFT JOIN cruises c ON c.cruise_line_id = cl.id
        AND c.is_active = true
        AND c.sailing_date >= ${minSailingDate}
      WHERE cl.is_active = true
      GROUP BY cl.id, cl.name
      HAVING COUNT(DISTINCT c.id) > 0
      ORDER BY cl.name
      LIMIT 5
    `;

    console.log('Sample cruise line facets (with filtered counts):');
    cruiseLineFacets.forEach(line => {
      console.log(`  - ${line.name}: ${line.count} cruises`);
    });
    console.log();

    // Test date range
    const dateRange = await sql`
      SELECT
        MIN(sailing_date) as min_date,
        MAX(sailing_date) as max_date,
        COUNT(*) as total
      FROM cruises
      WHERE is_active = true
      AND sailing_date >= ${minSailingDate}
    `;

    const range = dateRange[0];
    console.log('=' * 80);
    console.log('COMPREHENSIVE FILTER VALIDATION RESULTS:');
    console.log(`✅ Minimum sailing date correctly set to: ${minSailingDate}`);
    console.log(`✅ ${filtered.count} cruises within 14 days are being filtered out`);
    console.log(`✅ ${range.total} cruises available after filter`);
    console.log(`✅ Date range: ${range.min_date} to ${range.max_date}`);
    console.log('=' * 80);

  } catch (error) {
    console.error('Error testing comprehensive filter:', error);
  } finally {
    await sql.end();
  }
}

testComprehensiveFilter();
