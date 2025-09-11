const { sql } = require('./dist/db/connection');

async function sampleTables() {
  try {
    console.log('📊 DATABASE SCHEMA OVERVIEW\n');
    console.log('=' .repeat(80));

    // Get list of all tables
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    console.log(`\nFound ${tables.length} tables:\n`);

    // Define what each table is for
    const tableInfo = {
      'cruises': {
        purpose: 'Main cruise inventory - all available cruises with dates, prices, itineraries',
        key_fields: ['id', 'name', 'sailing_date', 'nights', 'cruise_line_id', 'ship_id', 'embarkation_port_id'],
        relationships: 'Links to cruise_lines, ships, ports'
      },
      'cruise_lines': {
        purpose: 'Cruise line companies (Royal Caribbean, Carnival, MSC, etc.)',
        key_fields: ['id', 'name', 'code'],
        relationships: 'Parent to cruises'
      },
      'ships': {
        purpose: 'Individual cruise ships with specs and details',
        key_fields: ['id', 'name', 'cruise_line_id', 'capacity', 'built_year'],
        relationships: 'Belongs to cruise_lines, referenced by cruises'
      },
      'ports': {
        purpose: 'Embarkation and disembarkation ports',
        key_fields: ['id', 'name', 'code', 'country', 'state'],
        relationships: 'Referenced by cruises for embark/disembark'
      },
      'regions': {
        purpose: 'Geographic regions (Caribbean, Mediterranean, Alaska, etc.)',
        key_fields: ['id', 'name'],
        relationships: 'Referenced by cruises via region_ids'
      },
      'quote_requests': {
        purpose: 'Customer quote/booking requests',
        key_fields: ['id', 'cruise_id', 'status', 'created_at'],
        relationships: 'Links to cruises'
      },
      'users': {
        purpose: 'User accounts (Clerk auth integration)',
        key_fields: ['id', 'email', 'clerk_id', 'role'],
        relationships: 'Parent to quote_requests, saved_searches'
      },
      'price_history': {
        purpose: 'Historical pricing for trend analysis',
        key_fields: ['cruise_id', 'price', 'recorded_at'],
        relationships: 'Links to cruises'
      },
      'cheapest_pricing': {
        purpose: 'Cached cheapest prices for quick lookups',
        key_fields: ['cruise_id', 'cabin_type', 'price'],
        relationships: 'Links to cruises'
      },
      'webhook_events': {
        purpose: 'Traveltek webhook event log',
        key_fields: ['id', 'event_type', 'payload', 'created_at'],
        relationships: 'Triggers cruise updates'
      },
      'sync_locks': {
        purpose: 'Prevent concurrent sync operations',
        key_fields: ['cruise_line_id', 'status', 'locked_at'],
        relationships: 'Links to cruise_lines'
      },
      'system_flags': {
        purpose: 'Feature flags and system settings',
        key_fields: ['flag_name', 'flag_value'],
        relationships: 'None - system config'
      }
    };

    // Process each table
    for (const table of tables) {
      const tableName = table.table_name;
      const info = tableInfo[tableName] || { purpose: 'Unknown/Auxiliary table', key_fields: [], relationships: 'Unknown' };

      console.log(`\n📁 ${tableName.toUpperCase()}`);
      console.log('-'.repeat(80));
      console.log(`Purpose: ${info.purpose}`);
      console.log(`Key Fields: ${info.key_fields.join(', ') || 'Various'}`);
      console.log(`Relationships: ${info.relationships}`);

      try {
        // Get row count
        const count = await sql`SELECT COUNT(*) as count FROM ${sql(tableName)}`;
        console.log(`Total Rows: ${count[0].count}`);

        // Get sample data
        if (count[0].count > 0) {
          console.log('\nSample Data (3 rows):');
          const sample = await sql`
            SELECT * FROM ${sql(tableName)}
            LIMIT 3
          `;

          sample.forEach((row, idx) => {
            console.log(`\n  Row ${idx + 1}:`);
            const keys = Object.keys(row).slice(0, 5); // Show first 5 fields
            keys.forEach(key => {
              let value = row[key];
              if (value === null) value = 'NULL';
              else if (typeof value === 'object') value = JSON.stringify(value).substring(0, 50);
              else if (typeof value === 'string' && value.length > 50) value = value.substring(0, 50) + '...';
              console.log(`    ${key}: ${value}`);
            });
            if (Object.keys(row).length > 5) {
              console.log(`    ... and ${Object.keys(row).length - 5} more fields`);
            }
          });
        } else {
          console.log('  (Empty table)');
        }
      } catch (err) {
        console.log(`  Error sampling: ${err.message}`);
      }
    }

    console.log('\n\n📋 KEY RELATIONSHIPS:\n');
    console.log('1. CRUISE BOOKING FLOW:');
    console.log('   cruises → cruise_lines (which company)');
    console.log('   cruises → ships (which vessel)');
    console.log('   cruises → ports (where it departs/arrives)');
    console.log('   cruises → regions (where it goes)');
    console.log('   cruises → quote_requests (customer inquiries)');
    console.log('\n2. PRICING:');
    console.log('   cruises → price_history (track changes)');
    console.log('   cruises → cheapest_pricing (quick lookups)');
    console.log('\n3. DATA SYNC:');
    console.log('   webhook_events → triggers updates');
    console.log('   sync_locks → prevents conflicts');
    console.log('   system_flags → controls features');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

sampleTables();
