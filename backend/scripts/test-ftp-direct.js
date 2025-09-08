const ftp = require('basic-ftp');

async function testDirectFtp() {
  console.log('Testing FTP with direct credentials (no env vars)...\n');

  const client = new ftp.Client();
  client.ftp.verbose = true;

  try {
    // Use the exact credentials
    await client.access({
      host: 'ftpeu1prod.traveltek.net',
      user: 'CEP_9_USD',
      password: 'm#?jRSY3K$y!9r3?', // Exact password with special chars
      secure: false,
    });

    console.log('✅ CONNECTION SUCCESSFUL!');

    const list = await client.list('/');
    console.log(`Found ${list.length} items in root`);

    // Try to navigate to current month
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    await client.cd(`/${year}/${month}`);
    const monthList = await client.list();
    console.log(`Found ${monthList.length} cruise lines in /${year}/${month}`);
  } catch (error) {
    console.log('❌ Failed:', error.message);
  } finally {
    client.close();
  }
}

testDirectFtp();
