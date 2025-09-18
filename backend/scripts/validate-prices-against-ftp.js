require('dotenv').config();
const { Pool } = require('pg');
const ftp = require('basic-ftp');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

async function validatePricesAgainstFTP() {
  console.log('=== CRUISE PRICE VALIDATION AGAINST FTP ===\n');
  console.log('Sampling cruises from each cruise line to validate prices...\n');

  const ftpClient = new ftp.Client();
  ftpClient.ftp.verbose = false;

  try {
    // Connect to FTP
    console.log('Connecting to FTP server...');
    await ftpClient.access({
      host: process.env.FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.FTP_USER || 'CEP_9_USD',
      password: process.env.FTP_PASSWORD,
      secure: false
    });
    console.log('✅ Connected to FTP\n');

    // Get sample cruises from each cruise line
    const sampleQuery = `
      WITH ranked_cruises AS (
        SELECT
          c.id,
          c.cruise_id,
          c.name,
          c.sailing_date,
          c.interior_price,
          c.oceanview_price,
          c.balcony_price,
          c.suite_price,
          c.cheapest_price,
          c.updated_at,
          cl.name as cruise_line,
          cl.id as cruise_line_id,
          ROW_NUMBER() OVER (PARTITION BY cl.id ORDER BY c.sailing_date DESC) as rn
        FROM cruises c
        JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        WHERE c.is_active = true
          AND c.sailing_date >= CURRENT_DATE
          AND c.sailing_date <= CURRENT_DATE + INTERVAL '6 months'
          AND c.cruise_id IS NOT NULL
      )
      SELECT * FROM ranked_cruises
      WHERE rn <= 5
      ORDER BY cruise_line, sailing_date
    `;

    const result = await pool.query(sampleQuery);
    console.log(`Found ${result.rows.length} sample cruises from ${new Set(result.rows.map(r => r.cruise_line)).size} cruise lines\n`);

    // Group by cruise line
    const cruisesByLine = {};
    result.rows.forEach(cruise => {
      if (!cruisesByLine[cruise.cruise_line]) {
        cruisesByLine[cruise.cruise_line] = [];
      }
      cruisesByLine[cruise.cruise_line].push(cruise);
    });

    // Validation results
    const validationResults = {
      totalChecked: 0,
      matches: 0,
      mismatches: 0,
      fileNotFound: 0,
      errors: 0,
      details: []
    };

    // Check each cruise line
    for (const [cruiseLine, cruises] of Object.entries(cruisesByLine)) {
      console.log(`\n${cruiseLine} (${cruises.length} cruises):`);
      console.log('=' .repeat(60));

      for (const cruise of cruises) {
        validationResults.totalChecked++;

        // Construct FTP file path (format: YYYY/MM/DD/shipcode/cruiseid.json)
        const sailingDate = new Date(cruise.sailing_date);
        const year = sailingDate.getFullYear();
        const month = String(sailingDate.getMonth() + 1).padStart(2, '0');
        const day = String(sailingDate.getDate()).padStart(2, '0');

        // Try to find the file - we need to get ship code
        const ftpBasePath = `/${year}/${month}/${day}`;
        let ftpData = null;
        let ftpFilePath = null;

        try {
          // List directories in the date folder to find the cruise
          const dirs = await ftpClient.list(ftpBasePath);

          // Search for the cruise file in each ship directory
          for (const dir of dirs) {
            if (dir.type === 2) { // Directory
              const possiblePath = `${ftpBasePath}/${dir.name}/${cruise.cruise_id}.json`;
              try {
                // Try to download the file
                const stream = await ftpClient.downloadToBuffer(possiblePath);
                ftpData = JSON.parse(stream.toString());
                ftpFilePath = possiblePath;
                break;
              } catch (e) {
                // File not in this directory, continue
              }
            }
          }

          if (!ftpData) {
            console.log(`  ❌ ${cruise.name} (${cruise.cruise_id})`);
            console.log(`     File not found on FTP`);
            console.log(`     Last synced: ${cruise.updated_at}`);
            validationResults.fileNotFound++;
            continue;
          }

          // Extract prices from FTP data
          const ftpPrices = {
            interior: ftpData.cheapestinside ? parseFloat(String(ftpData.cheapestinside)) : null,
            oceanview: ftpData.cheapestoutside ? parseFloat(String(ftpData.cheapestoutside)) : null,
            balcony: ftpData.cheapestbalcony ? parseFloat(String(ftpData.cheapestbalcony)) : null,
            suite: ftpData.cheapestsuite ? parseFloat(String(ftpData.cheapestsuite)) : null
          };

          // Compare prices
          const dbPrices = {
            interior: cruise.interior_price ? parseFloat(cruise.interior_price) : null,
            oceanview: cruise.oceanview_price ? parseFloat(cruise.oceanview_price) : null,
            balcony: cruise.balcony_price ? parseFloat(cruise.balcony_price) : null,
            suite: cruise.suite_price ? parseFloat(cruise.suite_price) : null
          };

          const priceMatch =
            dbPrices.interior === ftpPrices.interior &&
            dbPrices.oceanview === ftpPrices.oceanview &&
            dbPrices.balcony === ftpPrices.balcony &&
            dbPrices.suite === ftpPrices.suite;

          if (priceMatch) {
            console.log(`  ✅ ${cruise.name} (${cruise.cruise_id})`);
            console.log(`     Prices match! Interior: $${dbPrices.interior || 'N/A'}, Ocean: $${dbPrices.oceanview || 'N/A'}, Balcony: $${dbPrices.balcony || 'N/A'}, Suite: $${dbPrices.suite || 'N/A'}`);
            validationResults.matches++;
          } else {
            console.log(`  ⚠️  ${cruise.name} (${cruise.cruise_id})`);
            console.log(`     MISMATCH DETECTED!`);
            console.log(`     DB:  Interior: $${dbPrices.interior || 'N/A'}, Ocean: $${dbPrices.oceanview || 'N/A'}, Balcony: $${dbPrices.balcony || 'N/A'}, Suite: $${dbPrices.suite || 'N/A'}`);
            console.log(`     FTP: Interior: $${ftpPrices.interior || 'N/A'}, Ocean: $${ftpPrices.oceanview || 'N/A'}, Balcony: $${ftpPrices.balcony || 'N/A'}, Suite: $${ftpPrices.suite || 'N/A'}`);
            console.log(`     Last synced: ${cruise.updated_at}`);
            console.log(`     Hours since sync: ${Math.round((Date.now() - new Date(cruise.updated_at)) / (1000 * 60 * 60))}`);
            validationResults.mismatches++;

            validationResults.details.push({
              cruiseLine,
              cruiseId: cruise.cruise_id,
              name: cruise.name,
              dbPrices,
              ftpPrices,
              lastSync: cruise.updated_at,
              hoursSinceSync: Math.round((Date.now() - new Date(cruise.updated_at)) / (1000 * 60 * 60))
            });
          }

        } catch (error) {
          console.log(`  ❌ ${cruise.name} (${cruise.cruise_id})`);
          console.log(`     Error: ${error.message}`);
          validationResults.errors++;
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total cruises checked: ${validationResults.totalChecked}`);
    console.log(`✅ Matches: ${validationResults.matches} (${(validationResults.matches/validationResults.totalChecked*100).toFixed(1)}%)`);
    console.log(`⚠️  Mismatches: ${validationResults.mismatches} (${(validationResults.mismatches/validationResults.totalChecked*100).toFixed(1)}%)`);
    console.log(`📁 Files not found: ${validationResults.fileNotFound} (${(validationResults.fileNotFound/validationResults.totalChecked*100).toFixed(1)}%)`);
    console.log(`❌ Errors: ${validationResults.errors}`);

    if (validationResults.mismatches > 0) {
      console.log('\nMISMATCH ANALYSIS:');
      console.log('==================');

      // Group mismatches by sync age
      const recentSync = validationResults.details.filter(d => d.hoursSinceSync < 24);
      const oldSync = validationResults.details.filter(d => d.hoursSinceSync >= 24);

      console.log(`Recently synced (<24h) with mismatches: ${recentSync.length}`);
      console.log(`Old sync (>=24h) with mismatches: ${oldSync.length}`);

      if (recentSync.length > 0) {
        console.log('\n🚨 CRITICAL: Recent syncs with price mismatches (potential sync issue):');
        recentSync.forEach(d => {
          console.log(`   - ${d.cruiseLine}: ${d.name} (${d.cruiseId})`);
          console.log(`     Synced ${d.hoursSinceSync}h ago but prices don't match!`);
        });
      }

      if (oldSync.length > 0) {
        console.log('\n📅 Old syncs with mismatches (need re-sync):');
        oldSync.slice(0, 5).forEach(d => {
          console.log(`   - ${d.cruiseLine}: ${d.name} (${d.cruiseId})`);
          console.log(`     Last synced ${d.hoursSinceSync}h ago`);
        });
        if (oldSync.length > 5) {
          console.log(`   ... and ${oldSync.length - 5} more`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Validation failed:', error.message);
  } finally {
    ftpClient.close();
    await pool.end();
  }
}

validatePricesAgainstFTP().catch(console.error);
