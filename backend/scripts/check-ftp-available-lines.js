const ftp = require('basic-ftp');

async function checkAvailableLines() {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    // Connect to FTP
    const ftpConfig = {
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER || process.env.FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD || process.env.FTP_PASSWORD,
      secure: false,
      timeout: 30000,
    };

    console.log('Connecting to FTP...');
    await client.access(ftpConfig);
    console.log('Connected!\n');

    const year = 2025;
    const month = '09';
    const basePath = `/${year}/${month}`;

    console.log(`Checking ${basePath} for available lines...`);

    try {
      const items = await client.list(basePath);
      const lineDirectories = items.filter(item =>
        item.type === 2 && /^\d+$/.test(item.name)
      ).map(item => parseInt(item.name));

      console.log(`\nFound ${lineDirectories.length} cruise lines with data:`);
      console.log(lineDirectories.sort((a, b) => a - b).join(', '));

      // Check a few lines for file counts
      console.log('\n=== Checking file counts for sample lines ===\n');

      for (const lineId of lineDirectories.slice(0, 5)) {
        const linePath = `${basePath}/${lineId}`;
        try {
          const shipDirs = await client.list(linePath);
          let totalFiles = 0;

          for (const shipDir of shipDirs) {
            if (shipDir.type === 2) {
              const shipPath = `${linePath}/${shipDir.name}`;
              const files = await client.list(shipPath);
              const jsonFiles = files.filter(f => f.type === 1 && f.name.endsWith('.json'));
              totalFiles += jsonFiles.length;
            }
          }

          console.log(`Line ${lineId}: ${shipDirs.length} ships, ${totalFiles} cruise files`);
        } catch (error) {
          console.log(`Line ${lineId}: Error - ${error.message}`);
        }
      }

    } catch (error) {
      console.error(`Error listing ${basePath}:`, error.message);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
    console.log('\nFTP connection closed');
  }
}

// Load env and run
require('dotenv').config();
checkAvailableLines();
