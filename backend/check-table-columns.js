const { Client } = require('pg');

async function checkTableColumns() {
  const client = new Client({
    connectionString: 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000
  });

  try {
    await client.connect();

    const tables = ['ships', 'cheapest_pricing', 'webhook_events', 'system_flags'];

    for (const table of tables) {
      console.log(`\n📊 ${table.toUpperCase()} - Actual Columns:`);
      console.log('=' .repeat(80));

      const query = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `;

      const result = await client.query(query, [table]);
      result.rows.forEach(row => {
        console.log(`  ${row.column_name.padEnd(30)} ${row.data_type}`);
      });

      // Now get sample data with actual columns
      console.log(`\nSample data (5 rows):`);
      console.log('-'.repeat(80));

      const sampleQuery = `SELECT * FROM ${table} LIMIT 5`;
      const sampleResult = await client.query(sampleQuery);

      if (sampleResult.rows.length > 0) {
        // Show first 5 columns of each row
        const columns = Object.keys(sampleResult.rows[0]).slice(0, 6);

        // Header
        console.log(columns.map(c => c.substring(0, 15).padEnd(15)).join(' | '));
        console.log('-'.repeat(80));

        // Rows
        sampleResult.rows.forEach(row => {
          const values = columns.map(col => {
            let val = row[col];
            if (val === null) return 'NULL'.padEnd(15);
            if (val === true) return 'true'.padEnd(15);
            if (val === false) return 'false'.padEnd(15);
            if (val instanceof Date) return val.toISOString().split('T')[0].padEnd(15);
            return val.toString().substring(0, 15).padEnd(15);
          });
          console.log(values.join(' | '));
        });
      } else {
        console.log('(No data in table)');
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTableColumns();
