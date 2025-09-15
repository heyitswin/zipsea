require('dotenv').config();
const Client = require('ftp');

async function checkPrincessFTP() {
  console.log('=== Checking FTP for Princess Cruises files ===\n');

  const ftp = new Client();

  try {
    await new Promise((resolve, reject) => {
      let timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);

      ftp.on('ready', () => {
        clearTimeout(timeout);
        resolve();
      });
      ftp.on('error', err => {
        clearTimeout(timeout);
        reject(err);
      });

      console.log('Connecting to FTP...');
      console.log(`  Host: ${process.env.TRAVELTEK_FTP_HOST}`);
      console.log(`  User: ${process.env.TRAVELTEK_FTP_USER}`);

      ftp.connect({
        host: process.env.TRAVELTEK_FTP_HOST,
        user: process.env.TRAVELTEK_FTP_USER,
        password: process.env.TRAVELTEK_FTP_PASSWORD,
        secure: false,
        connTimeout: 10000,
      });
    });

    console.log('✅ Connected to FTP\n');

    // Check 2025/09 directory
    console.log('Checking 2025/09 directory...');
    const yearMonth = await new Promise((resolve, reject) => {
      ftp.list('2025/09', (err, list) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(list);
      });
    });

    console.log(`Found ${yearMonth.length} cruise lines in 2025/09:`);
    const directories = yearMonth.filter(item => item.type === 'd');
    directories.slice(0, 30).forEach(dir => {
      console.log(`  Line ${dir.name}`);
    });

    // Check if line 20 exists
    const line20 = directories.find(d => d.name === '20');
    if (line20) {
      console.log('\n✅ Line 20 (Princess Cruises) exists');

      // List ships in line 20
      const ships = await new Promise((resolve, reject) => {
        ftp.list('2025/09/20', (err, list) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(list);
        });
      });

      console.log(`\nFound ${ships.length} ships for Princess Cruises:`);
      const shipDirs = ships.filter(item => item.type === 'd');
      shipDirs.forEach(ship => {
        console.log(`  Ship ${ship.name}`);
      });

      // Check if ship 4964 exists
      const ship4964 = shipDirs.find(d => d.name === '4964');
      if (ship4964) {
        console.log('\n✅ Ship 4964 (Enchanted Princess) exists');

        // List cruises for ship 4964
        const cruises = await new Promise((resolve, reject) => {
          ftp.list('2025/09/20/4964', (err, list) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(list);
          });
        });

        console.log(`\nFound ${cruises.length} cruise files for Enchanted Princess:`);
        const jsonFiles = cruises.filter(item => item.type === '-' && item.name.endsWith('.json'));

        // Show first 10 files
        jsonFiles.slice(0, 10).forEach(file => {
          console.log(`  ${file.name} (${file.size} bytes)`);
        });

        // Check for our specific cruise
        const cruise2173517 = jsonFiles.find(f => f.name === '2173517.json');
        if (cruise2173517) {
          console.log(`\n✅ Found 2173517.json (${cruise2173517.size} bytes)`);
        } else {
          console.log('\n❌ 2173517.json not found');
          console.log('All available cruise files:');
          jsonFiles.forEach(file => {
            console.log(`  ${file.name}`);
          });
        }
      } else {
        console.log('\n❌ Ship 4964 not found in directory');
      }
    } else {
      console.log('\n❌ Line 20 (Princess Cruises) not found in directory');
    }

    ftp.end();
    console.log('\n✅ FTP connection closed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    ftp.end();
    process.exit(1);
  }
}

checkPrincessFTP();
