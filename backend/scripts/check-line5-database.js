#!/usr/bin/env node

/**
 * Check Line 5 (Cunard) Database Data
 *
 * Investigates database state for line 5 cruises
 */

const { Client } = require('pg');

const logger = {
  info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args)
};

async function checkLine5Database() {
  logger.info('🗄️ CHECKING LINE 5 (CUNARD) DATABASE STATE');
  logger.info('='.repeat(80));

  let client = null;

  try {
    // Connect to database
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    logger.info('✅ Database connection successful');

    // Check cruise line info
    logger.info('\n🏢 Checking cruise line information...');
    const cruiseLineQuery = `
      SELECT id, name, code, description
      FROM cruise_lines
      WHERE id = 5 OR name ILIKE '%cunard%'
      ORDER BY id;
    `;

    const cruiseLineResult = await client.query(cruiseLineQuery);
    logger.info(`Found ${cruiseLineResult.rows.length} cruise line records:`);
    cruiseLineResult.rows.forEach(row => {
      logger.info(`  - ID: ${row.id}, Name: ${row.name}, Code: ${row.code || 'N/A'}`);
    });

    // Check ships for line 5
    logger.info('\n🚢 Checking ships for cruise line 5...');
    const shipsQuery = `
      SELECT id, name, cruise_line_id, capacity, is_active
      FROM ships
      WHERE cruise_line_id = 5
      ORDER BY name
      LIMIT 10;
    `;

    const shipsResult = await client.query(shipsQuery);
    logger.info(`Found ${shipsResult.rows.length} ships for cruise line 5:`);
    shipsResult.rows.forEach(row => {
      logger.info(`  - ID: ${row.id}, Name: ${row.name}, Active: ${row.is_active}, Capacity: ${row.capacity || 'N/A'}`);
    });

    // Check cruises for line 5
    logger.info('\n🛳️ Checking cruises for cruise line 5...');
    const cruisesQuery = `
      SELECT
        c.id, c.cruise_id, c.name, c.sailing_date, c.nights, c.is_active,
        s.name as ship_name,
        cl.name as cruise_line_name
      FROM cruises c
      JOIN ships s ON c.ship_id = s.id
      JOIN cruise_lines cl ON s.cruise_line_id = cl.id
      WHERE cl.id = 5 AND c.is_active = true
      ORDER BY c.sailing_date
      LIMIT 20;
    `;

    const cruisesResult = await client.query(cruisesQuery);
    logger.info(`Found ${cruisesResult.rows.length} active cruises for cruise line 5:`);
    cruisesResult.rows.forEach(row => {
      logger.info(`  - Cruise ID: ${row.cruise_id}, Name: ${row.name}, Ship: ${row.ship_name}, Sailing: ${row.sailing_date}, Nights: ${row.nights}`);
    });

    // Check if there are any cruises at all for line 5 (including inactive)
    const allCruisesQuery = `
      SELECT COUNT(*) as total_cruises, COUNT(CASE WHEN is_active THEN 1 END) as active_cruises
      FROM cruises c
      JOIN ships s ON c.ship_id = s.id
      WHERE s.cruise_line_id = 5;
    `;

    const allCruisesResult = await client.query(allCruisesQuery);
    const counts = allCruisesResult.rows[0];
    logger.info(`\n📊 Cruise line 5 summary: ${counts.active_cruises} active / ${counts.total_cruises} total cruises`);

    // Check recent webhook processing attempts
    logger.info('\n📨 Checking recent webhook processing logs...');

    // This would need to be adapted based on your logging table structure
    // For now, just check if there are any pricing records for line 5
    const pricingQuery = `
      SELECT COUNT(*) as pricing_records
      FROM pricing p
      JOIN cruises c ON p.cruise_id = c.cruise_id
      JOIN ships s ON c.ship_id = s.id
      WHERE s.cruise_line_id = 5;
    `;

    const pricingResult = await client.query(pricingQuery);
    const pricingCount = pricingResult.rows[0].pricing_records;
    logger.info(`Found ${pricingCount} pricing records for cruise line 5`);

    // Final diagnosis
    logger.info('\n' + '='.repeat(80));
    logger.info('🎯 DATABASE DIAGNOSIS');
    logger.info('='.repeat(80));

    const hasLine5 = cruiseLineResult.rows.length > 0;
    const hasShips = shipsResult.rows.length > 0;
    const hasCruises = cruisesResult.rows.length > 0;
    const hasPricing = pricingCount > 0;

    logger.info(`Cruise Line 5 Exists: ${hasLine5 ? '✅ Yes' : '❌ No'}`);
    logger.info(`Ships for Line 5: ${hasShips ? '✅ Yes' : '❌ No'} (${shipsResult.rows.length} ships)`);
    logger.info(`Active Cruises for Line 5: ${hasCruises ? '✅ Yes' : '❌ No'} (${cruisesResult.rows.length} cruises)`);
    logger.info(`Pricing Data for Line 5: ${hasPricing ? '✅ Yes' : '❌ No'} (${pricingCount} records)`);

    logger.info('\n🔧 DIAGNOSIS:');

    if (!hasLine5) {
      logger.info('❌ CRITICAL: Cruise line 5 (Cunard) does not exist in database');
      logger.info('   - Add Cunard to cruise_lines table with ID 5');
    } else if (!hasShips) {
      logger.info('❌ CRITICAL: No ships found for cruise line 5');
      logger.info('   - Import Cunard ships from FTP data');
    } else if (!hasCruises) {
      logger.info('❌ CRITICAL: No active cruises found for cruise line 5');
      logger.info('   - Import Cunard cruise data from FTP');
      logger.info('   - This explains why bulk downloader returns 0 cruises');
    } else {
      logger.info('✅ Line 5 has database records - issue might be in webhook processing logic');
    }

  } catch (error) {
    logger.error('❌ Database check failed:', error);
  } finally {
    if (client) {
      try {
        await client.end();
      } catch (e) {
        // Ignore close errors
      }
    }
  }
}

// Run the check
checkLine5Database().catch(error => {
  logger.error('Database check script failed:', error);
  process.exit(1);
});
