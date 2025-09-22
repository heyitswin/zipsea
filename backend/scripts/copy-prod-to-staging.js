/**
 * Copy production cruise data to staging for testing
 * Only copies cruises table data, not the entire database
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Database connections
const prodUrl = process.env.DATABASE_URL_PRODUCTION || 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';
const stagingUrl = process.env.DATABASE_URL || 'postgresql://zipsea_user:YROzJArXNhDGLj83p9xtVwhQb7oEmPIE@dpg-cslkgnq3esus73fb1du0-a.oregon-postgres.render.com/zipsea_db';

const prodSql = postgres(prodUrl, { ssl: { rejectUnauthorized: false } });
const stagingSql = postgres(stagingUrl, { ssl: { rejectUnauthorized: false } });

// Parse arguments
const args = process.argv.slice(2);
const SAMPLE_SIZE = args.find(arg => arg.startsWith('--sample='))?.split('=')[1] || null;
const SPECIFIC_CRUISE = args.find(arg => arg.startsWith('--cruise='))?.split('=')[1] || null;

async function copyData() {
  console.log('=' .repeat(80));
  console.log('COPYING PRODUCTION DATA TO STAGING');
  console.log('=' .repeat(80));
  console.log();

  try {
    if (SPECIFIC_CRUISE) {
      // Copy specific cruise
      console.log(`Copying specific cruise: ${SPECIFIC_CRUISE}`);

      const prodCruise = await prodSql`
        SELECT *
        FROM cruises
        WHERE id = ${SPECIFIC_CRUISE}
      `;

      if (prodCruise.length === 0) {
        console.log('❌ Cruise not found in production');
        return;
      }

      console.log(`Found cruise: ${prodCruise[0].name}`);

      // Delete if exists in staging
      await stagingSql`
        DELETE FROM cruises WHERE id = ${SPECIFIC_CRUISE}
      `;

      // Insert into staging
      await stagingSql`
        INSERT INTO cruises ${stagingSql(prodCruise[0])}
      `;

      console.log('✅ Cruise copied to staging');

      // Verify
      const stagingCheck = await stagingSql`
        SELECT id, name, interior_price, oceanview_price, balcony_price, suite_price
        FROM cruises
        WHERE id = ${SPECIFIC_CRUISE}
      `;

      console.log('Verification:', stagingCheck[0]);

    } else if (SAMPLE_SIZE) {
      // Copy sample of cruises with pricing issues
      console.log(`Copying ${SAMPLE_SIZE} cruises with potential pricing issues...`);

      const prodCruises = await prodSql`
        SELECT *
        FROM cruises
        WHERE raw_data IS NOT NULL
        AND raw_data::text LIKE '%cheapest%'
        AND is_active = true
        ORDER BY updated_at DESC
        LIMIT ${parseInt(SAMPLE_SIZE)}
      `;

      console.log(`Found ${prodCruises.length} cruises to copy`);

      // Clear staging cruises table (be careful!)
      console.log('Clearing staging cruises table...');
      await stagingSql`TRUNCATE cruises CASCADE`;

      // Batch insert
      const batchSize = 100;
      for (let i = 0; i < prodCruises.length; i += batchSize) {
        const batch = prodCruises.slice(i, i + batchSize);
        await stagingSql`INSERT INTO cruises ${stagingSql(batch)}`;
        console.log(`Inserted ${Math.min(i + batchSize, prodCruises.length)}/${prodCruises.length}`);
      }

      console.log('✅ Cruises copied to staging');

      // Verify counts
      const stagingCount = await stagingSql`SELECT COUNT(*) as count FROM cruises`;
      console.log(`Staging now has ${stagingCount[0].count} cruises`);

    } else {
      // Interactive mode
      console.log('What would you like to copy?');
      console.log('1. Specific cruise: --cruise=2144014');
      console.log('2. Sample of cruises: --sample=1000');
      console.log('3. All cruises with raw_data (NOT RECOMMENDED): --all');
      console.log();
      console.log('Example: node copy-prod-to-staging.js --sample=500');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prodSql.end();
    await stagingSql.end();
  }
}

if (args.includes('--help')) {
  console.log('Usage: node copy-prod-to-staging.js [options]');
  console.log();
  console.log('Options:');
  console.log('  --cruise=ID   Copy specific cruise');
  console.log('  --sample=N    Copy N cruises with raw_data');
  console.log('  --help        Show this help');
  process.exit(0);
}

// Warning
console.log('⚠️  WARNING: This will modify STAGING database!');
console.log('Source: PRODUCTION');
console.log('Target: STAGING');

if (!SPECIFIC_CRUISE && !SAMPLE_SIZE) {
  copyData();
} else {
  console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...');
  setTimeout(copyData, 3000);
}
