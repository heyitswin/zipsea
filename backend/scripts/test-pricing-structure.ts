import { Client } from 'basic-ftp';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
  const client = new Client();

  try {
    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST,
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false,
    });

    const localPath = '/tmp/test.json';
    await client.downloadTo(localPath, '/2025/09/10/54/2184963.json');

    const fs = await import('fs');
    const content = await fs.promises.readFile(localPath, 'utf-8');
    const data = JSON.parse(content);

    console.log('\n=== PRICING STRUCTURE ===');

    // Check cheapest.prices structure
    if (data.cheapest && data.cheapest.prices) {
      const keys = Object.keys(data.cheapest.prices);
      console.log('cheapest.prices keys:', keys);

      // Check what each key contains
      for (const key of keys.slice(0, 2)) {
        const value = data.cheapest.prices[key];
        console.log(`\n${key}:`, value);
      }
    }

    await fs.promises.unlink(localPath);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
  }
}

test();
