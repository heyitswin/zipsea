const { Client } = require('pg');

async function findCabinImages() {
  const client = new Client({
    connectionString: 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000
  });

  try {
    console.log('🔍 SEARCHING FOR CABIN IMAGE URLS IN DATABASE\n');
    console.log('=' .repeat(100));
    await client.connect();

    // Get all tables
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const tables = await client.query(tablesQuery);

    for (const table of tables.rows) {
      const tableName = table.table_name;

      // Get columns that might contain image URLs
      const columnsQuery = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = $1
        AND (
          column_name LIKE '%image%' OR
          column_name LIKE '%photo%' OR
          column_name LIKE '%pic%' OR
          column_name LIKE '%url%' OR
          column_name LIKE '%cabin%' OR
          data_type IN ('text', 'character varying', 'jsonb', 'json')
        )
        ORDER BY ordinal_position;
      `;

      const columns = await client.query(columnsQuery, [tableName]);

      if (columns.rows.length > 0) {
        // Check if this table has cabin-related image data
        for (const col of columns.rows) {
          try {
            let sampleQuery;

            if (col.data_type === 'jsonb' || col.data_type === 'json') {
              // For JSON columns, check if they contain image URLs
              sampleQuery = `
                SELECT ${col.column_name}
                FROM ${tableName}
                WHERE ${col.column_name}::text LIKE '%jpg%'
                   OR ${col.column_name}::text LIKE '%png%'
                   OR ${col.column_name}::text LIKE '%image%'
                   OR ${col.column_name}::text LIKE '%cabin%'
                LIMIT 3
              `;
            } else {
              // For text columns
              sampleQuery = `
                SELECT ${col.column_name}
                FROM ${tableName}
                WHERE ${col.column_name} IS NOT NULL
                  AND (
                    ${col.column_name} LIKE '%.jpg%'
                    OR ${col.column_name} LIKE '%.png%'
                    OR ${col.column_name} LIKE '%http%'
                    OR ${col.column_name} LIKE '%cabin%'
                  )
                LIMIT 3
              `;
            }

            const samples = await client.query(sampleQuery);

            if (samples.rows.length > 0) {
              console.log(`\n📊 TABLE: ${tableName.toUpperCase()}`);
              console.log(`   COLUMN: ${col.column_name} (${col.data_type})`);
              console.log('   ' + '-'.repeat(80));

              samples.rows.forEach((row, idx) => {
                const value = row[col.column_name];
                if (value) {
                  if (typeof value === 'object') {
                    // For JSON, pretty print
                    const str = JSON.stringify(value, null, 2);
                    // Check if it contains cabin images
                    if (str.includes('cabin') || str.includes('.jpg') || str.includes('.png')) {
                      console.log(`   Sample ${idx + 1}:`);
                      // Extract just the image URLs if possible
                      const matches = str.match(/https?:\/\/[^\s"]+\.(jpg|png|jpeg|gif|webp)/gi);
                      if (matches) {
                        console.log('   Found image URLs:');
                        matches.slice(0, 3).forEach(url => {
                          console.log(`     - ${url}`);
                        });
                      } else {
                        console.log(`     ${str.substring(0, 200)}...`);
                      }
                    }
                  } else {
                    console.log(`   Sample ${idx + 1}: ${value.substring(0, 150)}`);
                  }
                }
              });
            }
          } catch (err) {
            // Ignore query errors for individual columns
          }
        }
      }
    }

    // Specifically check cabin-related tables
    console.log('\n\n🏠 CHECKING CABIN-SPECIFIC TABLES\n');
    console.log('=' .repeat(100));

    const cabinTables = [
      'cabin_categories',
      'cabin_types',
      'cabin_deck_locations',
      'cached_prices',
      'cruises'
    ];

    for (const tableName of cabinTables) {
      try {
        // Get all columns for cabin tables
        const allColsQuery = `
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position;
        `;

        const allCols = await client.query(allColsQuery, [tableName]);

        console.log(`\n📁 ${tableName.toUpperCase()}`);
        console.log('   Columns: ' + allCols.rows.map(r => r.column_name).join(', '));

        // Get sample data
        const sampleQuery = `SELECT * FROM ${tableName} LIMIT 2`;
        const samples = await client.query(sampleQuery);

        if (samples.rows.length > 0) {
          console.log(`   Sample data (${samples.rows.length} rows):`);
          samples.rows.forEach((row, idx) => {
            console.log(`\n   Row ${idx + 1}:`);
            Object.keys(row).forEach(key => {
              const val = row[key];
              if (val && (
                (typeof val === 'string' && (val.includes('.jpg') || val.includes('.png') || val.includes('http'))) ||
                (key.includes('image') || key.includes('url') || key.includes('photo'))
              )) {
                console.log(`     ${key}: ${val}`);
              }
            });
          });
        } else {
          console.log('   (No data in table)');
        }
      } catch (err) {
        console.log(`   Error checking table: ${err.message}`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
    console.log('\n✅ Search complete.');
  }
}

findCabinImages();
