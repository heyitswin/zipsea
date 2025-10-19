#!/usr/bin/env node

/**
 * Compare Production and Staging Database Schemas
 *
 * Shows differences in:
 * - Tables that exist in one but not the other
 * - Column differences for common tables
 * - Data type mismatches
 */

const postgres = require('postgres');
require('dotenv').config();

async function main() {
  const prodUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
  const stagingUrl = process.env.DATABASE_URL_STAGING;

  if (!prodUrl || !stagingUrl) {
    console.error('❌ Missing DATABASE_URL_PRODUCTION or DATABASE_URL_STAGING');
    process.exit(1);
  }

  const prod = postgres(prodUrl, { max: 2, ssl: 'require' });
  const staging = postgres(stagingUrl, { max: 2, ssl: 'require' });

  console.log('🔍 Comparing Production vs Staging Schemas\n');

  try {
    // Get all tables
    const prodTables = await prod`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    const stagingTables = await staging`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    const prodTableNames = new Set(prodTables.map(t => t.table_name));
    const stagingTableNames = new Set(stagingTables.map(t => t.table_name));

    // Tables only in production
    const onlyInProd = [...prodTableNames].filter(t => !stagingTableNames.has(t));
    if (onlyInProd.length > 0) {
      console.log('📋 Tables ONLY in Production:');
      onlyInProd.forEach(t => console.log(`  ❌ ${t}`));
      console.log();
    }

    // Tables only in staging
    const onlyInStaging = [...stagingTableNames].filter(t => !prodTableNames.has(t));
    if (onlyInStaging.length > 0) {
      console.log('📋 Tables ONLY in Staging:');
      onlyInStaging.forEach(t => console.log(`  ⚠️  ${t}`));
      console.log();
    }

    // Common tables
    const commonTables = [...prodTableNames].filter(t => stagingTableNames.has(t));
    console.log(`📋 Common Tables: ${commonTables.length}\n`);

    // Compare columns for key tables
    const keyTables = ['cruises', 'ships', 'cruise_lines', 'ports', 'itineraries', 'booking_sessions', 'bookings'];

    for (const table of keyTables) {
      if (!commonTables.includes(table)) {
        console.log(`⚠️  Table '${table}' not in both databases\n`);
        continue;
      }

      const prodCols = await prod`
        SELECT column_name, data_type, character_maximum_length, is_nullable
        FROM information_schema.columns
        WHERE table_name = ${table}
        ORDER BY ordinal_position
      `;
      const stagingCols = await staging`
        SELECT column_name, data_type, character_maximum_length, is_nullable
        FROM information_schema.columns
        WHERE table_name = ${table}
        ORDER BY ordinal_position
      `;

      const prodColNames = new Set(prodCols.map(c => c.column_name));
      const stagingColNames = new Set(stagingCols.map(c => c.column_name));

      const onlyInProdCols = prodCols.filter(c => !stagingColNames.has(c.column_name));
      const onlyInStagingCols = stagingCols.filter(c => !prodColNames.has(c.column_name));
      const commonCols = prodCols.filter(c => stagingColNames.has(c.column_name));

      let hasDifferences = false;

      if (onlyInProdCols.length > 0 || onlyInStagingCols.length > 0) {
        console.log(`🔍 Table: ${table}`);
        hasDifferences = true;
      }

      if (onlyInProdCols.length > 0) {
        console.log('  ❌ Columns ONLY in Production:');
        onlyInProdCols.forEach(c => console.log(`    - ${c.column_name} (${c.data_type})`));
      }

      if (onlyInStagingCols.length > 0) {
        console.log('  ⚠️  Columns ONLY in Staging:');
        onlyInStagingCols.forEach(c => console.log(`    - ${c.column_name} (${c.data_type})`));
      }

      // Check for data type mismatches in common columns
      const typeMismatches = [];
      for (const prodCol of commonCols) {
        const stagingCol = stagingCols.find(c => c.column_name === prodCol.column_name);
        if (stagingCol && prodCol.data_type !== stagingCol.data_type) {
          typeMismatches.push({
            name: prodCol.column_name,
            prod: prodCol.data_type,
            staging: stagingCol.data_type
          });
        }
      }

      if (typeMismatches.length > 0) {
        if (!hasDifferences) {
          console.log(`🔍 Table: ${table}`);
          hasDifferences = true;
        }
        console.log('  ⚠️  Data Type Mismatches:');
        typeMismatches.forEach(m => console.log(`    - ${m.name}: production=${m.prod}, staging=${m.staging}`));
      }

      if (hasDifferences) {
        console.log();
      }
    }

    // Check row counts
    console.log('📊 Row Counts:\n');
    for (const table of ['cruises', 'ships', 'cruise_lines', 'ports', 'booking_sessions', 'bookings']) {
      if (!commonTables.includes(table)) continue;

      try {
        const [{ count: prodCount }] = await prod.unsafe(`SELECT COUNT(*)::int as count FROM ${table}`);
        const [{ count: stagingCount }] = await staging.unsafe(`SELECT COUNT(*)::int as count FROM ${table}`);

        const diff = prodCount - stagingCount;
        const status = stagingCount === 0 ? '❌' : diff === 0 ? '✅' : '⚠️';
        console.log(`  ${status} ${table}: prod=${prodCount.toLocaleString()}, staging=${stagingCount.toLocaleString()}, diff=${diff.toLocaleString()}`);
      } catch (err) {
        console.log(`  ❌ ${table}: Error - ${err.message}`);
      }
    }

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  } finally {
    await prod.end();
    await staging.end();
  }
}

main();
