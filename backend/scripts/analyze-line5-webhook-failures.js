#!/usr/bin/env node

/**
 * Analyze Line 5 (Cunard) Webhook Processing Failures
 *
 * This script analyzes why Line 5 webhooks show 0% success rate
 */

require('dotenv').config();
const { Client } = require('pg');

const logger = {
  info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
  debug: (message, ...args) => console.log(`[DEBUG] ${message}`, ...args)
};

async function analyzeLine5Webhooks() {
  logger.info('🔍 ANALYZING LINE 5 (CUNARD) WEBHOOK FAILURES');
  logger.info('='.repeat(80));

  let client = null;

  try {
    // Connect to database
    const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL or DATABASE_URL_PRODUCTION environment variable not set');
    }

    client = new Client({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : false
    });
    await client.connect();
    logger.info('✅ Database connection successful\n');

    // 1. Check Line 5 basic information
    logger.info('1️⃣ LINE 5 BASIC INFORMATION');
    logger.info('-'.repeat(40));

    const lineInfoQuery = `
      SELECT
        cl.id, cl.name, cl.code,
        COUNT(DISTINCT s.id) as ship_count,
        COUNT(DISTINCT c.id) as cruise_count
      FROM cruise_lines cl
      LEFT JOIN ships s ON s.cruise_line_id = cl.id
      LEFT JOIN cruises c ON c.ship_id = s.id AND c.is_active = true
      WHERE cl.id = 5
      GROUP BY cl.id, cl.name, cl.code;
    `;

    const lineInfo = await client.query(lineInfoQuery);
    if (lineInfo.rows.length === 0) {
      logger.error('❌ Line 5 not found in database!');
      return;
    }

    const line = lineInfo.rows[0];
    logger.info(`Line ID: ${line.id}`);
    logger.info(`Name: ${line.name}`);
    logger.info(`Code: ${line.code || 'N/A'}`);
    logger.info(`Ships: ${line.ship_count}`);
    logger.info(`Active Cruises: ${line.cruise_count}\n`);

    // 2. Check cruise ID format and patterns
    logger.info('2️⃣ CRUISE ID ANALYSIS');
    logger.info('-'.repeat(40));

    const cruisePatternQuery = `
      SELECT
        c.id, c.cruise_id, c.name,
        s.id as ship_id, s.name as ship_name,
        c.sailing_date,
        LENGTH(c.cruise_id) as id_length,
        CASE
          WHEN c.cruise_id ~ '^[0-9]+$' THEN 'numeric'
          ELSE 'mixed'
        END as id_type
      FROM cruises c
      JOIN ships s ON c.ship_id = s.id
      WHERE s.cruise_line_id = 5 AND c.is_active = true
      ORDER BY c.sailing_date
      LIMIT 10;
    `;

    const cruisePatterns = await client.query(cruisePatternQuery);
    logger.info(`Sample Cruise IDs (first 10):`);

    const idLengths = new Set();
    const idTypes = new Set();

    cruisePatterns.rows.forEach(cruise => {
      logger.info(`  - ID: ${cruise.cruise_id} (${cruise.id_type}, ${cruise.id_length} chars)`);
      logger.info(`    Ship: ${cruise.ship_name} (ID: ${cruise.ship_id})`);
      logger.info(`    Name: ${cruise.name}`);
      logger.info(`    Sailing: ${new Date(cruise.sailing_date).toISOString().split('T')[0]}`);

      idLengths.add(cruise.id_length);
      idTypes.add(cruise.id_type);
    });

    logger.info(`\nID Characteristics:`);
    logger.info(`  - Lengths: ${Array.from(idLengths).sort().join(', ')} characters`);
    logger.info(`  - Types: ${Array.from(idTypes).join(', ')}\n`);

    // 3. Check if cruise IDs exist in pricing table
    logger.info('3️⃣ PRICING DATA CHECK');
    logger.info('-'.repeat(40));

    const pricingCheckQuery = `
      SELECT
        COUNT(DISTINCT c.id) as cruises_without_pricing
      FROM cruises c
      JOIN ships s ON c.ship_id = s.id
      WHERE s.cruise_line_id = 5
        AND c.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM pricing p
          WHERE p.cruise_id = c.cruise_id
        );
    `;

    const pricingCheck = await client.query(pricingCheckQuery);
    const cruisesWithoutPricing = pricingCheck.rows[0].cruises_without_pricing;

    logger.info(`Cruises without pricing: ${cruisesWithoutPricing} out of ${line.cruise_count}`);

    if (cruisesWithoutPricing > 0) {
      logger.warn(`⚠️ ${cruisesWithoutPricing} cruises have no pricing data!`);

      // Show some examples
      const noPricingExamplesQuery = `
        SELECT c.cruise_id, c.name, s.name as ship_name
        FROM cruises c
        JOIN ships s ON c.ship_id = s.id
        WHERE s.cruise_line_id = 5
          AND c.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM pricing p
            WHERE p.cruise_id = c.cruise_id
          )
        LIMIT 5;
      `;

      const examples = await client.query(noPricingExamplesQuery);
      if (examples.rows.length > 0) {
        logger.info('  Examples without pricing:');
        examples.rows.forEach(ex => {
          logger.info(`    - ${ex.cruise_id}: ${ex.name} on ${ex.ship_name}`);
        });
      }
    } else {
      logger.info('✅ All cruises have pricing data\n');
    }

    // 4. Check webhook processing patterns
    logger.info('4️⃣ WEBHOOK PROCESSING PATTERN ANALYSIS');
    logger.info('-'.repeat(40));

    // Check if there's a mismatch in ID formats
    const idMismatchQuery = `
      SELECT
        c.cruise_id as db_cruise_id,
        c.id as db_internal_id,
        c.name,
        s.id as ship_id,
        s.name as ship_name
      FROM cruises c
      JOIN ships s ON c.ship_id = s.id
      WHERE s.cruise_line_id = 5
        AND c.is_active = true
      ORDER BY c.sailing_date
      LIMIT 5;
    `;

    const idMismatches = await client.query(idMismatchQuery);
    logger.info('Database Cruise ID Structure:');
    idMismatches.rows.forEach(row => {
      logger.info(`  Cruise ID (FTP): ${row.db_cruise_id}`);
      logger.info(`  Internal ID: ${row.db_internal_id}`);
      logger.info(`  Ship ID: ${row.ship_id}`);
      logger.info(`  Expected FTP path: /YYYY/MM/5/${row.ship_id}/${row.db_cruise_id}.json`);
      logger.info('  ---');
    });

    // 5. Diagnosis Summary
    logger.info('\n' + '='.repeat(80));
    logger.info('📊 DIAGNOSIS SUMMARY');
    logger.info('='.repeat(80));

    logger.info('\n🔍 KEY FINDINGS:');
    logger.info('1. Line 5 (Cunard) exists in database with:');
    logger.info(`   - ${line.ship_count} ships`);
    logger.info(`   - ${line.cruise_count} active cruises`);

    if (cruisesWithoutPricing > 0) {
      logger.info(`\n2. ⚠️ CRITICAL: ${cruisesWithoutPricing} cruises have NO pricing data`);
      logger.info('   This could explain why webhooks fail - no pricing to update!');
    } else {
      logger.info('\n2. ✅ All cruises have pricing data');
    }

    logger.info('\n3. Cruise ID Format:');
    logger.info(`   - ID Lengths: ${Array.from(idLengths).join(', ')} chars`);
    logger.info(`   - ID Types: ${Array.from(idTypes).join(', ')}`);

    logger.info('\n🔧 POTENTIAL ISSUES:');
    logger.info('1. Webhook might be sending cruise IDs that don\'t match database');
    logger.info('2. FTP path structure might be different for Line 5');
    logger.info('3. Bulk FTP downloader might not be finding the files');
    logger.info('4. Cruise ID mapping between webhook and database might be incorrect');

    logger.info('\n💡 RECOMMENDATIONS:');
    logger.info('1. Check actual webhook payloads for Line 5 in production logs');
    logger.info('2. Verify FTP file structure for Line 5 on the server');
    logger.info('3. Test bulk FTP download with actual production credentials');
    logger.info('4. Add more detailed logging to webhook processing for Line 5');
    if (cruisesWithoutPricing > 0) {
      logger.info('5. ⚠️ URGENT: Run initial sync to populate pricing for Line 5 cruises!');
    }

  } catch (error) {
    logger.error('❌ Analysis failed:', error.message);
    if (error.stack) {
      logger.error('Stack trace:', error.stack);
    }
  } finally {
    // Cleanup
    if (client) {
      await client.end().catch(() => {});
    }
  }
}

// Run the analysis
analyzeLine5Webhooks().catch(error => {
  logger.error('❌ Unhandled error:', error);
  process.exit(1);
});
