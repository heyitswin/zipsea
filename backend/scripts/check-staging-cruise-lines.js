#!/usr/bin/env node

/**
 * Check What Cruise Lines Exist in Staging
 *
 * Specifically looking for Royal Caribbean (22) and Celebrity (3)
 * which are needed for live booking testing
 */

const postgres = require('postgres');
require('dotenv').config();

async function main() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('❌ Missing DATABASE_URL environment variable');
    process.exit(1);
  }

  console.log('🔍 Checking cruise lines in staging...\n');

  const sql = postgres(dbUrl, { max: 2, ssl: 'require' });

  try {
    // Get cruise counts by cruise line
    const cruiseLines = await sql`
      SELECT
        cl.id,
        cl.name,
        COUNT(c.id) as cruise_count
      FROM cruise_lines cl
      LEFT JOIN cruises c ON c.cruise_line_id = cl.id
      GROUP BY cl.id, cl.name
      ORDER BY cruise_count DESC
    `;

    console.log('📊 Cruise lines in staging:\n');

    let hasRoyal = false;
    let hasCelebrity = false;
    let royalCount = 0;
    let celebrityCount = 0;

    cruiseLines.forEach(cl => {
      const marker = cl.id === 22 || cl.id === 3 ? '⭐' : '  ';
      console.log(`${marker} ${cl.name} (ID: ${cl.id}): ${cl.cruise_count} cruises`);

      if (cl.id === 22) {
        hasRoyal = true;
        royalCount = cl.cruise_count;
      }
      if (cl.id === 3) {
        hasCelebrity = true;
        celebrityCount = cl.cruise_count;
      }
    });

    console.log('\n' + '='.repeat(50));
    console.log('🎯 Live Booking Cruise Lines Status:\n');
    console.log(`  Royal Caribbean (ID: 22): ${hasRoyal ? `✅ ${royalCount} cruises` : '❌ Not found'}`);
    console.log(`  Celebrity (ID: 3): ${hasCelebrity ? `✅ ${celebrityCount} cruises` : '❌ Not found'}`);

    if (hasRoyal && hasCelebrity && royalCount > 0 && celebrityCount > 0) {
      console.log('\n✅ GOOD NEWS: Staging has both Royal Caribbean and Celebrity cruises!');
      console.log('\n📋 Recommendation:');
      console.log('  Skip the full data sync - you have enough data for testing');
      console.log('  Just update staging frontend to use staging backend and test');
      console.log('\n  Steps:');
      console.log('  1. Go to Render Dashboard → srv-d2l0rkv5r7bs73d74dkg (frontend staging)');
      console.log('  2. Environment → NEXT_PUBLIC_API_URL');
      console.log('  3. Change from: https://zipsea-production.onrender.com/api/v1');
      console.log('  4. Change to: https://zipsea-backend.onrender.com/api/v1');
      console.log('  5. Save and redeploy');
    } else {
      console.log('\n❌ Problem: Missing live booking cruise lines in staging');
      console.log('\n📋 Options:');
      console.log('  1. Continue using production backend for staging (current setup)');
      console.log('  2. Fix schema drift and run full sync (several hours of work)');
    }

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
