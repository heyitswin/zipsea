require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function countCorruptedCruises() {
  try {
    console.log('🔍 ANALYZING CORRUPTED RAW_DATA ACROSS ALL CRUISES');
    console.log('=' .repeat(60));

    // Count cruises with corrupted raw_data (character-by-character storage)
    const corruptedResult = await pool.query(`
      SELECT COUNT(*) as corrupted_count
      FROM cruises
      WHERE raw_data IS NOT NULL
      AND raw_data->>'0' IS NOT NULL
      AND raw_data->>'1' IS NOT NULL
    `);

    const totalResult = await pool.query(`
      SELECT COUNT(*) as total_count
      FROM cruises
      WHERE raw_data IS NOT NULL
    `);

    const corruptedCount = parseInt(corruptedResult.rows[0].corrupted_count);
    const totalCount = parseInt(totalResult.rows[0].total_count);

    console.log(`\n📊 CORRUPTION STATISTICS:`);
    console.log(`  Total cruises with raw_data: ${totalCount}`);
    console.log(`  Corrupted (character-by-character): ${corruptedCount}`);
    console.log(`  Percentage corrupted: ${((corruptedCount / totalCount) * 100).toFixed(1)}%`);

    // Get sample of corrupted cruises with pricing issues
    console.log('\n🔍 CHECKING PRICING IMPACT ON CORRUPTED CRUISES:');

    const sampleResult = await pool.query(`
      SELECT
        id,
        name,
        interior_price,
        cheapest_price,
        updated_at
      FROM cruises
      WHERE raw_data IS NOT NULL
      AND raw_data->>'0' IS NOT NULL
      AND raw_data->>'1' IS NOT NULL
      AND interior_price < 200  -- Suspiciously low prices
      ORDER BY updated_at DESC
      LIMIT 10
    `);

    console.log('\nSample of corrupted cruises with suspiciously low prices:');
    sampleResult.rows.forEach(cruise => {
      console.log(`  ${cruise.id}: Interior $${cruise.interior_price} - ${cruise.name.substring(0, 40)}...`);
    });

    // Check date range of corruption
    const dateRangeResult = await pool.query(`
      SELECT
        MIN(updated_at) as earliest_corruption,
        MAX(updated_at) as latest_corruption
      FROM cruises
      WHERE raw_data IS NOT NULL
      AND raw_data->>'0' IS NOT NULL
      AND raw_data->>'1' IS NOT NULL
    `);

    if (dateRangeResult.rows.length > 0) {
      const range = dateRangeResult.rows[0];
      console.log('\n📅 CORRUPTION TIME RANGE:');
      console.log(`  Earliest: ${range.earliest_corruption}`);
      console.log(`  Latest: ${range.latest_corruption}`);
    }

    // Check if webhook processor is currently creating new corrupted entries
    const recentResult = await pool.query(`
      SELECT COUNT(*) as recent_corrupted
      FROM cruises
      WHERE raw_data IS NOT NULL
      AND raw_data->>'0' IS NOT NULL
      AND raw_data->>'1' IS NOT NULL
      AND updated_at > NOW() - INTERVAL '24 hours'
    `);

    const recentCorrupted = parseInt(recentResult.rows[0].recent_corrupted);

    if (recentCorrupted > 0) {
      console.log(`\n⚠️  WARNING: ${recentCorrupted} new corrupted entries in last 24 hours!`);
      console.log('The webhook processor is STILL creating corrupted data!');
    } else {
      console.log('\n✅ No new corrupted entries in last 24 hours');
    }

    console.log('\n🎯 RECOMMENDED ACTIONS:');
    console.log('1. URGENT: Fix webhook processor to stop creating corrupted data');
    console.log('2. Fix all ' + corruptedCount + ' corrupted raw_data entries');
    console.log('3. Recalculate prices for all affected cruises');
    console.log('4. Add validation to prevent future corruption');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

countCorruptedCruises();
