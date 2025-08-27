const ftp = require('basic-ftp');

async function testFTP() {
  const client = new ftp.Client();
  client.ftp.verbose = true;
  
  try {
    console.log('Connecting to FTP...');
    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST || 'ftp.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false
    });
    
    console.log('Connected! Testing paths...');
    
    // Test current month path for line 1
    const testPath = '2025/08/1';
    console.log(`\nTesting path: ${testPath}`);
    
    const list = await client.list(testPath);
    console.log(`Found ${list.length} items in ${testPath}:`);
    list.slice(0, 5).forEach(item => {
      console.log(`  - ${item.name} (${item.type === 2 ? 'directory' : 'file'})`);
    });
    
    // Try to list a ship directory
    if (list.length > 0 && list[0].type === 2) {
      const shipPath = `${testPath}/${list[0].name}`;
      console.log(`\nChecking ship directory: ${shipPath}`);
      const shipFiles = await client.list(shipPath);
      console.log(`Found ${shipFiles.length} files`);
      shipFiles.slice(0, 3).forEach(f => {
        console.log(`    - ${f.name}`);
      });
    }
    
  } catch (err) {
    console.error('FTP Error:', err);
  } finally {
    client.close();
  }
}

testFTP();