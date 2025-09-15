const { db } = require('../dist/db/connection');
const { sql, eq, and, gte, lte, isNotNull, gt, notIlike, asc } = require('drizzle-orm');
const { cruises, ships, cruiseLines, ports, cheapestPricing } = require('../dist/db/schema');

async function testLastMinuteDeals() {
  try {
    console.log('Testing last-minute-deals query...');

    // Calculate date 3 weeks from today
    const threeWeeksFromToday = new Date();
    threeWeeksFromToday.setDate(threeWeeksFromToday.getDate() + 21);
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    console.log('Date range:', {
      from: threeWeeksFromToday.toISOString().split('T')[0],
      to: oneYearFromNow.toISOString().split('T')[0],
    });

    // Define cruise lines in the exact order required
    const preferredCruiseLines = [
      'Royal Caribbean',
      'Carnival Cruise Line',
      'Princess Cruises',
      'MSC Cruises',
      'Norwegian Cruise Line',
      'Celebrity Cruises',
    ];

    const deals = [];
    const usedCruiseLines = new Set();

    // Try to get one cruise from each preferred cruise line in order
    for (const cruiseLineName of preferredCruiseLines) {
      console.log(`\nSearching for ${cruiseLineName}...`);

      try {
        const cruiseForLine = await db
          .select({
            id: cruises.id,
            cruise_id: cruises.cruiseId,
            name: cruises.name,
            ship_name: ships.name,
            cruise_line_name: cruiseLines.name,
            nights: cruises.nights,
            sailing_date: cruises.sailingDate,
            embark_port_name: ports.name,
            cheapest_pricing: cheapestPricing.cheapestPrice,
            ship_image: ships.defaultShipImage,
          })
          .from(cruises)
          .leftJoin(ships, eq(cruises.shipId, ships.id))
          .leftJoin(cruiseLines, eq(cruises.cruiseLineId, cruiseLines.id))
          .leftJoin(ports, eq(cruises.embarkPortId, ports.id))
          .leftJoin(cheapestPricing, eq(cruises.id, cheapestPricing.cruiseId))
          .where(
            and(
              eq(cruises.isActive, true),
              gte(cruises.sailingDate, threeWeeksFromToday.toISOString().split('T')[0]),
              lte(cruises.sailingDate, oneYearFromNow.toISOString().split('T')[0]),
              isNotNull(cheapestPricing.cheapestPrice),
              sql`${cheapestPricing.cheapestPrice} > 0`,
              sql`${cheapestPricing.cheapestPrice} <= 5000`,
              isNotNull(cruises.name),
              gt(cruises.nights, 0),
              sql`(${cruiseLines.name} = ${cruiseLineName} OR ${cruiseLines.name} ILIKE ${cruiseLineName + '%'})`,
              notIlike(cruiseLines.name, '%a-rosa%'),
              notIlike(cruiseLines.name, '%arosa%')
            )
          )
          .orderBy(asc(cruises.sailingDate))
          .limit(1);

        if (cruiseForLine.length > 0) {
          const deal = cruiseForLine[0];
          console.log(`Found: ${deal.name} - ${deal.sailing_date} - $${deal.cheapest_pricing}`);
          deals.push({
            ...deal,
            onboard_credit: Math.floor((deal.cheapest_pricing || 0) * 0.2), // 20% onboard credit
          });
          usedCruiseLines.add(cruiseLineName);
        } else {
          console.log(`No deals found for ${cruiseLineName}`);
        }
      } catch (error) {
        console.error(`Error searching for ${cruiseLineName}:`, error.message);
      }
    }

    console.log('\n=== RESULTS ===');
    console.log(`Found ${deals.length} deals from ${usedCruiseLines.size} different cruise lines`);

    // Group by cruise line to verify uniqueness
    const dealsByCruiseLine = {};
    deals.forEach(deal => {
      const line = deal.cruise_line_name;
      if (!dealsByCruiseLine[line]) {
        dealsByCruiseLine[line] = [];
      }
      dealsByCruiseLine[line].push(deal);
    });

    console.log('\nDeals by cruise line:');
    Object.entries(dealsByCruiseLine).forEach(([line, lineDeals]) => {
      console.log(`  ${line}: ${lineDeals.length} deal(s)`);
      lineDeals.forEach(deal => {
        console.log(
          `    - ${deal.name} on ${deal.sailing_date} - $${deal.cheapest_pricing} (OBC: $${deal.onboard_credit})`
        );
      });
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testLastMinuteDeals();
