const { Client } = require('pg');

async function checkLine14Updates() {
  const dbUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
  const client = new Client({
    connectionString: dbUrl,
    ssl: dbUrl && dbUrl.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // 1. Check recent cruises for line 14
    console.log('=== Recent Cruises for Line 14 ===');
    const cruisesResult = await client.query(`
      SELECT
        id,
        cruise_id,
        name,
        ship_id,
        created_at,
        updated_at,
        CASE
          WHEN updated_at > created_at THEN 'YES'
          ELSE 'NO'
        END as was_updated,
        EXTRACT(EPOCH FROM (updated_at - created_at)) as seconds_between_create_update
      FROM cruises
      WHERE line_id = 14
      ORDER BY updated_at DESC
      LIMIT 10
    `);

    console.log(`Found ${cruisesResult.rowCount} cruises for line 14`);
    cruisesResult.rows.forEach(row => {
      console.log(`- Cruise ${row.cruise_id}: ${row.name}`);
      console.log(`  Created: ${row.created_at}`);
      console.log(`  Updated: ${row.updated_at}`);
      console.log(`  Was Updated: ${row.was_updated}`);
      if (row.seconds_between_create_update > 0) {
        console.log(`  Time between: ${Math.round(row.seconds_between_create_update)} seconds`);
      }
      console.log('');
    });

    // 2. Check pricing snapshots for line 14
    console.log('\n=== Recent Pricing Snapshots for Line 14 ===');
    const pricingResult = await client.query(`
      SELECT
        ps.id,
        ps.cruise_id,
        c.cruise_id as cruise_code,
        c.name as cruise_name,
        ps.snapshot_date,
        ps.created_at,
        COUNT(DISTINCT ps.cabin_type) as cabin_types_count,
        MIN(ps.price) as min_price,
        MAX(ps.price) as max_price
      FROM pricing_snapshots ps
      JOIN cruises c ON ps.cruise_id = c.id
      WHERE c.line_id = 14
      GROUP BY ps.id, ps.cruise_id, c.cruise_id, c.name, ps.snapshot_date, ps.created_at
      ORDER BY ps.created_at DESC
      LIMIT 10
    `);

    console.log(`Found ${pricingResult.rowCount} recent pricing snapshots`);
    pricingResult.rows.forEach(row => {
      console.log(`- Snapshot for ${row.cruise_code}: ${row.cruise_name}`);
      console.log(`  Created: ${row.created_at}`);
      console.log(`  Snapshot Date: ${row.snapshot_date}`);
      console.log(`  Cabin Types: ${row.cabin_types_count}`);
      console.log(`  Price Range: $${row.min_price} - $${row.max_price}`);
      console.log('');
    });

    // 3. Check pricing snapshots created in last hour
    console.log('\n=== Pricing Snapshots Created in Last Hour ===');
    const recentPricingResult = await client.query(`
      SELECT
        c.line_id,
        COUNT(DISTINCT ps.id) as snapshot_count,
        COUNT(DISTINCT ps.cruise_id) as unique_cruises,
        MIN(ps.created_at) as oldest,
        MAX(ps.created_at) as newest
      FROM pricing_snapshots ps
      JOIN cruises c ON ps.cruise_id = c.id
      WHERE ps.created_at > NOW() - INTERVAL '1 hour'
        AND c.line_id = 14
      GROUP BY c.line_id
    `);

    if (recentPricingResult.rowCount > 0) {
      const row = recentPricingResult.rows[0];
      console.log(`Line 14 snapshots in last hour:`);
      console.log(`  Total Snapshots: ${row.snapshot_count}`);
      console.log(`  Unique Cruises: ${row.unique_cruises}`);
      console.log(`  Oldest: ${row.oldest}`);
      console.log(`  Newest: ${row.newest}`);
    } else {
      console.log('No pricing snapshots created in the last hour for line 14');
    }

    // 4. Check webhook events for line 14
    console.log('\n\n=== Recent Webhook Events for Line 14 ===');
    const webhookResult = await client.query(`
      SELECT
        id,
        webhook_type,
        status,
        received_at,
        processed_at,
        error_message,
        EXTRACT(EPOCH FROM (processed_at - received_at)) as processing_time_seconds
      FROM webhook_events
      WHERE line_id = 14
      ORDER BY received_at DESC
      LIMIT 5
    `);

    webhookResult.rows.forEach(row => {
      console.log(`- Webhook ${row.id}: ${row.webhook_type}`);
      console.log(`  Status: ${row.status}`);
      console.log(`  Received: ${row.received_at}`);
      console.log(`  Processed: ${row.processed_at || 'Not processed'}`);
      if (row.processing_time_seconds) {
        console.log(`  Processing Time: ${Math.round(row.processing_time_seconds)} seconds`);
      }
      if (row.error_message) {
        console.log(`  Error: ${row.error_message}`);
      }
      console.log('');
    });

    // 5. Check if any cruises were updated today
    console.log('\n=== Cruises Updated Today ===');
    const todayResult = await client.query(`
      SELECT
        line_id,
        COUNT(*) as cruises_updated_today
      FROM cruises
      WHERE line_id = 14
        AND updated_at::date = CURRENT_DATE
        AND updated_at > created_at
      GROUP BY line_id
    `);

    if (todayResult.rowCount > 0) {
      console.log(`Line 14: ${todayResult.rows[0].cruises_updated_today} cruises updated today`);
    } else {
      console.log('No cruises updated today for line 14');
    }

    // 6. Check last successful file processing
    console.log('\n=== Last Successful File Processing ===');
    const fileResult = await client.query(`
      SELECT
        file_path,
        status,
        processed_at,
        records_processed,
        error_message
      FROM file_processing_log
      WHERE file_path LIKE '%line_14_%'
        OR file_path LIKE '%/14/%'
      ORDER BY processed_at DESC
      LIMIT 5
    `);

    if (fileResult.rowCount > 0) {
      fileResult.rows.forEach(row => {
        console.log(`- File: ${row.file_path}`);
        console.log(`  Status: ${row.status}`);
        console.log(`  Processed: ${row.processed_at}`);
        console.log(`  Records: ${row.records_processed || 'N/A'}`);
        if (row.error_message) {
          console.log(`  Error: ${row.error_message}`);
        }
        console.log('');
      });
    } else {
      console.log('No file processing logs found for line 14');
    }
  } catch (error) {
    console.error('Error checking updates:', error);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

// Run the check
checkLine14Updates();
