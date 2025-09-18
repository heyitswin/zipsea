require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

async function createIndexes() {
  console.log('Creating indexes for search optimization...\n');

  const indexes = [
    // Composite index for the main search query
    {
      name: 'idx_cruises_search_comprehensive',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cruises_search_comprehensive
            ON cruises (is_active, cruise_line_id, sailing_date, cheapest_price)
            WHERE is_active = true AND cheapest_price IS NOT NULL`,
      description: 'Comprehensive search optimization'
    },

    // Individual indexes for flexibility
    {
      name: 'idx_cruises_sailing_date',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cruises_sailing_date
            ON cruises (sailing_date)
            WHERE is_active = true`,
      description: 'Date range queries'
    },

    {
      name: 'idx_cruises_cruise_line_active',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cruises_cruise_line_active
            ON cruises (cruise_line_id)
            WHERE is_active = true`,
      description: 'Cruise line filtering'
    },

    {
      name: 'idx_cruises_cheapest_price_not_null',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cruises_cheapest_price_not_null
            ON cruises (cheapest_price)
            WHERE cheapest_price IS NOT NULL AND cheapest_price > 99`,
      description: 'Price filtering'
    },

    // Foreign key indexes
    {
      name: 'idx_cruises_ship_id',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cruises_ship_id
            ON cruises (ship_id)`,
      description: 'Ship joins'
    },

    {
      name: 'idx_cruises_embark_port_id',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cruises_embark_port_id
            ON cruises (embark_port_id)`,
      description: 'Embark port joins'
    },

    {
      name: 'idx_cruises_disembark_port_id',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cruises_disembark_port_id
            ON cruises (disembark_port_id)`,
      description: 'Disembark port joins'
    }
  ];

  for (const index of indexes) {
    console.log(`Creating index: ${index.name}`);
    console.log(`Purpose: ${index.description}`);

    try {
      console.time(index.name);
      await pool.query(index.sql);
      console.timeEnd(index.name);
      console.log(`✅ Index ${index.name} created successfully\n`);
    } catch (error) {
      console.timeEnd(index.name);
      if (error.message.includes('already exists')) {
        console.log(`ℹ️ Index ${index.name} already exists\n`);
      } else {
        console.error(`❌ Failed to create index ${index.name}:`, error.message, '\n');
      }
    }
  }

  // Analyze tables to update statistics
  console.log('Analyzing tables to update statistics...');
  try {
    await pool.query('ANALYZE cruises');
    await pool.query('ANALYZE cruise_lines');
    await pool.query('ANALYZE ships');
    await pool.query('ANALYZE ports');
    console.log('✅ Tables analyzed successfully\n');
  } catch (error) {
    console.error('❌ Failed to analyze tables:', error.message, '\n');
  }

  // Test the optimized query
  console.log('Testing optimized query performance...\n');

  const testQuery = `
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT
      c.id, c.name, c.sailing_date, c.cheapest_price
    FROM cruises c
    LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
    LEFT JOIN ships s ON c.ship_id = s.id
    LEFT JOIN ports p1 ON c.embark_port_id = p1.id
    LEFT JOIN ports p2 ON c.disembark_port_id = p2.id
    WHERE c.is_active = true
      AND c.sailing_date >= '2025-12-01'
      AND c.sailing_date <= '2025-12-31'
      AND c.cruise_line_id = 17
      AND c.cheapest_price IS NOT NULL
      AND c.cheapest_price > 99
    ORDER BY c.sailing_date ASC
    LIMIT 5
  `;

  try {
    console.time('queryPlan');
    const result = await pool.query(testQuery);
    console.timeEnd('queryPlan');

    // Extract execution time from the query plan
    const plan = result.rows.map(row => row['QUERY PLAN']).join('\n');
    const executionTime = plan.match(/Execution Time: ([\d.]+) ms/);

    if (executionTime) {
      console.log(`✅ Query execution time: ${executionTime[1]} ms\n`);
    }

    console.log('Query plan excerpt:');
    console.log(plan.split('\n').slice(0, 5).join('\n'));
  } catch (error) {
    console.error('Failed to analyze query:', error.message);
  }

  await pool.end();
  console.log('\n✅ Index creation complete!');
}

createIndexes().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
