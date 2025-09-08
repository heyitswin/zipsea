const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

async function diagnoseWebhookUpdates() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // 1. Check sample of cruise IDs from recent webhooks
    console.log('=== CHECKING CRUISE EXISTENCE ===\n');

    // Get some cruise IDs that would come from webhooks
    const cruiseCheckQuery = `
      SELECT
        id,
        cruise_id,
        name,
        cruise_line_id,
        ship_id,
        sailing_date,
        updated_at,
        created_at
      FROM cruises
      WHERE cruise_line_id IN (
        SELECT id FROM cruise_lines
        WHERE name IN ('Celebrity Cruises', 'Carnival Cruise Line', 'Cunard', 'CroisiEurope')
      )
      AND sailing_date >= CURRENT_DATE
      ORDER BY updated_at DESC
      LIMIT 10
    `;

    const cruises = await client.query(cruiseCheckQuery);
    console.log(`Found ${cruises.rows.length} recent cruises from webhook lines\n`);

    for (const cruise of cruises.rows.slice(0, 3)) {
      console.log(`Cruise: ${cruise.id}`);
      console.log(`  Name: ${cruise.name}`);
      console.log(`  Line ID: ${cruise.cruise_line_id}`);
      console.log(`  Ship ID: ${cruise.ship_id}`);
      console.log(`  Sailing: ${cruise.sailing_date}`);
      console.log(`  Last Updated: ${cruise.updated_at}`);
      console.log(`  Created: ${cruise.created_at}`);
      console.log('');
    }

    // 2. Check if cruise IDs match expected format
    console.log('=== CHECKING CRUISE ID FORMAT ===\n');

    const idFormatQuery = `
      SELECT
        id,
        LENGTH(id) as id_length,
        CASE
          WHEN id ~ '^[0-9]+$' THEN 'Numeric'
          WHEN id ~ '^[A-Z0-9]+$' THEN 'Alphanumeric'
          ELSE 'Other'
        END as id_format
      FROM cruises
      WHERE cruise_line_id IN (
        SELECT id FROM cruise_lines WHERE name IN ('Celebrity Cruises', 'Carnival Cruise Line')
      )
      LIMIT 10
    `;

    const idFormats = await client.query(idFormatQuery);
    console.log('Sample cruise ID formats:');
    for (const row of idFormats.rows) {
      console.log(`  ${row.id} (length: ${row.id_length}, format: ${row.id_format})`);
    }
    console.log('');

    // 3. Check if we have pricing data
    console.log('=== CHECKING PRICING DATA ===\n');

    const pricingQuery = `
      SELECT
        c.id as cruise_id,
        c.name,
        cp.cheapest_price,
        cp.interior_price,
        cp.currency,
        cp.last_updated as pricing_updated,
        COUNT(p.cruise_id) as detailed_price_count
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      LEFT JOIN pricing p ON c.id = p.cruise_id
      WHERE c.cruise_line_id IN (
        SELECT id FROM cruise_lines WHERE name IN ('Celebrity Cruises', 'Carnival Cruise Line')
      )
      AND c.sailing_date >= CURRENT_DATE
      GROUP BY c.id, c.name, cp.cheapest_price, cp.interior_price, cp.currency, cp.last_updated
      ORDER BY c.updated_at DESC
      LIMIT 10
    `;

    const pricingData = await client.query(pricingQuery);
    console.log('Pricing status for recent cruises:');
    for (const row of pricingData.rows.slice(0, 5)) {
      console.log(`  ${row.cruise_id.substring(0, 20)}...`);
      console.log(`    Name: ${row.name}`);
      console.log(`    Cheapest: ${row.cheapest_price || 'NULL'} ${row.currency || ''}`);
      console.log(`    Interior: ${row.interior_price || 'NULL'}`);
      console.log(`    Detailed prices: ${row.detailed_price_count}`);
      console.log(`    Pricing updated: ${row.pricing_updated || 'Never'}`);
      console.log('');
    }

    // 4. Check for recent updates
    console.log('=== CHECKING RECENT UPDATES ===\n');

    const recentUpdatesQuery = `
      SELECT
        DATE(updated_at) as update_date,
        COUNT(*) as cruises_updated,
        COUNT(DISTINCT cruise_line_id) as lines_updated
      FROM cruises
      WHERE updated_at >= NOW() - INTERVAL '3 days'
      GROUP BY DATE(updated_at)
      ORDER BY update_date DESC
    `;

    const recentUpdates = await client.query(recentUpdatesQuery);
    console.log('Updates in last 3 days:');
    for (const row of recentUpdates.rows) {
      console.log(`  ${row.update_date}: ${row.cruises_updated} cruises from ${row.lines_updated} lines`);
    }
    console.log('');

    // 5. Check for mismatched field data
    console.log('=== CHECKING FIELD DATA ===\n');

    const fieldCheckQuery = `
      SELECT
        COUNT(*) as total_cruises,
        COUNT(name) as has_name,
        COUNT(voyage_code) as has_voyage_code,
        COUNT(itinerary_code) as has_itinerary_code,
        COUNT(embarkation_port_id) as has_embark_port,
        COUNT(disembarkation_port_id) as has_disembark_port,
        COUNT(region_ids) as has_regions,
        COUNT(market_id) as has_market_id,
        COUNT(owner_id) as has_owner_id
      FROM cruises
      WHERE cruise_line_id IN (
        SELECT id FROM cruise_lines WHERE name IN ('Celebrity Cruises', 'Carnival Cruise Line')
      )
      AND sailing_date >= CURRENT_DATE
    `;

    const fieldData = await client.query(fieldCheckQuery);
    const fields = fieldData.rows[0];
    console.log('Field population for active cruises:');
    console.log(`  Total cruises: ${fields.total_cruises}`);
    console.log(`  Has name: ${fields.has_name} (${Math.round(fields.has_name/fields.total_cruises*100)}%)`);
    console.log(`  Has voyage_code: ${fields.has_voyage_code} (${Math.round(fields.has_voyage_code/fields.total_cruises*100)}%)`);
    console.log(`  Has itinerary_code: ${fields.has_itinerary_code} (${Math.round(fields.has_itinerary_code/fields.total_cruises*100)}%)`);
    console.log(`  Has embark_port: ${fields.has_embark_port} (${Math.round(fields.has_embark_port/fields.total_cruises*100)}%)`);
    console.log(`  Has disembark_port: ${fields.has_disembark_port} (${Math.round(fields.has_disembark_port/fields.total_cruises*100)}%)`);
    console.log(`  Has regions: ${fields.has_regions} (${Math.round(fields.has_regions/fields.total_cruises*100)}%)`);
    console.log(`  Has market_id: ${fields.has_market_id} (${Math.round(fields.has_market_id/fields.total_cruises*100)}%)`);
    console.log(`  Has owner_id: ${fields.has_owner_id} (${Math.round(fields.has_owner_id/fields.total_cruises*100)}%)`);
    console.log('');

    // 6. Check for potential ID mismatches
    console.log('=== CHECKING FOR ID PATTERN MISMATCHES ===\n');

    // Check if we're getting the wrong type of IDs
    const idPatternQuery = `
      SELECT
        cl.name as line_name,
        COUNT(DISTINCT c.id) as total_cruises,
        COUNT(DISTINCT CASE WHEN c.id ~ '^[0-9]{6,7}$' THEN c.id END) as numeric_7_digit,
        COUNT(DISTINCT CASE WHEN c.id ~ '^[A-Z0-9]{10,}$' THEN c.id END) as long_alphanumeric,
        COUNT(DISTINCT CASE WHEN c.id LIKE '%-%' THEN c.id END) as contains_dash,
        MIN(c.id) as sample_id_1,
        MAX(c.id) as sample_id_2
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE cl.name IN ('Celebrity Cruises', 'Carnival Cruise Line', 'Cunard', 'CroisiEurope')
      GROUP BY cl.name
    `;

    const idPatterns = await client.query(idPatternQuery);
    console.log('Cruise ID patterns by line:');
    for (const row of idPatterns.rows) {
      console.log(`  ${row.line_name}:`);
      console.log(`    Total: ${row.total_cruises}`);
      console.log(`    7-digit numeric: ${row.numeric_7_digit}`);
      console.log(`    Long alphanumeric: ${row.long_alphanumeric}`);
      console.log(`    Contains dash: ${row.contains_dash}`);
      console.log(`    Samples: ${row.sample_id_1}, ${row.sample_id_2}`);
      console.log('');
    }

    // 7. Check if we have any cruises that were created/updated today
    console.log('=== CHECKING TODAY\'S ACTIVITY ===\n');

    const todayQuery = `
      SELECT
        cl.name as line_name,
        COUNT(*) as count,
        MAX(c.updated_at) as last_update,
        CASE
          WHEN DATE(c.created_at) = CURRENT_DATE THEN 'created'
          WHEN DATE(c.updated_at) = CURRENT_DATE THEN 'updated'
          ELSE 'other'
        END as action
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE (DATE(c.created_at) = CURRENT_DATE OR DATE(c.updated_at) = CURRENT_DATE)
      GROUP BY cl.name, action
      ORDER BY last_update DESC
    `;

    const todayActivity = await client.query(todayQuery);
    if (todayActivity.rows.length > 0) {
      console.log('Today\'s cruise activity:');
      for (const row of todayActivity.rows) {
        console.log(`  ${row.line_name}: ${row.count} cruises ${row.action} (last: ${row.last_update})`);
      }
    } else {
      console.log('No cruises created or updated today!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    console.log('\nDisconnected from database');
  }
}

// Run diagnostics
diagnoseWebhookUpdates().catch(console.error);
