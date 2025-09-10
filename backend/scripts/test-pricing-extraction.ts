import { Client } from 'basic-ftp';
import { getCruiseDataProcessor } from '../src/services/cruise-data-processor.service';
import dotenv from 'dotenv';

dotenv.config();

async function testPricingExtraction() {
  const client = new Client();
  const processor = getCruiseDataProcessor();

  try {
    console.log('Connecting to FTP...');
    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false,
    });

    // Download a sample file
    const samplePath = '/2025/09/10/54/2184963.json';
    const localPath = '/tmp/test-cruise.json';

    console.log(`Downloading ${samplePath}...`);
    await client.downloadTo(localPath, samplePath);

    // Read and parse the file
    const fs = await import('fs');
    const content = await fs.promises.readFile(localPath, 'utf-8');
    const cruiseData = JSON.parse(content);

    console.log('\n=== CRUISE DATA ANALYSIS ===');
    console.log('Cruise ID:', cruiseData.codetocruiseid);
    console.log('Has prices field:', !!cruiseData.prices);
    console.log('Has cheapest.prices field:', !!(cruiseData.cheapest && cruiseData.cheapest.prices));

    if (cruiseData.cheapest && cruiseData.cheapest.prices) {
      const rateCodes = Object.keys(cruiseData.cheapest.prices);
      console.log('Rate codes found:', rateCodes.length);

      if (rateCodes.length > 0) {
        const firstRate = rateCodes[0];
        const cabins = cruiseData.cheapest.prices[firstRate];
        const cabinCodes = Object.keys(cabins || {});
        console.log(`First rate "${firstRate}" has ${cabinCodes.length} cabins`);

        if (cabinCodes.length > 0) {
          const firstCabin = cabinCodes[0];
          const cabinData = cabins[firstCabin];
          console.log(`\nSample cabin "${firstCabin}":`);
          console.log('- price:', cabinData.price);
          console.log('- taxes:', cabinData.taxes);
          console.log('- adultprice:', cabinData.adultprice);
        }
      }
    }

    console.log('\n=== PROCESSING CRUISE DATA ===');
    const result = await processor.processCruiseData(cruiseData);

    console.log('Processing result:', result);

    // Check database for pricing records
    const { db } = await import('../src/db/connection');
    const { pricing } = await import('../src/db/schema');
    const { eq } = await import('drizzle-orm');

    const pricingRecords = await db
      .select()
      .from(pricing)
      .where(eq(pricing.cruiseId, cruiseData.codetocruiseid.toString()))
      .limit(10);

    console.log(`\n=== DATABASE CHECK ===`);
    console.log(`Found ${pricingRecords.length} pricing records for cruise ${cruiseData.codetocruiseid}`);

    if (pricingRecords.length > 0) {
      console.log('\nSample pricing record:');
      const sample = pricingRecords[0];
      console.log('- Rate code:', sample.rateCode);
      console.log('- Cabin code:', sample.cabinCode);
      console.log('- Base price:', sample.basePrice);
      console.log('- Total price:', sample.totalPrice);
    }

    // Clean up
    await fs.promises.unlink(localPath).catch(() => {});

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
    process.exit(0);
  }
}

testPricingExtraction();
