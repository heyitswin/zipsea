/**
 * Fix missing or broken ship images by re-syncing from FTP
 * Only updates ships with NULL images or specific broken images
 */

const { db } = require('../dist/db/connection');
const { ships } = require('../dist/db/schema');
const { sql } = require('drizzle-orm');
const ftp = require('basic-ftp');

async function fixMissingShipImages() {
  console.log('🔍 Finding ships with missing or broken images...');

  // Get ships with NULL images or known broken images
  const brokenShips = await db.execute(sql`
    SELECT DISTINCT
      s.id,
      s.name,
      s.cruise_line_id,
      s.default_ship_image,
      COUNT(c.id) as cruise_count
    FROM ships s
    INNER JOIN cruises c ON c.ship_id = s.id
    WHERE c.start_date >= CURRENT_DATE
      AND c.is_active = true
      AND (s.default_ship_image IS NULL OR s.default_ship_image = '')
    GROUP BY s.id, s.name, s.cruise_line_id, s.default_ship_image
    ORDER BY cruise_count DESC
  `);

  const shipsToFix = brokenShips?.rows || brokenShips || [];
  console.log(`📊 Found ${shipsToFix.length} ships with missing images`);

  if (shipsToFix.length === 0) {
    console.log('✅ No ships need fixing!');
    return;
  }

  // Connect to FTP
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    console.log('🔌 Connecting to FTP...');
    await client.access({
      host: 'ftpeu1prod.traveltek.net',
      user: 'CEP_9_USD',
      password: 'Random7767!',
      secure: false,
    });

    let fixed = 0;
    let errors = 0;

    for (const ship of shipsToFix) {
      try {
        console.log(`\n🚢 Processing ${ship.name} (ID: ${ship.id}, ${ship.cruise_count} cruises)`);

        // Find a recent cruise file for this ship
        const cruiseFile = await findRecentCruiseFile(client, ship.cruise_line_id, ship.id);

        if (!cruiseFile) {
          console.log(`  ⚠️  No cruise files found`);
          errors++;
          continue;
        }

        console.log(`  📄 Found cruise file: ${cruiseFile.path}`);

        // Download and parse the cruise file
        const cruiseData = await downloadCruiseFile(client, cruiseFile.path);

        if (!cruiseData?.shipcontent?.defaultshipimage) {
          console.log(`  ⚠️  No ship images in cruise file`);
          errors++;
          continue;
        }

        // Update the ship with new images
        await db.execute(sql`
          UPDATE ships
          SET
            default_ship_image = ${cruiseData.shipcontent.defaultshipimage},
            default_ship_image_hd = ${cruiseData.shipcontent.defaultshipimagehd || cruiseData.shipcontent.defaultshipimage},
            default_ship_image_2k = ${cruiseData.shipcontent.defaultshipimage2k || cruiseData.shipcontent.defaultshipimage},
            raw_ship_content = ${JSON.stringify(cruiseData.shipcontent)}::jsonb,
            updated_at = NOW()
          WHERE id = ${ship.id}
        `);

        console.log(`  ✅ Updated ship images`);
        console.log(`     ${cruiseData.shipcontent.defaultshipimage.substring(0, 80)}...`);
        fixed++;

      } catch (shipError) {
        console.error(`  ❌ Error processing ship ${ship.id}:`, shipError.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Fixed: ${fixed} ships`);
    console.log(`❌ Errors: ${errors} ships`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    client.close();
  }

  process.exit(0);
}

async function findRecentCruiseFile(client, lineId, shipId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  try {
    // Try current month first
    const path = `/${year}/${month}/${lineId}/${shipId}`;
    await client.cd(path);
    const files = await client.list();

    // Get first .json file
    const jsonFile = files.find(f => f.name.endsWith('.json'));
    if (jsonFile) {
      return {
        path: `${path}/${jsonFile.name}`,
        name: jsonFile.name,
      };
    }
  } catch (error) {
    // Try previous month if current month fails
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? year - 1 : year;

    try {
      const path = `/${prevYear}/${String(prevMonth).padStart(2, '0')}/${lineId}/${shipId}`;
      await client.cd(path);
      const files = await client.list();

      const jsonFile = files.find(f => f.name.endsWith('.json'));
      if (jsonFile) {
        return {
          path: `${path}/${jsonFile.name}`,
          name: jsonFile.name,
        };
      }
    } catch (e) {
      // No files found
    }
  }

  return null;
}

async function downloadCruiseFile(client, filepath) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const writable = require('stream').Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    writable.on('finish', () => {
      try {
        const content = Buffer.concat(chunks).toString('utf-8');
        const data = JSON.parse(content);
        resolve(data);
      } catch (error) {
        reject(new Error(`Failed to parse JSON: ${error.message}`));
      }
    });

    writable.on('error', reject);

    client
      .downloadTo(writable, filepath)
      .then(() => writable.end())
      .catch(reject);
  });
}

// Run the script
fixMissingShipImages().catch(console.error);
