const { db } = require('../src/db/connection');
const { sql } = require('drizzle-orm');

async function checkCruise() {
  try {
    console.log('Checking cruise 2143102 in database...\n');

    // Check cruise basic info and last update
    const cruiseInfo = await db.execute(sql`
      SELECT
        id,
        name,
        sailing_date,
        updated_at,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price
      FROM cruises
      WHERE id = '2143102'
    `);

    if (cruiseInfo.rows.length > 0) {
      const cruise = cruiseInfo.rows[0];
      console.log('=== CRUISE INFO ===');
      console.log('ID:', cruise.id);
      console.log('Name:', cruise.name);
      console.log('Sailing Date:', cruise.sailing_date);
      console.log('Last Updated:', cruise.updated_at);
      console.log('\n=== PRICES IN CRUISES TABLE ===');
      console.log('Interior:', cruise.interior_price || 'NULL');
      console.log('Oceanview:', cruise.oceanview_price || 'NULL');
      console.log('Balcony:', cruise.balcony_price || 'NULL');
      console.log('Suite:', cruise.suite_price || 'NULL');
    } else {
      console.log('Cruise 2143102 not found in cruises table');
    }

    // Check cheapest_pricing table
    console.log('\n=== CHEAPEST_PRICING TABLE ===');
    const cheapestPricing = await db.execute(sql`
      SELECT
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        cheapest_price,
        cheapest_cabin_type,
        last_updated
      FROM cheapest_pricing
      WHERE cruise_id = '2143102'
    `);

    if (cheapestPricing.rows.length > 0) {
      const pricing = cheapestPricing.rows[0];
      console.log('Interior Price:', pricing.interior_price || 'NULL');
      console.log('Oceanview Price:', pricing.oceanview_price || 'NULL');
      console.log('Balcony Price:', pricing.balcony_price || 'NULL');
      console.log('Suite Price:', pricing.suite_price || 'NULL');
      console.log('Cheapest Price:', pricing.cheapest_price || 'NULL');
      console.log('Cheapest Cabin Type:', pricing.cheapest_cabin_type || 'NULL');
      console.log('Last Updated:', pricing.last_updated);
    } else {
      console.log('No data in cheapest_pricing table for cruise 2143102');
    }

    // Check individual pricing records
    console.log('\n=== DETAILED PRICING RECORDS ===');
    const pricingRecords = await db.execute(sql`
      SELECT
        cabin_code,
        cabin_type,
        rate_code,
        base_price,
        total_price,
        is_available,
        updated_at
      FROM pricing
      WHERE cruise_id = '2143102'
      ORDER BY cabin_type, base_price
      LIMIT 20
    `);

    if (pricingRecords.rows.length > 0) {
      console.log(`Found ${pricingRecords.rows.length} pricing records`);
      console.log('\nSample records:');
      pricingRecords.rows.forEach(record => {
        console.log(`  ${record.cabin_type || 'Unknown'} - ${record.cabin_code}: $${record.base_price} (Rate: ${record.rate_code}, Available: ${record.is_available}, Updated: ${record.updated_at})`);
      });
    } else {
      console.log('No pricing records found for cruise 2143102');
    }

    // Check sync logs if available
    console.log('\n=== SYNC HISTORY ===');
    const syncLogs = await db.execute(sql`
      SELECT
        created_at,
        status,
        details
      FROM sync_logs
      WHERE details LIKE '%2143102%'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (syncLogs.rows.length > 0) {
      console.log('Recent sync logs mentioning this cruise:');
      syncLogs.rows.forEach(log => {
        console.log(`  ${log.created_at}: ${log.status} - ${log.details}`);
      });
    } else {
      console.log('No sync logs found for cruise 2143102');
    }

    // Check raw_data in pricing if it exists
    console.log('\n=== RAW DATA CHECK ===');
    const rawDataSample = await db.execute(sql`
      SELECT
        cabin_code,
        raw_data::text
      FROM pricing
      WHERE cruise_id = '2143102'
      AND raw_data IS NOT NULL
      LIMIT 1
    `);

    if (rawDataSample.rows.length > 0) {
      console.log('Sample raw_data found for cabin:', rawDataSample.rows[0].cabin_code);
      try {
        const rawData = JSON.parse(rawDataSample.rows[0].raw_data);
        console.log('Raw data keys:', Object.keys(rawData).join(', '));
      } catch (e) {
        console.log('Could not parse raw_data');
      }
    } else {
      console.log('No raw_data stored for this cruise');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkCruise();
