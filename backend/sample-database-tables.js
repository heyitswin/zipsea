const { Client } = require('pg');
require('dotenv').config();

async function sampleDatabaseTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
  });

  try {
    console.log('Connecting to database...\n');
    await client.connect();

    // First, get all tables in the database
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const tablesResult = await client.query(tablesQuery);
    console.log(`Found ${tablesResult.rows.length} tables in the database\n`);
    console.log('=' .repeat(80));

    // For each table, get schema info and sample data
    for (const tableRow of tablesResult.rows) {
      const tableName = tableRow.table_name;

      console.log(`\n📊 TABLE: ${tableName}`);
      console.log('=' .repeat(80));

      // Get row count
      const countQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
      const countResult = await client.query(countQuery);
      const rowCount = countResult.rows[0].count;
      console.log(`Total rows: ${rowCount}\n`);

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
        ORDER BY ordinal_position;
      `;

      const schemaResult = await client.query(schemaQuery, [tableName]);

      console.log('COLUMNS:');
      console.log('-'.repeat(80));
      schemaResult.rows.forEach(col => {
        let typeStr = col.data_type;
        if (col.character_maximum_length) {
          typeStr += `(${col.character_maximum_length})`;
        }
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default.substring(0, 30)}` : '';
        console.log(`  ${col.column_name.padEnd(30)} ${typeStr.padEnd(20)} ${nullable}${defaultVal}`);
      });

      // Get sample data (up to 20 rows)
      if (rowCount > 0) {
        console.log('\nSAMPLE DATA (up to 20 rows):');
        console.log('-'.repeat(80));

        // For large tables, sample randomly; for small tables, take first 20
        let sampleQuery;
        if (rowCount > 100) {
          // Random sample for large tables
          sampleQuery = `
            SELECT * FROM ${tableName}
            TABLESAMPLE SYSTEM (20)
            LIMIT 20;
          `;
        } else {
          // Just take first 20 for small tables
          sampleQuery = `SELECT * FROM ${tableName} LIMIT 20;`;
        }

        try {
          const sampleResult = await client.query(sampleQuery);

          if (sampleResult.rows.length > 0) {
            // For better readability, show each row as JSON
            sampleResult.rows.forEach((row, index) => {
              console.log(`\nRow ${index + 1}:`);
              // Show only first few fields for each row to keep it readable
              const keys = Object.keys(row);
              const displayKeys = keys.slice(0, 8); // Show first 8 fields

              displayKeys.forEach(key => {
                let value = row[key];
                if (value === null) {
                  value = 'NULL';
                } else if (typeof value === 'object') {
                  value = JSON.stringify(value).substring(0, 100);
                } else if (typeof value === 'string' && value.length > 100) {
                  value = value.substring(0, 100) + '...';
                }
                console.log(`  ${key}: ${value}`);
              });

              if (keys.length > displayKeys.length) {
                console.log(`  ... and ${keys.length - displayKeys.length} more fields`);
              }
            });
          }
        } catch (sampleError) {
          console.log(`  Error sampling data: ${sampleError.message}`);
        }
      } else {
        console.log('\n  (Table is empty)');
      }

      console.log('\n' + '=' .repeat(80));
    }

    // Now let's document what each table is for based on the schema
    console.log('\n\n📚 TABLE DOCUMENTATION');
    console.log('=' .repeat(80));

    const tableDescriptions = {
      'cruises': 'Main cruise inventory table - stores all cruise offerings with dates, prices, ships, and routes',
      'cruise_lines': 'Cruise line companies (e.g., Royal Caribbean, Carnival, MSC)',
      'ships': 'Individual cruise ships with specifications and details',
      'ports': 'Ports of call where ships embark/disembark',
      'regions': 'Geographic regions for cruise destinations (Caribbean, Mediterranean, etc.)',
      'cheapest_pricing': 'Cached cheapest price data for quick lookups',
      'quote_requests': 'Customer quote requests for cruise bookings',
      'users': 'User accounts (integrated with Clerk authentication)',
      'saved_searches': 'User saved search preferences',
      'user_preferences': 'User settings and preferences',
      'price_history': 'Historical pricing data for trend analysis',
      'pricing_updates': 'Track when prices were last updated',
      'sync_locks': 'Prevent concurrent data sync operations',
      'system_flags': 'System-wide feature flags and settings',
      'webhook_events': 'Log of incoming webhook events from Traveltek',
      'cron_jobs': 'Scheduled job configurations',
      'cron_job_logs': 'Execution history of cron jobs'
    };

    for (const [table, description] of Object.entries(tableDescriptions)) {
      console.log(`\n${table}:`);
      console.log(`  ${description}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  } finally {
    await client.end();
  }
}

sampleDatabaseTables();
