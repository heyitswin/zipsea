const https = require('https');

async function testUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode);
    }).on('error', (err) => {
      resolve('ERROR');
    });
  });
}

async function testCabinImages() {
  console.log('Testing cabin image URLs from Viking cruise 2069648...\n');

  // Get cruise data
  const cruiseData = await new Promise((resolve) => {
    https.get('https://api.zipsea.com/api/cruises/2069648/comprehensive', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
  });

  const cabinCategories = cruiseData.data.cabinCategories;

  console.log(`Found ${cabinCategories.length} cabin categories\n`);

  let hdWorking = 0;
  let hdBroken = 0;
  let regularWorking = 0;
  let regularBroken = 0;

  for (const cabin of cabinCategories) {
    console.log(`\n${cabin.name}:`);

    if (cabin.imageUrl) {
      const status = await testUrl(cabin.imageUrl);
      console.log(`  Regular: ${cabin.imageUrl}`);
      console.log(`    → ${status === 200 ? '✅' : '❌'} ${status}`);
      if (status === 200) regularWorking++;
      else regularBroken++;
    }

    if (cabin.imageUrlHd) {
      const status = await testUrl(cabin.imageUrlHd);
      console.log(`  HD:      ${cabin.imageUrlHd}`);
      console.log(`    → ${status === 200 ? '✅' : '❌'} ${status}`);
      if (status === 200) hdWorking++;
      else hdBroken++;
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Regular URLs: ${regularWorking} working, ${regularBroken} broken`);
  console.log(`HD URLs:      ${hdWorking} working, ${hdBroken} broken`);

  console.log('\n=== CONCLUSION ===');
  if (regularWorking > hdWorking) {
    console.log('✅ Frontend fix is correct: Regular URLs work better than HD URLs');
    console.log('   The fix to prefer imageUrl over imageUrlHd will solve the broken images.');
  } else {
    console.log('❌ Unexpected: HD URLs work better than regular URLs');
  }
}

testCabinImages();
