#!/usr/bin/env node

/**
 * Discover the actual FTP directory structure
 */

require('dotenv').config();
const FTP = require('ftp');

const ftpConfig = {
  host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
  user: process.env.TRAVELTEK_FTP_USER,
  password: process.env.TRAVELTEK_FTP_PASSWORD,
  port: 21,
  secure: false,
  connTimeout: 30000,
  pasvTimeout: 30000
};

console.log('🔍 Discovering FTP Structure');
console.log('=============================\n');
console.log('Host:', ftpConfig.host);
console.log('User:', ftpConfig.user ? ftpConfig.user.substring(0, 3) + '***' : 'NOT SET');
console.log('\n');

async function listDirectory(client, dirPath) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('List timeout')), 15000);
    
    client.list(dirPath, (err, list) => {
      clearTimeout(timeout);
      if (err) reject(err);
      else resolve(list || []);
    });
  });
}

async function discover() {
  const client = new FTP();
  
  return new Promise((resolve, reject) => {
    client.on('ready', async () => {
      console.log('✅ Connected to FTP\n');
      
      try {
        // List root directory
        console.log('📁 ROOT DIRECTORY:');
        console.log('─'.repeat(40));
        const rootFiles = await listDirectory(client, '/');
        rootFiles.forEach(item => {
          console.log(`   ${item.type === 'd' ? '📂' : '📄'} ${item.name} (${item.type})`);
        });
        
        // Try different path variations
        console.log('\n🔍 TESTING PATH VARIATIONS:');
        console.log('─'.repeat(40));
        
        const pathsToTest = [
          '/',
          '.',
          '2025',
          '/2025',
          './2025',
          '2025/1',
          '2025/01',
          '/2025/1',
          '/2025/01',
          'cruises',
          '/cruises',
          'data',
          '/data',
          'ftp',
          '/ftp'
        ];
        
        for (const path of pathsToTest) {
          try {
            const files = await listDirectory(client, path);
            if (files.length > 0) {
              console.log(`\n✅ Found "${path}":`);
              // Show first 5 items
              files.slice(0, 5).forEach(item => {
                console.log(`     ${item.type === 'd' ? '📂' : '📄'} ${item.name}`);
              });
              if (files.length > 5) {
                console.log(`     ... and ${files.length - 5} more items`);
              }
            }
          } catch (err) {
            console.log(`❌ "${path}": ${err.message}`);
          }
        }
        
        // If we found directories in root, explore them
        console.log('\n📂 EXPLORING DIRECTORIES:');
        console.log('─'.repeat(40));
        
        const dirsToExplore = rootFiles
          .filter(f => f.type === 'd')
          .slice(0, 5); // Explore first 5 directories
        
        for (const dir of dirsToExplore) {
          console.log(`\n📂 Exploring "${dir.name}":`);
          try {
            const subFiles = await listDirectory(client, `/${dir.name}`);
            subFiles.slice(0, 5).forEach(item => {
              console.log(`     ${item.type === 'd' ? '📂' : '📄'} ${item.name}`);
            });
            if (subFiles.length > 5) {
              console.log(`     ... and ${subFiles.length - 5} more items`);
            }
            
            // If this looks like a year directory, explore months
            if (/^\d{4}$/.test(dir.name)) {
              console.log(`   📅 This looks like a year directory!`);
              const monthDirs = subFiles.filter(f => f.type === 'd').slice(0, 3);
              
              for (const monthDir of monthDirs) {
                console.log(`\n   📆 Exploring ${dir.name}/${monthDir.name}:`);
                try {
                  const monthFiles = await listDirectory(client, `/${dir.name}/${monthDir.name}`);
                  monthFiles.slice(0, 3).forEach(item => {
                    console.log(`        ${item.type === 'd' ? '📂' : '📄'} ${item.name}`);
                  });
                  
                  // If we find cruise line directories, explore one
                  const lineDirs = monthFiles.filter(f => f.type === 'd').slice(0, 1);
                  for (const lineDir of lineDirs) {
                    console.log(`\n      🚢 Exploring ${dir.name}/${monthDir.name}/${lineDir.name}:`);
                    try {
                      const lineFiles = await listDirectory(client, `/${dir.name}/${monthDir.name}/${lineDir.name}`);
                      lineFiles.slice(0, 3).forEach(item => {
                        console.log(`           ${item.type === 'd' ? '📂' : '📄'} ${item.name}`);
                      });
                      
                      // Check for ship directories
                      const shipDirs = lineFiles.filter(f => f.type === 'd').slice(0, 1);
                      for (const shipDir of shipDirs) {
                        console.log(`\n         ⚓ Exploring ${dir.name}/${monthDir.name}/${lineDir.name}/${shipDir.name}:`);
                        try {
                          const shipFiles = await listDirectory(client, `/${dir.name}/${monthDir.name}/${lineDir.name}/${shipDir.name}`);
                          const jsonFiles = shipFiles.filter(f => f.name.endsWith('.json'));
                          console.log(`            Found ${jsonFiles.length} JSON files`);
                          jsonFiles.slice(0, 3).forEach(item => {
                            console.log(`              📄 ${item.name}`);
                          });
                        } catch (e) {
                          console.log(`            ❌ Error: ${e.message}`);
                        }
                      }
                    } catch (e) {
                      console.log(`        ❌ Error: ${e.message}`);
                    }
                  }
                } catch (e) {
                  console.log(`      ❌ Error: ${e.message}`);
                }
              }
            }
          } catch (e) {
            console.log(`   ❌ Error: ${e.message}`);
          }
        }
        
        client.end();
        resolve();
        
      } catch (error) {
        console.error('Discovery error:', error);
        client.end();
        reject(error);
      }
    });
    
    client.on('error', (err) => {
      console.error('FTP error:', err.message);
      reject(err);
    });
    
    client.connect(ftpConfig);
  });
}

// Run discovery
discover()
  .then(() => {
    console.log('\n✨ Discovery complete!');
    console.log('\n📝 NEXT STEPS:');
    console.log('1. Update sync scripts with the correct FTP paths');
    console.log('2. Ensure paths include leading slash if needed');
    console.log('3. Check if year/month format needs leading zeros');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal:', error.message);
    process.exit(1);
  });