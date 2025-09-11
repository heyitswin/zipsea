const { Client } = require('pg');

async function sampleDatabase() {
  const client = new Client({
    connectionString:
      'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000,
  });

  try {
    console.log('Connecting to production database...\n');
    await client.connect();

    // Get all tables
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const tablesResult = await client.query(tablesQuery);
    console.log(`Found ${tablesResult.rows.length} tables in the database\n`);
    console.log('='.repeat(100));

    // Sample each table
    for (const tableRow of tablesResult.rows) {
      const tableName = tableRow.table_name;

      console.log(`\n📊 TABLE: ${tableName}`);
      console.log('='.repeat(100));

      // Get row count
      try {
        const countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;
        const countResult = await client.query(countQuery);
        const rowCount = parseInt(countResult.rows[0].count);
        console.log(`Total rows: ${rowCount.toLocaleString()}\n`);

        // Get column information
        const schemaQuery = `
          SELECT
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
          LIMIT 15;
        `;

        const schemaResult = await client.query(schemaQuery, [tableName]);

        console.log('COLUMNS (first 15):');
        console.log('-'.repeat(100));
        schemaResult.rows.forEach(col => {
          let typeStr = col.data_type;
          if (col.character_maximum_length) {
            typeStr += `(${col.character_maximum_length})`;
          }
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          console.log(`  ${col.column_name.padEnd(35)} ${typeStr.padEnd(25)} ${nullable}`);
        });

        // Get sample data
        if (rowCount > 0) {
          console.log('\nSAMPLE DATA (5 rows):');
          console.log('-'.repeat(100));

          let sampleQuery;
          if (tableName === 'cruises') {
            // For cruises, get recent ones
            sampleQuery = `SELECT * FROM "${tableName}" WHERE sailing_date >= CURRENT_DATE ORDER BY sailing_date LIMIT 5`;
          } else if (rowCount > 1000) {
            // For large tables, get random sample
            sampleQuery = `SELECT * FROM "${tableName}" ORDER BY RANDOM() LIMIT 5`;
          } else {
            // For small tables, just get first 5
            sampleQuery = `SELECT * FROM "${tableName}" LIMIT 5`;
          }

          const sampleResult = await client.query(sampleQuery);

          if (sampleResult.rows.length > 0) {
            sampleResult.rows.forEach((row, index) => {
              console.log(`\n  Row ${index + 1}:`);
              const keys = Object.keys(row);
              const displayKeys = keys.slice(0, 6); // Show first 6 fields

              displayKeys.forEach(key => {
                let value = row[key];
                if (value === null) {
                  value = 'NULL';
                } else if (value instanceof Date) {
                  value = value.toISOString().split('T')[0];
                } else if (typeof value === 'object') {
                  value = JSON.stringify(value).substring(0, 60) + '...';
                } else if (typeof value === 'string' && value.length > 60) {
                  value = value.substring(0, 60) + '...';
                }
                console.log(`    ${key.padEnd(30)}: ${value}`);
              });

              if (keys.length > displayKeys.length) {
                console.log(`    ... and ${keys.length - displayKeys.length} more fields`);
              }
            });
          }
        } else {
          console.log('\n  (Table is empty)');
        }
      } catch (err) {
        console.log(`  Error sampling table: ${err.message}`);
      }
    }

    // Table documentation
    console.log('\n\n📚 TABLE DOCUMENTATION & PURPOSE');
    console.log('='.repeat(100));

    const tableDescriptions = {
      cruises: {
        purpose: 'Main cruise inventory table - stores all cruise offerings',
        details:
          'Contains cruise names, dates, prices, itineraries, ships, ports, and all booking details',
        key_relationships: 'Links to cruise_lines, ships, ports, regions',
      },
      cruise_lines: {
        purpose: 'Cruise line companies (e.g., Royal Caribbean, Carnival, MSC)',
        details: 'Master list of all cruise operators',
        key_relationships: 'Parent to cruises and ships',
      },
      ships: {
        purpose: 'Individual cruise vessels with specifications',
        details: 'Ship names, capacity, year built, amenities, images',
        key_relationships: 'Belongs to cruise_lines, referenced by cruises',
      },
      ports: {
        purpose: 'Embarkation and disembarkation ports',
        details: 'Port locations, codes, countries, facilities',
        key_relationships: 'Referenced by cruises for departure/arrival',
      },
      regions: {
        purpose: 'Geographic cruise regions',
        details: 'Caribbean, Mediterranean, Alaska, Europe, etc.',
        key_relationships: 'Referenced by cruises via region_ids field',
      },
      quote_requests: {
        purpose: 'Customer quote/booking requests',
        details: 'Tracks customer inquiries, contact info, cabin preferences',
        key_relationships: 'Links to cruises and users',
      },
      users: {
        purpose: 'User accounts (Clerk authentication)',
        details: 'Customer profiles, authentication, preferences',
        key_relationships: 'Parent to quote_requests, saved_searches',
      },
      saved_searches: {
        purpose: 'User saved search criteria',
        details: 'Allows users to save and re-run searches',
        key_relationships: 'Belongs to users',
      },
      user_preferences: {
        purpose: 'User settings and preferences',
        details: 'Notification settings, display preferences',
        key_relationships: 'Belongs to users',
      },
      price_history: {
        purpose: 'Historical pricing data',
        details: 'Tracks price changes over time for analysis',
        key_relationships: 'Links to cruises',
      },
      cheapest_pricing: {
        purpose: 'Cached cheapest cabin prices',
        details: 'Quick lookup for lowest available price per cruise',
        key_relationships: 'Links to cruises',
      },
      pricing_updates: {
        purpose: 'Track when prices were last updated',
        details: 'Audit trail for price synchronization',
        key_relationships: 'Links to cruises',
      },
      sync_locks: {
        purpose: 'Prevent concurrent data sync operations',
        details: 'Distributed lock mechanism for FTP/webhook sync',
        key_relationships: 'Links to cruise_lines',
      },
      system_flags: {
        purpose: 'System-wide feature flags',
        details: 'Control features, maintenance mode, sync settings',
        key_relationships: 'None - global settings',
      },
      webhook_events: {
        purpose: 'Traveltek webhook event log',
        details: 'Incoming price updates and availability changes',
        key_relationships: 'Triggers updates to cruises',
      },
      cron_jobs: {
        purpose: 'Scheduled job configurations',
        details: 'Defines recurring tasks like sync, cleanup',
        key_relationships: 'Parent to cron_job_logs',
      },
      cron_job_logs: {
        purpose: 'Execution history of cron jobs',
        details: 'Tracks success/failure of scheduled tasks',
        key_relationships: 'Belongs to cron_jobs',
      },
    };

    for (const [table, info] of Object.entries(tableDescriptions)) {
      console.log(`\n${table.toUpperCase()}:`);
      console.log(`  Purpose: ${info.purpose}`);
      console.log(`  Details: ${info.details}`);
      console.log(`  Relationships: ${info.key_relationships}`);
    }

    console.log('\n\n🔗 KEY RELATIONSHIPS DIAGRAM:');
    console.log('='.repeat(100));
    console.log(`
    CRUISE BOOKING FLOW:
    ====================
    cruise_lines (Parent Company)
         ↓
    ships (Vessels)
         ↓
    cruises (Main Inventory)
         ├── ports (embark/disembark)
         ├── regions (destinations)
         ├── cheapest_pricing (quick price lookup)
         ├── price_history (track changes)
         └── quote_requests (customer inquiries)
                  ↓
              users (customers)

    DATA SYNC FLOW:
    ===============
    Traveltek FTP/API
         ↓
    webhook_events (incoming updates)
         ↓
    sync_locks (prevent conflicts)
         ↓
    cruises (update prices/availability)
         ↓
    pricing_updates (audit trail)
    `);
  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  } finally {
    await client.end();
    console.log('\nDatabase connection closed.');
  }
}

sampleDatabase();
