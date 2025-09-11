const { Client } = require('pg');

async function sampleMissingTables() {
  const client = new Client({
    connectionString: 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000
  });

  try {
    console.log('📊 FIXING SAMPLE DATA FOR TABLES WITH ERRORS\n');
    console.log('=' .repeat(120));
    await client.connect();

    // 1. SHIPS TABLE
    console.log('\n\n🚢 TABLE: SHIPS (with actual columns)');
    console.log('=' .repeat(120));

    const shipsCount = await client.query('SELECT COUNT(*) as count FROM ships');
    console.log(`Total rows: ${shipsCount.rows[0].count}\n`);

    const shipsQuery = `
      SELECT
        id,
        name,
        cruise_line_id,
        code,
        gross_tonnage,
        built_year,
        refurbished_year,
        max_passengers,
        crew
      FROM ships
      WHERE name IS NOT NULL
      ORDER BY name
      LIMIT 20
    `;

    const shipsResult = await client.query(shipsQuery);
    console.log('Sample Data:');
    console.log('-'.repeat(120));

    // Print headers
    console.log('ID    | Ship Name                      | Line ID | Code | Tonnage | Built | Refurb | Max Pass | Crew');
    console.log('-'.repeat(120));

    shipsResult.rows.forEach(ship => {
      console.log(
        `${(ship.id || '').toString().padEnd(5)} | ` +
        `${(ship.name || 'Unknown').substring(0, 30).padEnd(30)} | ` +
        `${(ship.cruise_line_id || '').toString().padEnd(7)} | ` +
        `${(ship.code || '').toString().padEnd(4)} | ` +
        `${(ship.gross_tonnage || '').toString().padEnd(7)} | ` +
        `${(ship.built_year || '').toString().padEnd(5)} | ` +
        `${(ship.refurbished_year || '').toString().padEnd(6)} | ` +
        `${(ship.max_passengers || '').toString().padEnd(8)} | ` +
        `${(ship.crew || '').toString()}`
      );
    });

    // 2. CHEAPEST_PRICING TABLE
    console.log('\n\n💰 TABLE: CHEAPEST_PRICING (with actual columns)');
    console.log('=' .repeat(120));

    const pricingCount = await client.query('SELECT COUNT(*) as count FROM cheapest_pricing');
    console.log(`Total rows: ${pricingCount.rows[0].count}\n`);

    const pricingQuery = `
      SELECT
        cruise_id,
        cheapest_price,
        cheapest_cabin_type,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price,
        created_at,
        updated_at
      FROM cheapest_pricing
      WHERE cheapest_price IS NOT NULL OR interior_price IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 20
    `;

    const pricingResult = await client.query(pricingQuery);
    console.log('Sample Data:');
    console.log('-'.repeat(120));

    console.log('Cruise ID | Cheapest | Cabin Type | Interior | Oceanview | Balcony | Suite   | Updated');
    console.log('-'.repeat(120));

    pricingResult.rows.forEach(price => {
      const formatPrice = (p) => p ? `$${parseFloat(p).toFixed(0)}` : 'NULL';
      const updated = price.updated_at ? new Date(price.updated_at).toISOString().split('T')[0] : 'Never';

      console.log(
        `${(price.cruise_id || '').toString().padEnd(9)} | ` +
        `${formatPrice(price.cheapest_price).padEnd(8)} | ` +
        `${(price.cheapest_cabin_type || 'N/A').padEnd(10)} | ` +
        `${formatPrice(price.interior_price).padEnd(8)} | ` +
        `${formatPrice(price.oceanview_price).padEnd(9)} | ` +
        `${formatPrice(price.balcony_price).padEnd(7)} | ` +
        `${formatPrice(price.suite_price).padEnd(7)} | ` +
        `${updated}`
      );
    });

    // 3. WEBHOOK_EVENTS TABLE
    console.log('\n\n🔔 TABLE: WEBHOOK_EVENTS (with actual columns)');
    console.log('=' .repeat(120));

    // First, let's check what columns exist
    const webhookColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'webhook_events'
      ORDER BY ordinal_position
    `);

    console.log('Available columns:', webhookColumns.rows.map(r => r.column_name).join(', '));

    const webhookCount = await client.query('SELECT COUNT(*) as count FROM webhook_events');
    console.log(`Total rows: ${webhookCount.rows[0].count}\n`);

    // Use actual columns
    const webhookQuery = `
      SELECT
        id,
        webhook_type,
        payload,
        status,
        error_message,
        created_at,
        processed_at
      FROM webhook_events
      ORDER BY created_at DESC
      LIMIT 20
    `;

    try {
      const webhookResult = await client.query(webhookQuery);
      console.log('Sample Data:');
      console.log('-'.repeat(120));

      console.log('ID   | Type         | Status    | Error | Created            | Processed');
      console.log('-'.repeat(120));

      webhookResult.rows.forEach(event => {
        const created = event.created_at ? new Date(event.created_at).toISOString().split('T')[0] : 'Unknown';
        const processed = event.processed_at ? new Date(event.processed_at).toISOString().split('T')[0] : 'Not processed';
        const error = event.error_message ? event.error_message.substring(0, 20) + '...' : 'None';

        console.log(
          `${(event.id || '').toString().padEnd(4)} | ` +
          `${(event.webhook_type || 'Unknown').padEnd(12)} | ` +
          `${(event.status || 'pending').padEnd(9)} | ` +
          `${error.padEnd(5)} | ` +
          `${created.padEnd(18)} | ` +
          `${processed}`
        );
      });
    } catch (err) {
      // Try alternative column names
      const altQuery = `SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 5`;
      const altResult = await client.query(altQuery);

      if (altResult.rows.length > 0) {
        console.log('\nSample raw data (first row):');
        console.log(JSON.stringify(altResult.rows[0], null, 2));
      }
    }

    // 4. SYSTEM_FLAGS TABLE
    console.log('\n\n⚙️ TABLE: SYSTEM_FLAGS (with actual columns)');
    console.log('=' .repeat(120));

    // Check columns first
    const flagColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'system_flags'
      ORDER BY ordinal_position
    `);

    console.log('Available columns:', flagColumns.rows.map(r => r.column_name).join(', '));

    const flagCount = await client.query('SELECT COUNT(*) as count FROM system_flags');
    console.log(`Total rows: ${flagCount.rows[0].count}\n`);

    // Get all rows since there are only 2
    const flagQuery = `SELECT * FROM system_flags`;
    const flagResult = await client.query(flagQuery);

    console.log('Sample Data:');
    console.log('-'.repeat(120));

    if (flagResult.rows.length > 0) {
      const columns = Object.keys(flagResult.rows[0]);

      // Print headers
      console.log(columns.map(col => col.padEnd(20)).join(' | '));
      console.log('-'.repeat(120));

      // Print rows
      flagResult.rows.forEach(row => {
        const values = columns.map(col => {
          const val = row[col];
          if (val === null) return 'NULL'.padEnd(20);
          if (val === true) return 'true'.padEnd(20);
          if (val === false) return 'false'.padEnd(20);
          return val.toString().substring(0, 20).padEnd(20);
        });
        console.log(values.join(' | '));
      });
    }

    // 5. USERS TABLE (check if it has data)
    console.log('\n\n👤 TABLE: USERS');
    console.log('=' .repeat(120));

    const userCount = await client.query('SELECT COUNT(*) as count FROM users');
    console.log(`Total rows: ${userCount.rows[0].count}\n`);

    if (userCount.rows[0].count > 0) {
      const userQuery = `
        SELECT
          id,
          email,
          clerk_id,
          role,
          created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT 20
      `;

      const userResult = await client.query(userQuery);
      console.log('Sample Data:');
      console.log('-'.repeat(120));

      userResult.rows.forEach(user => {
        console.log(`Email: ${user.email}, Role: ${user.role}, Created: ${new Date(user.created_at).toISOString().split('T')[0]}`);
      });
    } else {
      console.log('No users in the system yet.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed.');
  }
}

sampleMissingTables();
