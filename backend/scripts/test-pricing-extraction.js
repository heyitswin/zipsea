require('dotenv').config({ path: ['.env.local', '.env'] });

const { getCruiseDataProcessor } = require('../dist/services/cruise-data-processor.service');
const { ftpConnectionPool } = require('../dist/services/ftp-connection-pool.service');
const { db } = require('../dist/db');
const { pricing, cheapestPricing } = require('../dist/db/schema');
const { eq, count } = require('drizzle-orm');

async function testPricingExtraction() {
  console.log('='.repeat(60));
  console.log('Testing Pricing Extraction');
  console.log('='.repeat(60));

  const processor = getCruiseDataProcessor();
  const conn = await ftpConnectionPool.getConnection();

  try {
    // Use a cruise that has pricing data
    const testFile = '/2025/10/10/54/2092636.json';
    console.log(`\n📥 Downloading ${testFile}...`);

    const fs = require('fs');
    const tempFile = '/tmp/test-pricing-cruise.json';
    await conn.client.downloadTo(tempFile, testFile);

    const cruiseData = JSON.parse(fs.readFileSync(tempFile, 'utf-8'));
    console.log('\n📋 Cruise Data:');
    console.log(`  ID: ${cruiseData.codetocruiseid}`);
    console.log(`  Name: ${cruiseData.name}`);

    // Check current pricing records for this cruise
    const cruiseId = cruiseData.codetocruiseid;
    const beforeCount = await db
      .select({ count: count() })
      .from(pricing)
      .where(eq(pricing.cruiseId, cruiseId));

    console.log(`\n📊 Before Processing:`);
    console.log(`  Pricing records: ${beforeCount[0].count}`);

    // Process the cruise
    console.log('\n⚙️  Processing cruise data...');
    const result = await processor.processCruiseData(cruiseData);

    if (result.success) {
      console.log(`\n✅ Processing completed!`);

      // Check pricing records after processing
      const afterCount = await db
        .select({ count: count() })
        .from(pricing)
        .where(eq(pricing.cruiseId, cruiseId));

      console.log(`\n📊 After Processing:`);
      console.log(`  Pricing records: ${afterCount[0].count}`);

      // Get sample pricing records
      const samplePricing = await db
        .select()
        .from(pricing)
        .where(eq(pricing.cruiseId, cruiseId))
        .limit(3);

      console.log('\n📋 Sample Pricing Records:');
      samplePricing.forEach((p, i) => {
        console.log(`\n  Record ${i + 1}:`);
        console.log(`    Rate Code: ${p.rateCode}`);
        console.log(`    Cabin Code: ${p.cabinCode}`);
        console.log(`    Cabin Type: ${p.cabinType}`);
        console.log(`    Base Price: ${p.currency} ${p.basePrice}`);
        console.log(`    Adult Price: ${p.adultPrice}`);
        console.log(`    Taxes: ${p.taxes}`);
      });

      // Check cheapest pricing
      const cheapest = await db
        .select()
        .from(cheapestPricing)
        .where(eq(cheapestPricing.cruiseId, cruiseId))
        .limit(1);

      if (cheapest.length > 0) {
        console.log('\n💰 Cheapest Pricing:');
        console.log(`  Price: ${cheapest[0].currency} ${cheapest[0].price}`);
        console.log(`  Price Code: ${cheapest[0].priceCode}`);
      }
    } else {
      console.log(`\n❌ Processing failed: ${result.error}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    ftpConnectionPool.releaseConnection(conn);
    process.exit(0);
  }
}

testPricingExtraction();
