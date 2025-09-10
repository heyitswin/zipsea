const ftp = require('basic-ftp');

async function checkLine14Files() {
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

    const lineId = 14;
    const currentDate = new Date();
    const filesFound = [];

    // Check current year and next 6 months
    for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
      const checkDate = new Date(currentDate);
      checkDate.setMonth(checkDate.getMonth() + monthOffset);

      const year = checkDate.getFullYear();
      const month = (checkDate.getMonth() + 1).toString().padStart(2, '0');
      const linePath = `/${year}/${month}/${lineId}`;

      try {
        console.log(`Checking ${linePath}...`);
        const shipDirs = await client.list(linePath);

        if (shipDirs.length === 0) {
          console.log(`  No ships found in ${linePath}`);
          continue;
        }

        console.log(`  Found ${shipDirs.length} ships`);

        // Check each ship directory
        for (const shipDir of shipDirs) {
          if (shipDir.type === 2) { // Directory
            const shipPath = `${linePath}/${shipDir.name}`;
            console.log(`    Checking ship ${shipDir.name}...`);

            const cruiseFiles = await client.list(shipPath);
            const jsonFiles = cruiseFiles.filter(f => f.type === 1 && f.name.endsWith('.json'));

            console.log(`      Found ${jsonFiles.length} cruise files`);

            // Add first few files to our list
            jsonFiles.slice(0, 3).forEach(file => {
              filesFound.push({
                path: `${shipPath}/${file.name}`,
                size: file.size,
                modifiedAt: file.modifiedAt,
                cruiseId: file.name.replace('.json', ''),
                shipId: shipDir.name,
                year,
                month
              });
            });
          }
        }
      } catch (error) {
        console.log(`  Error accessing ${linePath}: ${error.message}`);
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total files found (sample): ${filesFound.length}`);

    if (filesFound.length > 0) {
      console.log('\nSample files:');
      filesFound.slice(0, 10).forEach(file => {
        console.log(`  ${file.path}`);
        console.log(`    Size: ${file.size} bytes`);
        console.log(`    Modified: ${file.modifiedAt}`);
        console.log(`    Cruise ID: ${file.cruiseId}`);
        console.log('');
      });
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
checkLine14Files();
