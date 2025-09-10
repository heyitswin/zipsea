import { Client } from 'basic-ftp';
import dotenv from 'dotenv';

dotenv.config();

async function listFiles() {
  const client = new Client();

  try {
    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false,
    });

    // List files in today's directory
    const paths = [
      '/2025/09/10/',
      '/2025/09/10/54/',
      '/2025/09/10/9/'
    ];

    for (const path of paths) {
      try {
        console.log(`\nListing ${path}:`);
        const files = await client.list(path);
        console.log(`Found ${files.length} items`);

        // Show first 10 files
        for (const file of files.slice(0, 10)) {
          console.log(`  ${file.type === 2 ? '[DIR]' : '[FILE]'} ${file.name}`);
        }
      } catch (error) {
        console.log(`  Error: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
  }
}

listFiles();
