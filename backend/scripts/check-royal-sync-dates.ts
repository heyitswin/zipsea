import { db } from '../src/db/connection';
import { sql } from 'drizzle-orm';

async function checkRoyalCaribbeanSyncDates() {
  try {
    console.log('Checking Royal Caribbean (ID: 22) sync dates...\n');
    
    // Check Royal Caribbean overall stats
    const stats = await db.execute(sql`
      SELECT 
        cl.id,
        cl.name,
        COUNT(DISTINCT c.id) as total_cruises,
        MAX(c.updated_at) as last_cruise_update,
        MAX(cp.last_updated) as last_pricing_update,
        MIN(c.sailing_date) as earliest_sailing,
        MAX(c.sailing_date) as latest_sailing
      FROM cruise_lines cl
      LEFT JOIN cruises c ON c.cruise_line_id = cl.id
      LEFT JOIN cheapest_pricing cp ON cp.cruise_id = c.id
      WHERE cl.id = 22
      GROUP BY cl.id, cl.name
    `);
    
    console.log('Royal Caribbean Overall Stats:');
    console.log('-------------------------------');
    if (stats.length > 0) {
      const data: any = stats[0];
      console.log(`Name: ${data.name}`);
      console.log(`Total Cruises: ${data.total_cruises}`);
      console.log(`Last Cruise Update: ${data.last_cruise_update ? new Date(data.last_cruise_update).toISOString() : 'N/A'}`);
      console.log(`Last Pricing Update: ${data.last_pricing_update ? new Date(data.last_pricing_update).toISOString() : 'N/A'}`);
      console.log(`Earliest Sailing: ${data.earliest_sailing}`);
      console.log(`Latest Sailing: ${data.latest_sailing}`);
    }
    
    // Check recent update patterns
    console.log('\nRecent Update Dates (by day):');
    console.log('------------------------------');
    const recentUpdates = await db.execute(sql`
      SELECT 
        DATE(updated_at) as update_date,
        COUNT(*) as cruises_updated
      FROM cruises
      WHERE cruise_line_id = 22
      GROUP BY DATE(updated_at)
      ORDER BY update_date DESC
      LIMIT 10
    `);
    
    recentUpdates.forEach((row: any) => {
      console.log(`${row.update_date}: ${row.cruises_updated} cruises`);
    });
    
    // Check pricing updates specifically
    console.log('\nRecent Pricing Updates:');
    console.log('------------------------');
    const pricingUpdates = await db.execute(sql`
      SELECT 
        DATE(cp.last_updated) as update_date,
        COUNT(DISTINCT cp.cruise_id) as cruises_with_pricing
      FROM cheapest_pricing cp
      INNER JOIN cruises c ON c.id = cp.cruise_id
      WHERE c.cruise_line_id = 22
      AND cp.last_updated IS NOT NULL
      GROUP BY DATE(cp.last_updated)
      ORDER BY update_date DESC
      LIMIT 10
    `);
    
    if (pricingUpdates.length > 0) {
      pricingUpdates.forEach((row: any) => {
        console.log(`${row.update_date}: ${row.cruises_with_pricing} cruises`);
      });
    } else {
      console.log('No pricing updates found');
    }
    
    // Check if there's a discrepancy between webhook updates and actual data
    console.log('\nChecking for Aug 31 updates...');
    const aug31Updates = await db.execute(sql`
      SELECT 
        COUNT(*) as count,
        MIN(updated_at) as first_update,
        MAX(updated_at) as last_update
      FROM cruises
      WHERE cruise_line_id = 22
      AND DATE(updated_at) = '2025-08-31'
    `);
    
    const aug31Data: any = aug31Updates[0];
    if (aug31Data?.count > 0) {
      console.log(`Found ${aug31Data.count} cruises updated on Aug 31`);
      console.log(`First update: ${aug31Data.first_update}`);
      console.log(`Last update: ${aug31Data.last_update}`);
    } else {
      console.log('No cruises updated on Aug 31');
    }
    
    // Check for actual FTP file dates in the data
    console.log('\nChecking for FTP file path information...');
    const sampleCruise = await db.execute(sql`
      SELECT 
        id,
        name,
        sailing_date,
        created_at,
        updated_at,
        traveltek_file_path
      FROM cruises
      WHERE cruise_line_id = 22
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    
    if (sampleCruise.length > 0) {
      console.log('Sample cruise:', sampleCruise[0]);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkRoyalCaribbeanSyncDates();