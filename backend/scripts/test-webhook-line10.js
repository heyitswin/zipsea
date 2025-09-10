const ftp = require('basic-ftp');
const { Pool } = require('pg');

async function testLine10Processing() {
  const dbPool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://zipsea_user:aOLItWeqKie3hDgFOd2k8wjJNU2KtLVd@dpg-d2idqjjipnbc73abma3g-a.oregon-postgres.render.com/zipsea_db',
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    console.log('Connecting to FTP...');
    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER || process.env.FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD || process.env.FTP_PASSWORD,
      secure: false,
      timeout: 10000,
    });

    const lineId = 10;
    const linePath = `/2025/09/${lineId}`;

    console.log(`\nDiscovering files for line ${lineId}...`);
    const shipDirs = await client.list(linePath);
    console.log(`Found ${shipDirs.length} ships`);

    let totalFiles = 0;
    let processedFiles = 0;
    let updatedCruises = 0;

    // Process first ship only for quick test
    for (const shipDir of shipDirs.slice(0, 1)) {
      if (shipDir.type === 2) {
        const shipPath = `${linePath}/${shipDir.name}`;
        const cruiseFiles = await client.list(shipPath);
        const jsonFiles = cruiseFiles.filter(f => f.type === 1 && f.name.endsWith('.json'));

        console.log(`\nShip ${shipDir.name}: ${jsonFiles.length} cruise files`);
        totalFiles += jsonFiles.length;

        // Process first 2 files only
        for (const file of jsonFiles.slice(0, 2)) {
          const filePath = `${shipPath}/${file.name}`;
          console.log(`\nProcessing ${file.name}...`);

          try {
            // Download file to buffer
            const chunks = [];
            const { Writable } = require('stream');
            const writeStream = new Writable({
              write(chunk, encoding, callback) {
                chunks.push(chunk);
                callback();
              },
            });

            await client.downloadTo(writeStream, filePath);
            const data = JSON.parse(Buffer.concat(chunks).toString());

            console.log(`  Downloaded ${Buffer.concat(chunks).length} bytes`);
            console.log(`  Cruise ID: ${data.id || data.codetocruiseid || 'unknown'}`);
            console.log(`  Name: ${data.name || data.title || 'unknown'}`);

            // Check if cruise exists
            const cruiseId = data.id || data.codetocruiseid || file.name.replace('.json', '');
            const existingResult = await dbPool.query(
              'SELECT id, name, updated_at FROM cruises WHERE id = $1',
              [cruiseId]
            );

            if (existingResult.rows.length > 0) {
              console.log(`  Cruise exists: ${existingResult.rows[0].name}`);
              console.log(`  Last updated: ${existingResult.rows[0].updated_at}`);

              // Update the cruise
              await dbPool.query(
                `UPDATE cruises
                 SET name = $1, updated_at = CURRENT_TIMESTAMP, raw_data = $2
                 WHERE id = $3`,
                [data.name || data.title || 'Unknown', JSON.stringify(data), cruiseId]
              );
              console.log(`  ✅ Updated cruise ${cruiseId}`);
            } else {
              // Insert new cruise
              const sailingDate = data.embarkDate || data.sailingdate || new Date().toISOString().split('T')[0];

              await dbPool.query(
                `INSERT INTO cruises (id, cruise_id, name, cruise_line_id, ship_id, nights, sailing_date, embarkation_port_id, disembarkation_port_id, raw_data, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [
                  cruiseId,
                  data.cruiseid || data.cruise_id,
                  data.name || data.title || 'Unknown',
                  lineId,
                  parseInt(shipDir.name) || 0,
                  parseInt(data.nights || 0),
                  sailingDate,
                  data.embarkportid || 0,
                  data.disembarkportid || 0,
                  JSON.stringify(data)
                ]
              );
              console.log(`  ✅ Inserted new cruise ${cruiseId}`);
            }

            updatedCruises++;
            processedFiles++;

            // Check for pricing
            const pricing = data.prices || data.pricing || data.cabins;
            if (pricing) {
              console.log(`  Has pricing data: ${Array.isArray(pricing) ? pricing.length + ' cabins' : 'yes'}`);
            }

          } catch (error) {
            console.error(`  ❌ Error processing ${file.name}:`, error.message);
          }
        }
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total files found: ${totalFiles}`);
    console.log(`Files processed: ${processedFiles}`);
    console.log(`Cruises updated: ${updatedCruises}`);

    // Check final state
    const finalResult = await dbPool.query(
      `SELECT COUNT(*) as total,
              COUNT(CASE WHEN updated_at > CURRENT_TIMESTAMP - INTERVAL '1 minute' THEN 1 END) as recently_updated
       FROM cruises
       WHERE cruise_line_id = 10`
    );

    console.log(`\nDatabase state for line 10:`);
    console.log(`  Total cruises: ${finalResult.rows[0].total}`);
    console.log(`  Updated in last minute: ${finalResult.rows[0].recently_updated}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
    await dbPool.end();
    console.log('\nConnections closed');
  }
}

// Load env and run
require('dotenv').config();
testLine10Processing();
