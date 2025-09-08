const { Client } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function testWebhookUpdateLogic() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Sample data from a real FTP file (based on Traveltek format)
    const sampleFtpData = {
      cruiseid: 123456,
      codetocruiseid: "2175084",  // This is the ID we use as primary key
      lineid: 22,  // Royal Caribbean
      shipid: 89,
      name: "7 Night Caribbean Cruise",
      voyagecode: "RC2025CAR",
      itinerarycode: "CARIB7",
      saildate: "2025-10-15",
      nights: 7,
      sailnights: 6,
      seadays: 3,
      startportid: 101,
      endportid: 101,
      regionids: "1,2,3",
      marketid: 1,
      ownerid: 5,
      nofly: "N",
      departuk: false,
      showcruise: true,
      cheapest: {
        combined: {
          inside: 899,
          outside: 1099,
          balcony: 1299,
          suite: 2499
        },
        ratecode: "STANDARD"
      },
      currency: "USD"
    };

    console.log('=== TESTING WEBHOOK UPDATE LOGIC ===\n');
    console.log('Sample cruise ID (codetocruiseid):', sampleFtpData.codetocruiseid);
    console.log('');

    // 1. Check if this cruise exists
    const checkQuery = 'SELECT id, name, nights, updated_at FROM cruises WHERE id = $1';
    const existing = await client.query(checkQuery, [sampleFtpData.codetocruiseid]);

    if (existing.rows.length > 0) {
      console.log('✅ Cruise EXISTS in database:');
      console.log('  Current name:', existing.rows[0].name);
      console.log('  Current nights:', existing.rows[0].nights);
      console.log('  Last updated:', existing.rows[0].updated_at);
      console.log('');

      // Test the update logic
      console.log('Testing UPDATE logic...');
      console.log('Fields that would be updated:');
      console.log('  name: "' + existing.rows[0].name + '" → "' + sampleFtpData.name + '"');
      console.log('  voyage_code: → "' + sampleFtpData.voyagecode + '"');
      console.log('  itinerary_code: → "' + sampleFtpData.itinerarycode + '"');
      console.log('  embarkation_port_id: → ' + sampleFtpData.startportid);
      console.log('  disembarkation_port_id: → ' + sampleFtpData.endportid);
      console.log('');

    } else {
      console.log('❌ Cruise DOES NOT EXIST in database');
      console.log('Would need to CREATE new cruise with ID:', sampleFtpData.codetocruiseid);
      console.log('');
    }

    // 2. Check similar cruises to understand ID format
    console.log('=== CHECKING SIMILAR CRUISE IDS ===\n');

    const similarQuery = `
      SELECT id, name, cruise_line_id, ship_id
      FROM cruises
      WHERE cruise_line_id = $1
      AND ship_id = $2
      ORDER BY sailing_date DESC
      LIMIT 5
    `;

    const similar = await client.query(similarQuery, [sampleFtpData.lineid, sampleFtpData.shipid]);

    if (similar.rows.length > 0) {
      console.log(`Found ${similar.rows.length} cruises for line ${sampleFtpData.lineid}, ship ${sampleFtpData.shipid}:`);
      for (const cruise of similar.rows) {
        console.log(`  ID: ${cruise.id} - ${cruise.name}`);
      }
      console.log('');

      // Check ID format
      const firstId = similar.rows[0].id;
      console.log('ID Format Analysis:');
      console.log('  Sample from DB:', firstId);
      console.log('  Sample from FTP:', sampleFtpData.codetocruiseid);
      console.log('  Match:', firstId.length === sampleFtpData.codetocruiseid.length ? 'Same length' : 'Different length');
      console.log('');
    } else {
      console.log(`No cruises found for line ${sampleFtpData.lineid}, ship ${sampleFtpData.shipid}`);
      console.log('This might indicate:');
      console.log('  1. Line ID mapping issue');
      console.log('  2. Ship doesn\'t exist');
      console.log('  3. No cruises loaded for this combination');
      console.log('');
    }

    // 3. Check if the line and ship exist
    console.log('=== CHECKING LINE AND SHIP ===\n');

    const lineQuery = 'SELECT id, name FROM cruise_lines WHERE id = $1';
    const lineResult = await client.query(lineQuery, [sampleFtpData.lineid]);

    if (lineResult.rows.length > 0) {
      console.log(`✅ Line ${sampleFtpData.lineid} exists: ${lineResult.rows[0].name}`);
    } else {
      console.log(`❌ Line ${sampleFtpData.lineid} DOES NOT EXIST`);
    }

    const shipQuery = 'SELECT id, name, cruise_line_id FROM ships WHERE id = $1';
    const shipResult = await client.query(shipQuery, [sampleFtpData.shipid]);

    if (shipResult.rows.length > 0) {
      console.log(`✅ Ship ${sampleFtpData.shipid} exists: ${shipResult.rows[0].name}`);
      console.log(`   Belongs to line: ${shipResult.rows[0].cruise_line_id}`);
    } else {
      console.log(`❌ Ship ${sampleFtpData.shipid} DOES NOT EXIST`);
    }
    console.log('');

    // 4. Test pricing update
    console.log('=== TESTING PRICING UPDATE ===\n');

    const pricingQuery = 'SELECT * FROM cheapest_pricing WHERE cruise_id = $1';
    const pricingResult = await client.query(pricingQuery, [sampleFtpData.codetocruiseid]);

    if (pricingResult.rows.length > 0) {
      const current = pricingResult.rows[0];
      console.log('Current pricing:');
      console.log('  Interior:', current.interior_price);
      console.log('  Oceanview:', current.oceanview_price);
      console.log('  Balcony:', current.balcony_price);
      console.log('  Suite:', current.suite_price);
      console.log('');
      console.log('New pricing from FTP:');
      console.log('  Interior:', sampleFtpData.cheapest.combined.inside);
      console.log('  Oceanview:', sampleFtpData.cheapest.combined.outside);
      console.log('  Balcony:', sampleFtpData.cheapest.combined.balcony);
      console.log('  Suite:', sampleFtpData.cheapest.combined.suite);
    } else {
      console.log('No existing pricing for this cruise');
      console.log('Would INSERT new pricing:');
      console.log('  Interior:', sampleFtpData.cheapest.combined.inside);
      console.log('  Oceanview:', sampleFtpData.cheapest.combined.outside);
      console.log('  Balcony:', sampleFtpData.cheapest.combined.balcony);
      console.log('  Suite:', sampleFtpData.cheapest.combined.suite);
    }
    console.log('');

    // 5. Check what's actually failing
    console.log('=== POTENTIAL FAILURE POINTS ===\n');

    // Check constraints
    const constraintQuery = `
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      LEFT JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'cruises'
      AND tc.constraint_type = 'FOREIGN KEY'
    `;

    const constraints = await client.query(constraintQuery);
    console.log('Foreign key constraints on cruises table:');
    for (const constraint of constraints.rows) {
      console.log(`  ${constraint.column_name} → ${constraint.foreign_table}.${constraint.foreign_column}`);
    }
    console.log('');

    console.log('Checking if foreign keys would be satisfied:');
    if (!lineResult.rows.length) {
      console.log('  ❌ cruise_line_id constraint would FAIL');
    }
    if (!shipResult.rows.length) {
      console.log('  ❌ ship_id constraint would FAIL');
    }

    // Check port IDs
    const portCheckQuery = 'SELECT id FROM ports WHERE id IN ($1, $2)';
    const portResult = await client.query(portCheckQuery, [sampleFtpData.startportid, sampleFtpData.endportid]);
    if (portResult.rows.length < 2) {
      console.log('  ⚠️  Port IDs might not exist:', sampleFtpData.startportid, sampleFtpData.endportid);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    console.log('\nDisconnected from database');
  }
}

// Run test
testWebhookUpdateLogic().catch(console.error);
