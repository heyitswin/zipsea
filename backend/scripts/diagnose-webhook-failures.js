#!/usr/bin/env node

const { drizzle } = require('drizzle-orm/node-postgres');
const { eq, and, gte, sql } = require('drizzle-orm');
const { Client } = require('pg');
const ftp = require('basic-ftp');
require('dotenv').config();

// Import schema
const { cruises, cruiseLines } = require('../dist/db/schema');

const client = new Client({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION,
  ssl:
    process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('render.com')
      ? { rejectUnauthorized: false }
      : false,
});

const db = drizzle(client);

async function diagnoseCruiseLine(lineId) {
  const ftpClient = new ftp.Client();
  ftpClient.ftp.verbose = false;

  try {
    // Get cruise line info
    const [line] = await db.select().from(cruiseLines).where(eq(cruiseLines.id, lineId)).limit(1);

    if (!line) {
      console.error(`❌ Cruise line ${lineId} not found`);
      return;
    }

    console.log(`\n🚢 Analyzing Cruise Line: ${line.name} (ID: ${lineId})`);
    console.log('='.repeat(60));

    // Get all future cruises for this line
    const futureCruises = await db
      .select({
        id: cruises.id,
        cruiseCode: cruises.cruiseCode,
        name: cruises.name,
        shipId: cruises.shipId,
        sailingDate: cruises.sailingDate,
      })
      .from(cruises)
      .where(
        and(
          eq(cruises.cruiseLineId, lineId),
          gte(cruises.sailingDate, new Date()),
          eq(cruises.isActive, true)
        )
      )
      .orderBy(cruises.sailingDate);

    console.log(`\n📊 Database Statistics:`);
    console.log(`  Total future cruises: ${futureCruises.length}`);

    if (futureCruises.length === 0) {
      console.log('  ⚠️ No future cruises found in database');
      return;
    }

    // Group by sailing year/month
    const cruisesByMonth = {};
    futureCruises.forEach(cruise => {
      const date = new Date(cruise.sailingDate);
      const key = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!cruisesByMonth[key]) {
        cruisesByMonth[key] = [];
      }
      cruisesByMonth[key].push(cruise);
    });

    console.log(`  Sailing months: ${Object.keys(cruisesByMonth).sort().join(', ')}`);

    // Connect to FTP
    console.log(`\n🔌 Connecting to FTP...`);
    await ftpClient.access({
      host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
      user: process.env.TRAVELTEK_FTP_USER,
      password: process.env.TRAVELTEK_FTP_PASSWORD,
      secure: false,
    });

    // Sample check - test a few cruises from different months
    console.log(`\n🔍 Checking FTP file availability (sampling):`);

    const sampleSize = Math.min(20, futureCruises.length);
    const sampleInterval = Math.floor(futureCruises.length / sampleSize);
    const results = {
      found: 0,
      notFound: 0,
      errors: 0,
      patterns: new Set(),
    };

    for (
      let i = 0;
      i < futureCruises.length && results.found + results.notFound < sampleSize;
      i += sampleInterval
    ) {
      const cruise = futureCruises[i];
      const date = new Date(cruise.sailingDate);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');

      // Try different path patterns
      const pathVariations = [
        `/cruise/${year}/${month}/${lineId}/${cruise.shipId || 'unknown'}/${cruise.id}.json`,
        `/cruise/${year}/${month}/${lineId}/${cruise.id}.json`,
        `/cruise/${year}/${month}/${cruise.id}.json`,
      ];

      let found = false;
      let foundPath = null;

      for (const path of pathVariations) {
        try {
          const size = await ftpClient.size(path);
          if (size > 0) {
            found = true;
            foundPath = path;
            break;
          }
        } catch (err) {
          // File doesn't exist at this path
        }
      }

      if (found) {
        results.found++;
        // Extract pattern from found path
        const pattern = foundPath
          .replace(/\/\d+\.json$/, '/{cruiseId}.json')
          .replace(/\/\d+\//, '/{shipId}/')
          .replace(/\/\d{4}\//, '/{year}/')
          .replace(/\/\d{2}\//, '/{month}/');
        results.patterns.add(pattern);
        console.log(`  ✅ Found: ${cruise.id} at ${foundPath}`);
      } else {
        results.notFound++;
        console.log(`  ❌ Not found: ${cruise.id} (tried ${pathVariations.length} paths)`);
      }
    }

    // Analyze results
    console.log(`\n📈 FTP Analysis Results:`);
    console.log(
      `  Files found: ${results.found}/${sampleSize} (${Math.round((results.found / sampleSize) * 100)}%)`
    );
    console.log(
      `  Files not found: ${results.notFound}/${sampleSize} (${Math.round((results.notFound / sampleSize) * 100)}%)`
    );

    if (results.patterns.size > 0) {
      console.log(`\n  Working path patterns:`);
      results.patterns.forEach(pattern => {
        console.log(`    - ${pattern}`);
      });
    }

    // Estimate total failures
    const failureRate = results.notFound / sampleSize;
    const estimatedFailures = Math.round(futureCruises.length * failureRate);

    console.log(`\n⚠️ Estimated Impact:`);
    console.log(`  Total cruises: ${futureCruises.length}`);
    console.log(`  Estimated failures: ${estimatedFailures} (${Math.round(failureRate * 100)}%)`);
    console.log(
      `  Estimated successes: ${futureCruises.length - estimatedFailures} (${Math.round((1 - failureRate) * 100)}%)`
    );

    // Recommendations
    console.log(`\n💡 Recommendations:`);
    if (failureRate > 0.5) {
      console.log(`  1. ⚠️ HIGH FAILURE RATE - Many cruises may not have FTP files yet`);
      console.log(`  2. Consider running a full FTP sync for this cruise line`);
      console.log(`  3. Check if cruise data is stale or from old imports`);
      console.log(`  4. Webhook should handle missing files gracefully`);
    } else if (failureRate > 0.2) {
      console.log(`  1. Moderate failure rate - some cruises missing FTP files`);
      console.log(`  2. May need targeted sync for specific months`);
      console.log(`  3. Check FTP path structure changes`);
    } else {
      console.log(`  1. ✅ Good FTP coverage - most files available`);
      console.log(`  2. Failures may be due to connection issues`);
      console.log(`  3. Consider retry logic for failed downloads`);
    }
  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
  } finally {
    ftpClient.close();
    await client.end();
  }
}

// Main execution
async function main() {
  const lineId = process.argv[2];

  if (!lineId) {
    console.log('Usage: node diagnose-webhook-failures.js <cruise_line_id>');
    console.log('\nExample cruise line IDs:');
    console.log('  17 - CroisiEurope');
    console.log('  18 - VIVA Cruises');
    console.log('  22 - Royal Caribbean');
    console.log('  21 - MSC Cruises');
    console.log('  33 - Explora Journeys');
    console.log('  55 - Riviera Travel');
    process.exit(1);
  }

  await client.connect();
  await diagnoseCruiseLine(parseInt(lineId));
}

main().catch(console.error);
