import { Client } from 'basic-ftp';
import * as fs from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

async function testFileStructure() {
  const client = new Client();

  try {
    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false,
    });

    // Download a sample file - use one that exists
    const samplePath = '/2025/09/10/54/2184963.json';
    const localPath = '/tmp/sample-cruise.json';

    console.log(`Downloading sample file: ${samplePath}`);
    await client.downloadTo(localPath, samplePath);

    // Read and analyze the file
    const content = await fs.readFile(localPath, 'utf-8');

    console.log('\n=== FILE STRUCTURE ANALYSIS ===');
    console.log('File size:', content.length, 'bytes');
    console.log('First 100 chars:', content.substring(0, 100));

    // Try parsing as JSON
    try {
      const data = JSON.parse(content);
      console.log('\n✅ File is valid JSON');
      console.log('Top-level keys:', Object.keys(data).slice(0, 20));

      // Check for cruise ID
      console.log('\nCruise identification:');
      console.log('- codetocruiseid:', data.codetocruiseid);
      console.log('- cruise_id:', data.cruise_id);
      console.log('- id:', data.id);

      // Check for pricing data
      console.log('\nPricing data:');
      if (data.prices) {
        const rateCodes = Object.keys(data.prices);
        console.log('- Found "prices" field with', rateCodes.length, 'rate codes');

        if (rateCodes.length > 0) {
          const firstRate = rateCodes[0];
          const cabins = data.prices[firstRate];
          const cabinCodes = Object.keys(cabins);
          console.log(`- Rate code "${firstRate}" has ${cabinCodes.length} cabins`);

          if (cabinCodes.length > 0) {
            const firstCabin = cabinCodes[0];
            const cabinData = cabins[firstCabin];
            console.log(`- Sample cabin "${firstCabin}":`, {
              price: cabinData.price,
              taxes: cabinData.taxes,
              adultprice: cabinData.adultprice,
            });
          }
        }
      } else {
        console.log('- No "prices" field found');
      }

      // Check for cheapest pricing
      if (data.cheapest) {
        console.log('\nCheapest pricing:');
        console.log('- cheapest.combined:', data.cheapest.combined ? 'exists' : 'missing');
        console.log('- cheapest.prices:', data.cheapest.prices ? 'exists' : 'missing');

        if (data.cheapest.prices) {
          const cheapestPrices = data.cheapest.prices;
          console.log('- cheapest.prices structure:', typeof cheapestPrices);

          if (typeof cheapestPrices === 'object') {
            const rateCodes = Object.keys(cheapestPrices);
            console.log('- Rate codes in cheapest.prices:', rateCodes.length);

            if (rateCodes.length > 0) {
              const firstRate = rateCodes[0];
              console.log(`- First rate code: "${firstRate}"`);
              const rateData = cheapestPrices[firstRate];
              console.log('- Rate data structure:', typeof rateData);

              if (typeof rateData === 'object') {
                const cabinCodes = Object.keys(rateData);
                console.log(`- Cabin codes in rate "${firstRate}":`, cabinCodes.slice(0, 5));

                if (cabinCodes.length > 0) {
                  const firstCabin = cabinCodes[0];
                  const cabinData = rateData[firstCabin];
                  console.log(
                    `- Sample cabin "${firstCabin}" data:`,
                    JSON.stringify(cabinData, null, 2).substring(0, 200)
                  );
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.log('\n❌ File is NOT valid JSON:', error.message);

      // Try as JSONL
      const lines = content.split('\n').filter(line => line.trim());
      console.log('Trying as JSONL - found', lines.length, 'lines');

      let validLines = 0;
      for (const line of lines.slice(0, 5)) {
        try {
          JSON.parse(line);
          validLines++;
        } catch {}
      }
      console.log('Valid JSON lines:', validLines);
    }

    // Clean up
    await fs.unlink(localPath).catch(() => {});
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
  }
}

testFileStructure();
