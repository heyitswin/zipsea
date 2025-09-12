const { db } = require('./backend/src/db/connection');
const { pricing, cruises } = require('./backend/src/db/schema');
const { sql } = require('drizzle-orm');

async function checkAvailability() {
  try {
    // Check if there are any records with isAvailable = false
    const unavailable = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM pricing 
      WHERE is_available = false
    `);
    console.log('Unavailable pricing records:', unavailable.rows[0].count);

    // Check if there are any records with waitlist = true
    const waitlisted = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM pricing 
      WHERE waitlist = true
    `);
    console.log('Waitlisted pricing records:', waitlisted.rows[0].count);

    // Check if there are any records with guarantee = true
    const guaranteed = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM pricing 
      WHERE guarantee = true
    `);
    console.log('Guaranteed pricing records:', guaranteed.rows[0].count);

    // Check if inventory field has any non-null values
    const withInventory = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM pricing 
      WHERE inventory IS NOT NULL
    `);
    console.log('Pricing records with inventory data:', withInventory.rows[0].count);

    // Sample some actual inventory values
    const inventorySample = await db.execute(sql`
      SELECT cruise_id, cabin_code, inventory, is_available, waitlist, guarantee
      FROM pricing 
      WHERE inventory IS NOT NULL
      LIMIT 10
    `);
    
    if (inventorySample.rows.length > 0) {
      console.log('\nSample pricing records with inventory:');
      inventorySample.rows.forEach(row => {
        console.log(`  Cruise: ${row.cruise_id}, Cabin: ${row.cabin_code}, Inventory: ${row.inventory}, Available: ${row.is_available}, Waitlist: ${row.waitlist}, Guarantee: ${row.guarantee}`);
      });
    }

    // Check raw_data field for any availability indicators
    const rawDataSample = await db.execute(sql`
      SELECT cruise_id, raw_data
      FROM pricing 
      WHERE raw_data IS NOT NULL
      LIMIT 5
    `);
    
    if (rawDataSample.rows.length > 0) {
      console.log('\nChecking raw_data for availability fields:');
      rawDataSample.rows.forEach(row => {
        const raw = row.raw_data;
        if (raw) {
          const hasStatus = raw.status !== undefined;
          const hasSoldout = raw.soldout !== undefined;
          const hasOnrequest = raw.onrequest !== undefined;
          const hasAvailable = raw.available !== undefined;
          
          if (hasStatus || hasSoldout || hasOnrequest || hasAvailable) {
            console.log(`  Cruise ${row.cruise_id}: status=${raw.status}, soldout=${raw.soldout}, onrequest=${raw.onrequest}, available=${raw.available}`);
          }
        }
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkAvailability();
