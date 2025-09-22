/**
 * Comprehensive validation script to ensure all data corruption issues are fixed
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

function isCorruptedRawData(rawData) {
  // Check if it's a string (PostgreSQL returns corrupted JSONB as string)
  if (typeof rawData === 'string') {
    try {
      const parsed = JSON.parse(rawData);
      // If it parses and has numeric keys, it's corrupted
      if (typeof parsed === 'object' && parsed !== null) {
        const keys = Object.keys(parsed);
        return keys.some(key => /^\d+$/.test(key));
      }
    } catch (e) {
      // If it doesn't parse, it's corrupted
      return true;
    }
  }

  // Check if it's an object with numeric keys
  if (typeof rawData === 'object' && rawData !== null) {
    const keys = Object.keys(rawData);
    if (keys.some(key => /^\d+$/.test(key))) {
      return true;
    }
  }

  return false;
}

async function main() {
  console.log('=' .repeat(80));
  console.log('COMPREHENSIVE DATA VALIDATION');
  console.log('=' .repeat(80));
  console.log(`Running at: ${new Date().toISOString()}\n`);

  const issues = {
    corruptedRawData: [],
    nullCheapestPrice: [],
    tableMismatch: [],
    suspiciousPrices: []
  };

  try {
    // 1. Check for corrupted raw_data
    console.log('1. Checking for corrupted raw_data...');

    let offset = 0;
    let totalChecked = 0;

    while (true) {
      const batch = await sql`
        SELECT id, name, raw_data
        FROM cruises
        WHERE is_active = true
        ORDER BY id
        LIMIT 100
        OFFSET ${offset}
      `;

      if (batch.length === 0) break;

      for (const cruise of batch) {
        if (isCorruptedRawData(cruise.raw_data)) {
          issues.corruptedRawData.push({
            id: cruise.id,
            name: cruise.name
          });
        }
      }

      totalChecked += batch.length;
      offset += 100;

      if (totalChecked % 5000 === 0) {
        process.stdout.write(`   Checked ${totalChecked} cruises...\r`);
      }
    }

    console.log(`   ✓ Checked ${totalChecked} cruises`);
    console.log(`   ${issues.corruptedRawData.length === 0 ? '✅' : '❌'} Found ${issues.corruptedRawData.length} corrupted raw_data entries\n`);

    // 2. Check for NULL cheapest_price
    console.log('2. Checking for NULL cheapest_price with valid cabin prices...');

    const nullCheapest = await sql`
      SELECT id, name
      FROM cruises
      WHERE cheapest_price IS NULL
      AND (
        interior_price IS NOT NULL
        OR oceanview_price IS NOT NULL
        OR balcony_price IS NOT NULL
        OR suite_price IS NOT NULL
      )
      AND is_active = true
    `;

    issues.nullCheapestPrice = nullCheapest;
    console.log(`   ${issues.nullCheapestPrice.length === 0 ? '✅' : '❌'} Found ${issues.nullCheapestPrice.length} cruises with NULL cheapest_price\n`);

    // 3. Check for mismatches between tables
    console.log('3. Checking for price mismatches between cruises and cheapest_pricing tables...');

    const mismatches = await sql`
      SELECT
        c.id,
        c.name,
        c.cheapest_price::decimal as cruise_price,
        cp.cheapest_price as cp_price,
        ABS(COALESCE(c.cheapest_price::decimal, 0) - COALESCE(cp.cheapest_price, 0)) as diff
      FROM cruises c
      LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
      WHERE c.is_active = true
      AND ABS(COALESCE(c.cheapest_price::decimal, 0) - COALESCE(cp.cheapest_price, 0)) > 0.01
      LIMIT 100
    `;

    issues.tableMismatch = mismatches;
    console.log(`   ${issues.tableMismatch.length === 0 ? '✅' : '❌'} Found ${mismatches.length} price mismatches\n`);

    // 4. Check for suspicious prices (too low)
    console.log('4. Checking for suspiciously low prices...');

    const suspicious = await sql`
      SELECT id, name, cheapest_price::decimal as price
      FROM cruises
      WHERE cheapest_price IS NOT NULL
      AND cheapest_price::decimal > 0
      AND cheapest_price::decimal < 50
      AND is_active = true
      LIMIT 20
    `;

    issues.suspiciousPrices = suspicious;
    console.log(`   ${issues.suspiciousPrices.length === 0 ? '✅' : '⚠️ '} Found ${suspicious.length} cruises with price < $50\n`);

    // Summary
    console.log('=' .repeat(80));
    console.log('VALIDATION SUMMARY');
    console.log('=' .repeat(80));

    const totalIssues =
      issues.corruptedRawData.length +
      issues.nullCheapestPrice.length +
      issues.tableMismatch.length;

    if (totalIssues === 0) {
      console.log('✅ ALL CHECKS PASSED! Database is clean.');
    } else {
      console.log('❌ ISSUES FOUND:\n');

      if (issues.corruptedRawData.length > 0) {
        console.log(`1. Corrupted raw_data: ${issues.corruptedRawData.length} cruises`);
        console.log('   Fix: node scripts/fix-remaining-json-strings-final.js --execute\n');

        // Show first 5 examples
        console.log('   Examples:');
        for (let i = 0; i < Math.min(5, issues.corruptedRawData.length); i++) {
          const cruise = issues.corruptedRawData[i];
          console.log(`     - ${cruise.id}: ${cruise.name}`);
        }
        console.log();
      }

      if (issues.nullCheapestPrice.length > 0) {
        console.log(`2. NULL cheapest_price: ${issues.nullCheapestPrice.length} cruises`);
        console.log('   Fix: node scripts/fix-null-cheapest-price.js --execute\n');

        // Show first 5 examples
        console.log('   Examples:');
        for (let i = 0; i < Math.min(5, issues.nullCheapestPrice.length); i++) {
          const cruise = issues.nullCheapestPrice[i];
          console.log(`     - ${cruise.id}: ${cruise.name}`);
        }
        console.log();
      }

      if (issues.tableMismatch.length > 0) {
        console.log(`3. Table price mismatches: ${issues.tableMismatch.length} cruises`);
        console.log('   Fix: node scripts/sync-cheapest-pricing-fixed.js --execute\n');

        // Show first 5 examples
        console.log('   Examples:');
        for (let i = 0; i < Math.min(5, issues.tableMismatch.length); i++) {
          const cruise = issues.tableMismatch[i];
          console.log(`     - ${cruise.id}: ${cruise.name}`);
          console.log(`       Cruises table: $${cruise.cruise_price || 'null'}`);
          console.log(`       Cheapest_pricing: $${cruise.cp_price || 'null'}`);
          console.log(`       Difference: $${cruise.diff}`);
        }
        console.log();
      }
    }

    if (issues.suspiciousPrices.length > 0) {
      console.log('⚠️  WARNINGS:');
      console.log(`   Found ${issues.suspiciousPrices.length} cruises with prices under $50`);
      console.log('   These might be legitimate or might need investigation\n');

      // Show examples
      console.log('   Examples:');
      for (let i = 0; i < Math.min(5, issues.suspiciousPrices.length); i++) {
        const cruise = issues.suspiciousPrices[i];
        console.log(`     - ${cruise.id}: ${cruise.name} - $${cruise.price}`);
      }
    }

    // Quick stats
    console.log('\n' + '=' .repeat(80));
    console.log('DATABASE STATISTICS');
    console.log('=' .repeat(80));

    const stats = await sql`
      SELECT
        (SELECT COUNT(*) FROM cruises WHERE is_active = true) as total_cruises,
        (SELECT COUNT(*) FROM cruises WHERE is_active = true AND cheapest_price IS NOT NULL) as with_price,
        (SELECT COUNT(*) FROM cheapest_pricing) as cheapest_pricing_count,
        (SELECT MIN(cheapest_price::decimal) FROM cruises WHERE is_active = true AND cheapest_price > 0) as min_price,
        (SELECT MAX(cheapest_price::decimal) FROM cruises WHERE is_active = true) as max_price,
        (SELECT AVG(cheapest_price::decimal) FROM cruises WHERE is_active = true AND cheapest_price > 0) as avg_price
    `;

    const stat = stats[0];
    console.log(`Total active cruises: ${stat.total_cruises}`);
    console.log(`Cruises with price: ${stat.with_price} (${(stat.with_price/stat.total_cruises*100).toFixed(1)}%)`);
    console.log(`Cheapest_pricing entries: ${stat.cheapest_pricing_count}`);
    console.log(`Price range: $${parseFloat(stat.min_price).toFixed(2)} - $${parseFloat(stat.max_price).toFixed(2)}`);
    console.log(`Average price: $${parseFloat(stat.avg_price).toFixed(2)}`);

  } catch (error) {
    console.error('Error during validation:', error);
  } finally {
    await sql.end();
  }
}

main();
