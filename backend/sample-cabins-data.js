const { Client } = require('pg');

async function sampleCabinsData() {
  const client = new Client({
    connectionString:
      'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000,
  });

  try {
    console.log('📸 SAMPLE OF cruises.cabins_data JSONB COLUMN\n');
    console.log('='.repeat(100));
    await client.connect();

    // Get a few cruises that have cabins_data
    const query = `
      SELECT
        id,
        name,
        cruise_line_id,
        ship_id,
        sailing_date,
        cabins_data
      FROM cruises
      WHERE cabins_data IS NOT NULL
        AND cabins_data::text != 'null'
        AND cabins_data::text != '{}'
        AND cabins_data::text != '[]'
        AND jsonb_typeof(cabins_data) = 'array'
      ORDER BY sailing_date DESC
      LIMIT 3
    `;

    const result = await client.query(query);

    if (result.rows.length === 0) {
      console.log('No cruises found with cabins_data');

      // Try to find any non-null cabins_data
      const altQuery = `
        SELECT
          id,
          name,
          cabins_data,
          jsonb_typeof(cabins_data) as data_type,
          pg_column_size(cabins_data::text) as size_bytes
        FROM cruises
        WHERE cabins_data IS NOT NULL
        LIMIT 5
      `;

      const altResult = await client.query(altQuery);
      console.log('\nChecking any non-null cabins_data:');
      altResult.rows.forEach(row => {
        console.log(`\nCruise ID: ${row.id}`);
        console.log(`Name: ${row.name}`);
        console.log(`Data type: ${row.data_type}`);
        console.log(`Size: ${row.size_bytes} bytes`);
        if (row.cabins_data) {
          const dataStr = JSON.stringify(row.cabins_data);
          console.log(`Sample: ${dataStr.substring(0, 200)}...`);
        }
      });
    } else {
      result.rows.forEach((cruise, index) => {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`CRUISE ${index + 1}: ${cruise.name}`);
        console.log(`Cruise ID: ${cruise.id}`);
        console.log(`Sailing Date: ${new Date(cruise.sailing_date).toDateString()}`);
        console.log(`-`.repeat(100));

        // Parse and format the cabins_data
        const cabinsData = cruise.cabins_data;

        if (Array.isArray(cabinsData)) {
          console.log(`\nNumber of cabin categories: ${cabinsData.length}`);

          // Show first 3 cabin categories
          cabinsData.slice(0, 3).forEach((cabin, cabinIndex) => {
            console.log(`\n  📁 CABIN CATEGORY ${cabinIndex + 1}:`);
            console.log('  ' + '-'.repeat(80));

            // Display all fields in a readable format
            Object.keys(cabin).forEach(key => {
              const value = cabin[key];

              if (key === 'images' && Array.isArray(value)) {
                console.log(`    ${key}:`);
                value.forEach((img, imgIndex) => {
                  console.log(`      Image ${imgIndex + 1}:`);
                  Object.keys(img).forEach(imgKey => {
                    console.log(`        ${imgKey}: ${img[imgKey]}`);
                  });
                });
              } else if (typeof value === 'object' && value !== null) {
                console.log(
                  `    ${key}: ${JSON.stringify(value, null, 2).split('\n').join('\n    ')}`
                );
              } else {
                console.log(`    ${key}: ${value}`);
              }
            });
          });

          if (cabinsData.length > 3) {
            console.log(`\n  ... and ${cabinsData.length - 3} more cabin categories`);
          }
        } else if (typeof cabinsData === 'object') {
          console.log('\nCabins data structure:');
          console.log(JSON.stringify(cabinsData, null, 2).substring(0, 2000));
        }
      });
    }

    // Also check the structure of the column
    console.log('\n\n📊 CABINS_DATA STRUCTURE ANALYSIS');
    console.log('='.repeat(100));

    const structureQuery = `
      SELECT
        COUNT(*) as total_cruises,
        COUNT(cabins_data) as has_cabins_data,
        COUNT(CASE WHEN cabins_data IS NOT NULL AND cabins_data::text != 'null' THEN 1 END) as non_null_data,
        COUNT(CASE WHEN jsonb_typeof(cabins_data) = 'array' THEN 1 END) as is_array,
        COUNT(CASE WHEN jsonb_typeof(cabins_data) = 'object' THEN 1 END) as is_object,
        COUNT(CASE WHEN cabins_data::text = '[]' THEN 1 END) as empty_array,
        COUNT(CASE WHEN cabins_data::text = '{}' THEN 1 END) as empty_object
      FROM cruises
    `;

    const structure = await client.query(structureQuery);
    const stats = structure.rows[0];

    console.log(`Total cruises: ${stats.total_cruises}`);
    console.log(`Has cabins_data column: ${stats.has_cabins_data}`);
    console.log(`Non-null data: ${stats.non_null_data}`);
    console.log(`Arrays: ${stats.is_array}`);
    console.log(`Objects: ${stats.is_object}`);
    console.log(`Empty arrays: ${stats.empty_array}`);
    console.log(`Empty objects: ${stats.empty_object}`);

    // Try to find a cruise with actual image URLs
    console.log('\n\n🖼️ SEARCHING FOR CABIN IMAGES');
    console.log('='.repeat(100));

    const imageQuery = `
      SELECT
        id,
        name,
        cabins_data
      FROM cruises
      WHERE cabins_data::text LIKE '%image%'
         OR cabins_data::text LIKE '%.jpg%'
         OR cabins_data::text LIKE '%.png%'
      LIMIT 2
    `;

    const imageResult = await client.query(imageQuery);

    if (imageResult.rows.length > 0) {
      imageResult.rows.forEach((cruise, idx) => {
        console.log(`\nCruise with images #${idx + 1}: ${cruise.name} (ID: ${cruise.id})`);
        const dataStr = JSON.stringify(cruise.cabins_data, null, 2);

        // Extract image URLs
        const imageUrls = dataStr.match(/https?:\/\/[^\s"]+\.(jpg|png|jpeg)/gi);
        if (imageUrls) {
          console.log('Found image URLs:');
          [...new Set(imageUrls)].forEach(url => {
            console.log(`  - ${url}`);
          });
        }

        // Show a sample of the structure
        console.log('\nFull structure sample:');
        console.log(dataStr.substring(0, 3000));
        if (dataStr.length > 3000) {
          console.log('... (truncated)');
        }
      });
    } else {
      console.log('No cruises found with image URLs in cabins_data');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
    console.log('\n✅ Done.');
  }
}

sampleCabinsData();
