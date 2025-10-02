/**
 * Check if MSC cruises exist in November 2026 in the database
 */

const { db } = require('../dist/db/connection');
const { cruises, cruiseLines } = require('../dist/db/schema');
const { eq, and, gte, lte, sql } = require('drizzle-orm');

async function checkMSCNov2026() {
  console.log('=== CHECKING MSC CRUISES IN NOVEMBER 2026 ===\n');

  try {
    // Get MSC cruise line ID
    const mscLine = await db
      .select()
      .from(cruiseLines)
      .where(eq(cruiseLines.id, 16))
      .limit(1);

    console.log('MSC Cruise Line:', mscLine[0]);
    console.log('');

    // Check total MSC cruises
    const totalMSC = await db
      .select({ count: sql`count(*)` })
      .from(cruises)
      .where(eq(cruises.cruiseLineId, 16));

    console.log('Total MSC cruises in database:', totalMSC[0].count);
    console.log('');

    // Check MSC cruises in 2026
    const msc2026 = await db
      .select({ count: sql`count(*)` })
      .from(cruises)
      .where(
        and(
          eq(cruises.cruiseLineId, 16),
          gte(cruises.sailingDate, '2026-01-01'),
          lte(cruises.sailingDate, '2026-12-31')
        )
      );

    console.log('MSC cruises in 2026:', msc2026[0].count);
    console.log('');

    // Check MSC cruises in November 2026 specifically
    const mscNov2026 = await db
      .select({ count: sql`count(*)` })
      .from(cruises)
      .where(
        and(
          eq(cruises.cruiseLineId, 16),
          gte(cruises.sailingDate, '2026-11-01'),
          lte(cruises.sailingDate, '2026-11-30')
        )
      );

    console.log('MSC cruises in November 2026:', mscNov2026[0].count);
    console.log('');

    // If count is 0, check what months MSC has in 2026
    if (mscNov2026[0].count === 0) {
      console.log('MSC has NO cruises in Nov 2026. Checking what months they DO have in 2026...\n');

      const msc2026Months = await db
        .select({
          month: sql`EXTRACT(MONTH FROM sailing_date)`,
          count: sql`count(*)`,
        })
        .from(cruises)
        .where(
          and(
            eq(cruises.cruiseLineId, 16),
            gte(cruises.sailingDate, '2026-01-01'),
            lte(cruises.sailingDate, '2026-12-31')
          )
        )
        .groupBy(sql`EXTRACT(MONTH FROM sailing_date)`)
        .orderBy(sql`EXTRACT(MONTH FROM sailing_date)`);

      console.log('MSC cruises by month in 2026:');
      msc2026Months.forEach(row => {
        const monthName = new Date(2026, row.month - 1, 1).toLocaleString('default', {
          month: 'long',
        });
        console.log(`  ${monthName} (${row.month}): ${row.count} cruises`);
      });
      console.log('');

      // Check if MSC has cruises in Nov of ANY year
      const mscNovAnyYear = await db
        .select({ count: sql`count(*)` })
        .from(cruises)
        .where(
          and(
            eq(cruises.cruiseLineId, 16),
            sql`EXTRACT(MONTH FROM sailing_date) = 11`
          )
        );

      console.log('MSC cruises in November (any year):', mscNovAnyYear[0].count);
    } else {
      // Show sample cruises
      const sampleCruises = await db
        .select({
          id: cruises.id,
          name: cruises.name,
          sailingDate: cruises.sailingDate,
          nights: cruises.nights,
        })
        .from(cruises)
        .where(
          and(
            eq(cruises.cruiseLineId, 16),
            gte(cruises.sailingDate, '2026-11-01'),
            lte(cruises.sailingDate, '2026-11-30')
          )
        )
        .limit(5);

      console.log('Sample MSC cruises in November 2026:');
      sampleCruises.forEach(cruise => {
        console.log(`  - ${cruise.name} (${cruise.sailingDate}, ${cruise.nights} nights)`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkMSCNov2026();
