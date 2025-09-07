const { Pool } = require('pg');

async function clearAllPendingSyncs() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔧 Clearing all pending price update flags...');

    // First, get the count of pending syncs
    const countResult = await pool.query(`
      SELECT COUNT(*) as total_pending
      FROM cruises
      WHERE needs_price_update = true
    `);

    const totalPending = countResult.rows[0].total_pending;
    console.log(`📊 Found ${totalPending} cruises with pending updates`);

    if (totalPending === '0') {
      console.log('✅ No pending syncs to clear');
      return;
    }

    // Clear in batches to avoid timeout and show progress
    console.log('🔄 Clearing flags in batches...');

    const batchSize = 5000;
    let totalCleared = 0;
    let batchNumber = 0;

    while (true) {
      batchNumber++;
      console.log(`  Processing batch ${batchNumber} (up to ${batchSize} records)...`);

      // Clear a batch of pending flags
      const updateResult = await pool.query(`
        UPDATE cruises
        SET
          needs_price_update = false,
          price_update_requested_at = NULL
        WHERE id IN (
          SELECT id
          FROM cruises
          WHERE needs_price_update = true
          LIMIT ${batchSize}
        )
      `);

      if (updateResult.rowCount === 0) {
        break; // No more records to update
      }

      totalCleared += updateResult.rowCount;
      console.log(`  ✓ Batch ${batchNumber}: Cleared ${updateResult.rowCount} flags (Total: ${totalCleared}/${totalPending})`);

      if (updateResult.rowCount < batchSize) {
        break; // Last batch
      }
    }

    console.log(`\n✅ Successfully cleared ${totalCleared} pending price update flags!`);

    // Verify all are cleared
    console.log('\n🔍 Verifying...');
    const verifyResult = await pool.query(`
      SELECT COUNT(*) as remaining
      FROM cruises
      WHERE needs_price_update = true
    `);

    const remaining = verifyResult.rows[0].remaining;
    if (remaining === '0') {
      console.log('✅ Verification complete: All pending syncs cleared!');
    } else {
      console.log(`⚠️ Warning: ${remaining} cruises still have pending flags`);
    }

    // Show summary by cruise line
    const summaryResult = await pool.query(`
      SELECT
        cruise_line_id,
        COUNT(*) as total_cruises
      FROM cruises
      GROUP BY cruise_line_id
      ORDER BY total_cruises DESC
      LIMIT 10
    `);

    console.log('\n📋 Top 10 cruise lines by total cruises:');
    summaryResult.rows.forEach(row => {
      console.log(`  Line ${row.cruise_line_id}: ${row.total_cruises} cruises`);
    });

  } catch (error) {
    console.error('❌ Error clearing pending syncs:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run immediately with command line flag
if (process.argv.includes('--force')) {
  console.log('🚀 Running with --force flag, skipping confirmation...');
  clearAllPendingSyncs().then(() => process.exit(0));
} else {
  // Add confirmation prompt
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('⚠️  WARNING: This will clear ALL pending price update flags!');
  console.log('This means cruises marked for price updates will no longer be processed.');
  console.log('');

  rl.question('Are you sure you want to continue? (yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      rl.close();
      clearAllPendingSyncs().then(() => process.exit(0));
    } else {
      console.log('❌ Operation cancelled');
      rl.close();
      process.exit(0);
    }
  });
}
