#!/bin/bash

echo "🔍 Verifying Enhanced Sync Data on Production"
echo "=============================================="
echo ""

echo "📡 Testing on production server..."
echo ""

# Create a simple inline verification script
cat << 'VERIFY_SCRIPT' | ssh srv-d2idrj3ipnbc73abnee0@ssh.oregon.render.com 'cd ~/project/src/backend && node'

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
});

async function verify() {
  try {
    // Check counts
    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM cruises) as cruises,
        (SELECT COUNT(*) FROM cruise_lines) as lines,
        (SELECT COUNT(*) FROM ships) as ships,
        (SELECT COUNT(*) FROM ports) as ports,
        (SELECT COUNT(*) FROM regions) as regions
    `);

    console.log('\n📊 Data Counts:');
    console.log('   Cruises:', counts.rows[0].cruises);
    console.log('   Lines:', counts.rows[0].lines);
    console.log('   Ships:', counts.rows[0].ships);
    console.log('   Ports:', counts.rows[0].ports);
    console.log('   Regions:', counts.rows[0].regions);

    // Check a sample cruise
    const sample = await pool.query(`
      SELECT
        id,
        name,
        sailing_date,
        nights,
        raw_data IS NOT NULL as has_raw_json,
        cheapest_pricing IS NOT NULL as has_pricing_json,
        itinerary_data IS NOT NULL as has_itinerary,
        cabins_data IS NOT NULL as has_cabins
      FROM cruises
      LIMIT 1
    `);

    if (sample.rows.length > 0) {
      console.log('\n🚢 Sample Cruise:');
      const cruise = sample.rows[0];
      console.log('   ID:', cruise.id);
      console.log('   Name:', cruise.name);
      console.log('   Has Raw JSON:', cruise.has_raw_json ? '✅' : '❌');
      console.log('   Has Pricing JSON:', cruise.has_pricing_json ? '✅' : '❌');
      console.log('   Has Itinerary:', cruise.has_itinerary ? '✅' : '❌');
      console.log('   Has Cabins:', cruise.has_cabins ? '✅' : '❌');
    }

    // Check nested data
    const nested = await pool.query(`
      SELECT
        id,
        raw_data->>'name' as json_name,
        raw_data->'shipcontent'->>'name' as ship_name,
        raw_data->'cheapest'->'combined' as combined_pricing,
        jsonb_array_length(COALESCE(raw_data->'itinerary', '[]'::jsonb)) as itinerary_days
      FROM cruises
      WHERE raw_data IS NOT NULL
      LIMIT 1
    `);

    if (nested.rows.length > 0) {
      console.log('\n🔍 Nested JSON Access Test:');
      const data = nested.rows[0];
      console.log('   Cruise Name from JSON:', data.json_name);
      console.log('   Ship Name (2 levels):', data.ship_name);
      console.log('   Combined Pricing (2 levels):', data.combined_pricing ? '✅ Found' : '❌ Missing');
      console.log('   Itinerary Days:', data.itinerary_days);
    }

    // Check completeness
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(raw_data) as with_json,
        COUNT(CASE WHEN raw_data->'ports' IS NOT NULL THEN 1 END) as with_ports,
        COUNT(CASE WHEN raw_data->'regions' IS NOT NULL THEN 1 END) as with_regions
      FROM cruises
    `);

    const s = stats.rows[0];
    console.log('\n✅ Data Completeness:');
    console.log('   Total Cruises:', s.total);
    console.log('   With Complete JSON:', s.with_json, `(${(s.with_json/s.total*100).toFixed(1)}%)`);
    console.log('   With Ports Data:', s.with_ports, `(${(s.with_ports/s.total*100).toFixed(1)}%)`);
    console.log('   With Regions Data:', s.with_regions, `(${(s.with_regions/s.total*100).toFixed(1)}%)`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

verify();
VERIFY_SCRIPT

echo ""
echo "✅ Verification complete!"
