/**
 * Try to find the cruise file in FTP
 */

const ftp = require('basic-ftp');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function findCruise() {
  const ftpClient = new ftp.Client();
  ftpClient.ftp.verbose = false;

  try {
    await ftpClient.access({
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER || 'CEP_9_USD',
      password: process.env.TRAVELTEK_FTP_PASSWORD || 'g#3PmbVn',
      secure: false,
    });

    console.log('Connected to FTP server\n');

    // List directories at root to understand structure
    console.log('Listing root directory:');
    const rootList = await ftpClient.list('/');
    rootList.slice(0, 10).forEach(item => {
      console.log(`  ${item.type === 2 ? '[DIR]' : '[FILE]'} ${item.name}`);
    });

    // Try to list 2025 directory
    console.log('\nListing /2025:');
    try {
      const year2025 = await ftpClient.list('/2025');
      year2025.slice(0, 10).forEach(item => {
        console.log(`  ${item.type === 2 ? '[DIR]' : '[FILE]'} ${item.name}`);
      });
    } catch (e) {
      console.log('  Error:', e.message);
    }

    // Try to list October 2025
    console.log('\nListing /2025/10:');
    try {
      const oct2025 = await ftpClient.list('/2025/10');
      oct2025.slice(0, 10).forEach(item => {
        console.log(`  ${item.type === 2 ? '[DIR]' : '[FILE]'} ${item.name}`);
      });
    } catch (e) {
      console.log('  Error:', e.message);
    }

    // Try various date formats
    const datePaths = ['/2025/10/06', '/2025/10/05', '/2025/10/07'];

    for (const datePath of datePaths) {
      console.log(`\nChecking ${datePath}:`);
      try {
        const dateList = await ftpClient.list(datePath);
        if (dateList.length > 0) {
          console.log(`  Found ${dateList.length} items`);
          // Check for cruise line 22 (Royal Caribbean)
          const line22 = dateList.find(item => item.name === '22');
          if (line22) {
            console.log('  ✅ Found cruise line 22 directory!');

            // List ships in line 22
            const shipsPath = `${datePath}/22`;
            console.log(`\n  Listing ${shipsPath}:`);
            const shipsList = await ftpClient.list(shipsPath);
            shipsList.slice(0, 10).forEach(ship => {
              console.log(`    ${ship.type === 2 ? '[DIR]' : '[FILE]'} ${ship.name}`);
            });

            // Look for ship 5457
            const ship5457 = shipsList.find(item => item.name === '5457');
            if (ship5457) {
              console.log('    ✅ Found ship 5457!');

              // List cruises in ship directory
              const cruisesPath = `${shipsPath}/5457`;
              console.log(`\n    Listing ${cruisesPath}:`);
              const cruisesList = await ftpClient.list(cruisesPath);
              cruisesList.slice(0, 10).forEach(cruise => {
                console.log(`      ${cruise.name}`);
              });

              // Look for our cruise
              const cruise2144014 = cruisesList.find(item => item.name === '2144014.json');
              if (cruise2144014) {
                console.log('      ✅ FOUND CRUISE 2144014.json!');
                console.log(`      Full path: ${cruisesPath}/2144014.json`);
              }
            }
          }
        }
      } catch (e) {
        console.log(`  Not found or error`);
      }
    }

    await ftpClient.close();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

findCruise();
