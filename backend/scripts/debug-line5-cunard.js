#!/usr/bin/env node

/**
 * Debug Line 5 (Cunard) Issue
 *
 * Investigates why webhooks for Cunard (line 5) are getting 0% success rates
 */

const ftp = require('basic-ftp');

const logger = {
  info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args)
};

async function debugLine5Issue() {
  logger.info('🔍 DEBUGGING LINE 5 (CUNARD) WEBHOOK PROCESSING ISSUE');
  logger.info('='.repeat(80));

  const results = {
    ftpConnection: false,
    line5DirectoryExists: false,
    line5HasFiles: false,
    samplePaths: [],
    pathStructure: null,
    errors: []
  };

  let client = null;

  try {
    // Test FTP connection
    logger.info('🔌 Testing FTP connection...');
    client = new ftp.Client();
    client.ftp.verbose = false;

    await client.access({
      host: process.env.TRAVELTEK_FTP_HOST,
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false
    });

    results.ftpConnection = true;
    logger.info('✅ FTP connection successful');

    // Check current directory structure
    logger.info('\n📁 Checking FTP directory structure...');
    const currentDir = await client.pwd();
    logger.info(`Current directory: ${currentDir}`);

    // List root directories (years)
    const rootList = await client.list('/');
    const years = rootList.filter(item => item.type === 2 && item.name.match(/^\d{4}$/));
    logger.info(`Available years: ${years.map(y => y.name).join(', ')}`);

    // Check 2025 structure
    if (years.some(y => y.name === '2025')) {
      logger.info('\n📅 Checking 2025 structure...');
      const monthsList = await client.list('/2025');
      const months = monthsList.filter(item => item.type === 2 && item.name.match(/^\d{2}$/));
      logger.info(`Available months in 2025: ${months.map(m => m.name).join(', ')}`);

      // Check current month (September = 09)
      const currentMonth = '09';
      if (months.some(m => m.name === currentMonth)) {
        logger.info(`\n📆 Checking 2025/${currentMonth} structure...`);
        const linesList = await client.list(`/2025/${currentMonth}`);
        const lines = linesList.filter(item => item.type === 2);
        logger.info(`Available cruise lines in 2025/${currentMonth}: ${lines.map(l => l.name).join(', ')}`);

        // Check if line 5 exists
        const line5Exists = lines.some(l => l.name === '5');
        results.line5DirectoryExists = line5Exists;

        if (line5Exists) {
          logger.info('✅ Line 5 (Cunard) directory EXISTS');

          // Check ships in line 5
          logger.info('\n🚢 Checking Cunard ships...');
          const shipsList = await client.list(`/2025/${currentMonth}/5`);
          const ships = shipsList.filter(item => item.type === 2);
          logger.info(`Cunard ships: ${ships.map(s => s.name).join(', ')}`);

          if (ships.length > 0) {
            // Check files in first ship
            const firstShip = ships[0].name;
            logger.info(`\n📋 Checking files for ship ${firstShip}...`);
            const filesList = await client.list(`/2025/${currentMonth}/5/${firstShip}`);
            const files = filesList.filter(item => item.type === 1 && item.name.endsWith('.json'));

            results.line5HasFiles = files.length > 0;
            results.samplePaths = files.slice(0, 5).map(f => `/2025/${currentMonth}/5/${firstShip}/${f.name}`);

            logger.info(`Files found: ${files.length}`);
            if (files.length > 0) {
              logger.info('✅ Cunard DOES have cruise files');
              logger.info('Sample file paths:');
              results.samplePaths.forEach(path => logger.info(`  - ${path}`));

              // Try to download a sample file
              logger.info('\n📥 Testing file download...');
              const samplePath = results.samplePaths[0];
              try {
                const downloadStream = new require('stream').Writable({
                  write(chunk, encoding, callback) {
                    callback();
                  }
                });

                let downloadedSize = 0;
                downloadStream.on('pipe', () => {
                  logger.info('📥 Download started...');
                });

                downloadStream._write = (chunk, encoding, callback) => {
                  downloadedSize += chunk.length;
                  callback();
                };

                await client.downloadTo(downloadStream, samplePath);
                logger.info(`✅ Successfully downloaded ${downloadedSize} bytes from ${samplePath}`);

              } catch (downloadError) {
                logger.error(`❌ Failed to download ${samplePath}: ${downloadError.message}`);
                results.errors.push(`Download failed: ${downloadError.message}`);
              }

            } else {
              logger.warn('❌ No cruise files found for Cunard');
            }

          } else {
            logger.warn('❌ No ships found for Cunard');
          }

        } else {
          logger.error('❌ Line 5 (Cunard) directory does NOT exist');
          logger.info('Available lines:', lines.map(l => l.name).join(', '));
        }

      } else {
        logger.error(`❌ Month ${currentMonth} directory does not exist`);
      }

    } else {
      logger.error('❌ Year 2025 directory does not exist');
    }

  } catch (error) {
    logger.error('❌ Debug failed:', error);
    results.errors.push(error.message);
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  }

  // Final diagnosis
  logger.info('\n' + '='.repeat(80));
  logger.info('🎯 DIAGNOSIS SUMMARY');
  logger.info('='.repeat(80));
  logger.info(`FTP Connection: ${results.ftpConnection ? '✅ Working' : '❌ Failed'}`);
  logger.info(`Line 5 Directory Exists: ${results.line5DirectoryExists ? '✅ Yes' : '❌ No'}`);
  logger.info(`Line 5 Has Files: ${results.line5HasFiles ? '✅ Yes' : '❌ No'}`);

  if (results.errors.length > 0) {
    logger.info('Errors encountered:');
    results.errors.forEach(err => logger.info(`  - ${err}`));
  }

  // Recommendations
  logger.info('\n🔧 RECOMMENDATIONS:');

  if (!results.ftpConnection) {
    logger.info('❌ CRITICAL: Fix FTP connection first');
  } else if (!results.line5DirectoryExists) {
    logger.info('❌ CRITICAL: Line 5 (Cunard) directory missing from FTP server');
    logger.info('   - Webhooks are being sent for non-existent cruise line');
    logger.info('   - Contact Traveltek to verify line 5 setup or disable line 5 webhooks');
  } else if (!results.line5HasFiles) {
    logger.info('❌ CRITICAL: Line 5 (Cunard) has no cruise files');
    logger.info('   - Directory exists but no actual cruise data');
    logger.info('   - Webhooks being sent for empty cruise line');
  } else {
    logger.info('✅ Line 5 (Cunard) files exist - problem is in processing logic');
    logger.info('   - Check bulk downloader path construction');
    logger.info('   - Check database queries for line 5 cruises');
    logger.info('   - Check for parsing errors in downloaded files');
  }

  return results;
}

// Run the debug
debugLine5Issue().catch(error => {
  logger.error('Debug script failed:', error);
  process.exit(1);
});
