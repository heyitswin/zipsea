/**
 * Simplified copy script with better error handling
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prodUrl = 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db';
const stagingUrl = 'postgresql://zipsea_user:YROzJArXNhDGLj83p9xtVwhQb7oEmPIE@dpg-cslkgnq3esus73fb1du0-a.oregon-postgres.render.com/zipsea_db';

async function copyData() {
  let prodSql, stagingSql;

  try {
    console.log('Connecting to production...');
    prodSql = postgres(prodUrl, {
      ssl: { rejectUnauthorized: false },
      connection: {
        timeout: 30000 // 30 second timeout
      }
    });

    console.log('Connecting to staging...');
    stagingSql = postgres(stagingUrl, {
      ssl: { rejectUnauthorized: false },
      connection: {
        timeout: 30000
      }
    });

    // Test connections
    console.log('Testing production connection...');
    const prodTest = await prodSql`SELECT COUNT(*) as count FROM cruises WHERE is_active = true`;
    console.log(`Production has ${prodTest[0].count} active cruises`);

    console.log('Testing staging connection...');
    const stagingTest = await stagingSql`SELECT COUNT(*) as count FROM cruises`;
    console.log(`Staging currently has ${stagingTest[0].count} cruises`);

    // Get a smaller sample first
    console.log('\nFetching 100 cruises from production...');
    const prodCruises = await prodSql`
      SELECT *
      FROM cruises
      WHERE is_active = true
      AND raw_data IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 100
    `;

    console.log(`Fetched ${prodCruises.length} cruises`);

    if (prodCruises.length === 0) {
      console.log('No cruises found!');
      return;
    }

    console.log('\nClearing staging cruises table...');
    await stagingSql`TRUNCATE cruises CASCADE`;

    console.log('Inserting cruises to staging...');

    // Insert in smaller batches
    const batchSize = 10;
    for (let i = 0; i < prodCruises.length; i += batchSize) {
      const batch = prodCruises.slice(i, i + batchSize);
      await stagingSql`INSERT INTO cruises ${stagingSql(batch)}`;
      console.log(`Inserted ${Math.min(i + batchSize, prodCruises.length)}/${prodCruises.length}`);
    }

    console.log('\n✅ Successfully copied cruises to staging');

    // Verify
    const finalCount = await stagingSql`SELECT COUNT(*) as count FROM cruises`;
    console.log(`Staging now has ${finalCount[0].count} cruises`);

    // Show sample cruise
    const sample = await stagingSql`
      SELECT id, name, interior_price, oceanview_price, balcony_price, suite_price
      FROM cruises
      LIMIT 1
    `;

    if (sample.length > 0) {
      console.log('\nSample cruise:');
      console.log(`ID: ${sample[0].id}`);
      console.log(`Name: ${sample[0].name}`);
      console.log(`Prices: Interior=$${sample[0].interior_price}, Ocean=$${sample[0].oceanview_price}, Balcony=$${sample[0].balcony_price}, Suite=$${sample[0].suite_price}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (prodSql) await prodSql.end();
    if (stagingSql) await stagingSql.end();
  }
}

console.log('Starting copy process...\n');
copyData();
