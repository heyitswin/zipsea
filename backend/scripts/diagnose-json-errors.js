const { db } = require('../dist/db/connection');
const { sql } = require('drizzle-orm');

async function diagnoseJsonErrors() {
  console.log('🔍 Diagnosing JSON parsing errors in cruises table...\n');

  try {
    // Check some sample region_ids and port_ids
    const samples = await db.execute(sql`
      SELECT
        id,
        region_ids,
        port_ids,
        LENGTH(region_ids) as region_len,
        LENGTH(port_ids) as port_len
      FROM cruises
      WHERE region_ids IS NOT NULL
         OR port_ids IS NOT NULL
      LIMIT 10
    `);

    console.log('📊 Sample data from cruises table:');
    const rows = samples.rows || samples;
    for (const row of rows) {
      console.log('\nCruise ID:', row.id);
      console.log('  region_ids:', row.region_ids);
      console.log('  port_ids:', row.port_ids);

      // Try to parse as JSON
      if (row.region_ids) {
        try {
          const parsed = JSON.parse(row.region_ids);
          console.log('  ✅ region_ids is valid JSON');
        } catch (e) {
          console.log('  ❌ region_ids is NOT valid JSON:', e.message);
        }
      }

      if (row.port_ids) {
        try {
          const parsed = JSON.parse(row.port_ids);
          console.log('  ✅ port_ids is valid JSON');
        } catch (e) {
          console.log('  ❌ port_ids is NOT valid JSON:', e.message);
        }
      }
    }

    // Check for problematic patterns
    console.log('\n\n📊 Checking for common issues...\n');

    // Check for trailing commas
    const trailingCommas = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM cruises
      WHERE region_ids LIKE '%,]%'
         OR region_ids LIKE '%,}%'
         OR port_ids LIKE '%,]%'
         OR port_ids LIKE '%,}%'
    `);
    console.log('Cruises with trailing commas:', (trailingCommas.rows || trailingCommas)[0].count);

    // Check for simple comma-separated values (not JSON)
    const commaSeparated = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM cruises
      WHERE (region_ids NOT LIKE '[%' AND region_ids NOT LIKE '{%' AND region_ids IS NOT NULL)
         OR (port_ids NOT LIKE '[%' AND port_ids NOT LIKE '{%' AND port_ids IS NOT NULL)
    `);
    console.log(
      'Cruises with comma-separated values (not JSON):',
      (commaSeparated.rows || commaSeparated)[0].count
    );

    // Check specific position 27 issue
    const position27Issue = await db.execute(sql`
      SELECT
        id,
        SUBSTRING(region_ids, 25, 5) as region_substr,
        SUBSTRING(port_ids, 25, 5) as port_substr
      FROM cruises
      WHERE LENGTH(region_ids) > 27 OR LENGTH(port_ids) > 27
      LIMIT 5
    `);

    console.log('\n📊 Checking position 27 (where error occurs):');
    for (const row of position27Issue.rows || position27Issue) {
      console.log('  ID:', row.id);
      console.log('    region_ids at pos 25-30:', row.region_substr);
      console.log('    port_ids at pos 25-30:', row.port_substr);
    }

    // Try the actual failing query
    console.log('\n\n🔍 Testing the actual failing JSONB cast...\n');

    try {
      const testQuery = await db.execute(sql`
        SELECT id, region_ids::jsonb
        FROM cruises
        WHERE region_ids IS NOT NULL
        LIMIT 1
      `);
      console.log('✅ JSONB cast succeeded for regions');
    } catch (error) {
      console.log('❌ JSONB cast failed for regions:', error.message);

      // Find the problematic row
      const badRow = await db.execute(sql`
        SELECT id, region_ids
        FROM cruises
        WHERE region_ids IS NOT NULL
          AND region_ids != '[]'
          AND region_ids != '{}'
        LIMIT 1
      `);

      const badRows = badRow.rows || badRow;
      if (badRows.length > 0) {
        console.log('  Problem row ID:', badRows[0].id);
        console.log('  Problem value:', badRows[0].region_ids);
      }
    }
  } catch (error) {
    console.error('Error during diagnosis:', error);
  }

  process.exit(0);
}

diagnoseJsonErrors();
