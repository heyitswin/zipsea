const { Client } = require('pg');

async function sampleDatabase() {
  const client = new Client({
    connectionString: 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000
  });

  try {
    console.log('📊 DATABASE SAMPLE DATA - 20 ROWS PER TABLE\n');
    console.log('=' .repeat(120));
    await client.connect();

    // Define the most important tables to sample
    const tablesToSample = [
      'cruises',
      'cruise_lines',
      'ships',
      'ports',
      'regions',
      'cheapest_pricing',
      'cruise_itinerary',
      'quote_requests',
      'users',
      'webhook_events',
      'system_flags'
    ];

    for (const tableName of tablesToSample) {
      console.log(`\n\n🚢 TABLE: ${tableName.toUpperCase()}`);
      console.log('=' .repeat(120));

      try {
        // Get row count
        const countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;
        const countResult = await client.query(countQuery);
        const rowCount = parseInt(countResult.rows[0].count);
        console.log(`Total rows in table: ${rowCount.toLocaleString()}\n`);

        if (rowCount === 0) {
          console.log('  ⚠️  Table is empty - no data to show\n');
          continue;
        }

        // Get sample data based on table
        let sampleQuery;

        switch(tableName) {
          case 'cruises':
            // Get upcoming cruises
            sampleQuery = `
              SELECT
                id,
                name,
                cruise_line_id,
                ship_id,
                sailing_date,
                nights,
                embarkation_port_id,
                disembarkation_port_id,
                interior_price,
                oceanview_price,
                balcony_price,
                suite_price,
                is_active
              FROM cruises
              WHERE sailing_date >= CURRENT_DATE
              ORDER BY sailing_date
              LIMIT 20
            `;
            break;

          case 'cruise_lines':
            sampleQuery = `
              SELECT
                id,
                name,
                code,
                engine_name,
                short_name
              FROM cruise_lines
              WHERE is_active = true OR is_active IS NULL
              ORDER BY name
              LIMIT 20
            `;
            break;

          case 'ships':
            sampleQuery = `
              SELECT
                id,
                name,
                cruise_line_id,
                capacity,
                built_year,
                gross_tonnage
              FROM ships
              ORDER BY name
              LIMIT 20
            `;
            break;

          case 'ports':
            sampleQuery = `
              SELECT
                id,
                name,
                code,
                country,
                region
              FROM ports
              WHERE name IS NOT NULL
              ORDER BY name
              LIMIT 20
            `;
            break;

          case 'regions':
            sampleQuery = `
              SELECT
                id,
                name,
                code
              FROM regions
              ORDER BY name
              LIMIT 20
            `;
            break;

          case 'cheapest_pricing':
            sampleQuery = `
              SELECT
                cruise_id,
                cheapest_price,
                interior_price,
                oceanview_price,
                balcony_price,
                suite_price,
                calculated_at
              FROM cheapest_pricing
              WHERE cheapest_price IS NOT NULL OR interior_price IS NOT NULL
              ORDER BY calculated_at DESC NULLS LAST
              LIMIT 20
            `;
            break;

          case 'cruise_itinerary':
            sampleQuery = `
              SELECT
                cruise_id,
                day_number,
                port_name,
                arrive_date,
                depart_date,
                arrive_time,
                depart_time
              FROM cruise_itinerary
              ORDER BY cruise_id, day_number
              LIMIT 20
            `;
            break;

          case 'quote_requests':
            sampleQuery = `
              SELECT
                id,
                cruise_id,
                first_name,
                last_name,
                email,
                status,
                created_at
              FROM quote_requests
              ORDER BY created_at DESC
              LIMIT 20
            `;
            break;

          case 'webhook_events':
            sampleQuery = `
              SELECT
                id,
                event_type,
                cruise_line_id,
                status,
                created_at
              FROM webhook_events
              ORDER BY created_at DESC
              LIMIT 20
            `;
            break;

          case 'system_flags':
            sampleQuery = `
              SELECT
                flag_name,
                flag_value,
                description
              FROM system_flags
              LIMIT 20
            `;
            break;

          default:
            sampleQuery = `SELECT * FROM "${tableName}" LIMIT 20`;
        }

        const sampleResult = await client.query(sampleQuery);

        if (sampleResult.rows.length === 0) {
          console.log('  No data matching criteria\n');
          continue;
        }

        // Print column headers
        const columns = Object.keys(sampleResult.rows[0]);
        console.log('Sample Data:');
        console.log('-'.repeat(120));

        // Format as a table
        const columnWidths = {};
        columns.forEach(col => {
          // Calculate max width for each column
          let maxWidth = col.length;
          sampleResult.rows.forEach(row => {
            const val = formatValue(row[col]);
            if (val.length > maxWidth) maxWidth = val.length;
          });
          columnWidths[col] = Math.min(maxWidth, 30); // Cap at 30 chars
        });

        // Print headers
        let headerLine = '';
        columns.forEach(col => {
          headerLine += col.substring(0, columnWidths[col]).padEnd(columnWidths[col] + 2);
        });
        console.log(headerLine);
        console.log('-'.repeat(headerLine.length));

        // Print rows
        sampleResult.rows.forEach((row, idx) => {
          let rowLine = '';
          columns.forEach(col => {
            const val = formatValue(row[col]);
            rowLine += val.substring(0, columnWidths[col]).padEnd(columnWidths[col] + 2);
          });
          console.log(rowLine);

          // Add separator after every 5 rows for readability
          if ((idx + 1) % 5 === 0 && idx < sampleResult.rows.length - 1) {
            console.log('');
          }
        });

      } catch (err) {
        console.log(`  ❌ Error sampling table: ${err.message}`);
      }
    }

    console.log('\n\n' + '=' .repeat(120));
    console.log('📋 TABLE RELATIONSHIPS SUMMARY\n');
    console.log(`
MAIN RELATIONSHIPS:
-------------------
• cruises.cruise_line_id → cruise_lines.id (which company operates the cruise)
• cruises.ship_id → ships.id (which vessel is used)
• cruises.embarkation_port_id → ports.id (where you board)
• cruises.disembarkation_port_id → ports.id (where you leave)
• cruise_itinerary.cruise_id → cruises.id (day-by-day journey)
• cruise_itinerary.port_id → ports.id (which port on each day)
• cheapest_pricing.cruise_id → cruises.id (cached lowest prices)
• quote_requests.cruise_id → cruises.id (customer inquiries)
• ships.cruise_line_id → cruise_lines.id (which line owns the ship)

PRICING STRUCTURE:
------------------
• Each cruise has 4 cabin types: interior, oceanview, balcony, suite
• Prices are stored directly on cruises table for quick access
• cheapest_pricing table caches the lowest available price
• Prices in USD, stored as NUMERIC type

DATA FLOW:
----------
1. Traveltek sends data → webhook_events
2. Webhook processor updates → cruises, ships, ports
3. Price changes tracked → cheapest_pricing
4. Customers inquire → quote_requests
    `);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed.');
  }
}

function formatValue(value) {
  if (value === null) return 'NULL';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (value > 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value > 1000) return value.toLocaleString();
    return value.toString();
  }
  if (typeof value === 'object') return JSON.stringify(value).substring(0, 30);
  return value.toString();
}

sampleDatabase();
