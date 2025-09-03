#!/usr/bin/env tsx

/**
 * Script to check for cruises without pricing data
 * This helps identify specific cruise IDs that need FTP file verification
 */

import { db, sql } from '../src/db/connection';
import { logger } from '../src/config/logger';
import { eq, and, or, isNull, gte, desc } from 'drizzle-orm';
import { cruises } from '../src/db/schema/cruises';
import { cruiseLines } from '../src/db/schema/cruise-lines';
import { ships } from '../src/db/schema/ships';

interface CruiseWithoutPricing {
  id: string;
  cruiseId: string;
  cruiseLineId: number;
  cruiseLineName: string;
  shipId: number;
  shipName: string;
  name: string;
  sailingDate: string;
  nights: number;
  interiorPrice: number | null;
  oceanviewPrice: number | null;
  balconyPrice: number | null;
  suitePrice: number | null;
  cheapestPrice: number | null;
  needsPriceUpdate: boolean;
  ftpFilePath: string;
}

async function checkCruisesWithoutPricing() {
  try {
    logger.info('🔍 Checking for cruises without pricing data...');

    // Query for cruises with missing pricing data using raw SQL
    const results = await sql`
      SELECT 
        c.id,
        c.cruise_id as "cruiseId",
        c.cruise_line_id as "cruiseLineId",
        cl.name as "cruiseLineName",
        c.ship_id as "shipId",
        s.name as "shipName",
        c.name,
        c.sailing_date::text as "sailingDate",
        c.nights,
        c.interior_price as "interiorPrice",
        c.oceanview_price as "oceanviewPrice",
        c.balcony_price as "balconyPrice",
        c.suite_price as "suitePrice",
        c.cheapest_price as "cheapestPrice",
        c.needs_price_update as "needsPriceUpdate",
        CASE 
          WHEN c.sailing_date IS NOT NULL THEN
            EXTRACT(YEAR FROM c.sailing_date)::text || '/' || 
            LPAD(EXTRACT(MONTH FROM c.sailing_date)::text, 2, '0') || '/' ||
            c.cruise_line_id::text || '/' || 
            c.ship_id::text || '/' || 
            c.id::text || '.json'
          ELSE 'No sailing date available'
        END as "ftpFilePath"
      FROM cruises c
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      LEFT JOIN ships s ON c.ship_id = s.id
      WHERE c.sailing_date >= CURRENT_DATE
        AND (
          c.interior_price IS NULL AND
          c.oceanview_price IS NULL AND
          c.balcony_price IS NULL AND
          c.suite_price IS NULL AND
          c.cheapest_price IS NULL
        )
        AND c.is_active = true
      ORDER BY c.cruise_line_id, c.sailing_date
      LIMIT 500;
    ` as CruiseWithoutPricing[];
    
    logger.info(`Found ${results.length} cruises without pricing data`);

    // Group by cruise line
    const groupedResults: { [key: number]: CruiseWithoutPricing[] } = {};
    
    for (const cruise of results) {
      if (!groupedResults[cruise.cruiseLineId]) {
        groupedResults[cruise.cruiseLineId] = [];
      }
      groupedResults[cruise.cruiseLineId].push(cruise);
    }

    // Display results by cruise line
    for (const [cruiseLineId, cruises] of Object.entries(groupedResults)) {
      const lineId = parseInt(cruiseLineId);
      const lineName = cruises[0].cruiseLineName || `Line ${lineId}`;
      
      console.log(`\n🚢 CRUISE LINE ${lineId}: ${lineName} (${cruises.length} cruises)`);
      console.log('='.repeat(80));
      
      for (const cruise of cruises.slice(0, 10)) { // Show first 10 per line
        console.log(`
📅 Sailing: ${cruise.sailingDate} | Nights: ${cruise.nights}
🆔 Cruise ID: ${cruise.id} (Original: ${cruise.cruiseId})
🚢 Ship: ${cruise.shipName} (ID: ${cruise.shipId})
🏷️  Name: ${cruise.name}
💰 Pricing: Interior=${cruise.interiorPrice} | Ocean=${cruise.oceanviewPrice} | Balcony=${cruise.balconyPrice} | Suite=${cruise.suitePrice}
🔄 Needs Update: ${cruise.needsPriceUpdate}
📁 FTP Path: ${cruise.ftpFilePath}
        `);
      }

      if (cruises.length > 10) {
        console.log(`... and ${cruises.length - 10} more cruises for this line`);
      }
    }

    // Special focus on Line 24 as requested - check separately
    console.log(`\n🎯 SPECIAL FOCUS: Line 24 Analysis`);
    console.log('='.repeat(80));
    
    const line24Results = await sql`
      SELECT 
        c.id,
        c.cruise_id as "cruiseId",
        c.cruise_line_id as "cruiseLineId",
        cl.name as "cruiseLineName",
        c.ship_id as "shipId",
        s.name as "shipName",
        c.name,
        c.sailing_date::text as "sailingDate",
        c.nights,
        c.interior_price as "interiorPrice",
        c.oceanview_price as "oceanviewPrice",
        c.balcony_price as "balconyPrice",
        c.suite_price as "suitePrice",
        c.cheapest_price as "cheapestPrice",
        c.needs_price_update as "needsPriceUpdate",
        CASE 
          WHEN c.sailing_date IS NOT NULL THEN
            EXTRACT(YEAR FROM c.sailing_date)::text || '/' || 
            LPAD(EXTRACT(MONTH FROM c.sailing_date)::text, 2, '0') || '/' ||
            c.cruise_line_id::text || '/' || 
            c.ship_id::text || '/' || 
            c.id::text || '.json'
          ELSE 'No sailing date available'
        END as "ftpFilePath"
      FROM cruises c
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      LEFT JOIN ships s ON c.ship_id = s.id
      WHERE c.cruise_line_id = 24
        AND c.sailing_date >= CURRENT_DATE
        AND c.is_active = true
      ORDER BY c.sailing_date
      LIMIT 50;
    ` as CruiseWithoutPricing[];

    console.log(`Total Line 24 cruises found: ${line24Results.length}`);
    
    const line24WithoutPricing = line24Results.filter(c => 
      !c.interiorPrice && !c.oceanviewPrice && !c.balconyPrice && !c.suitePrice && !c.cheapestPrice
    );
    
    const line24WithPricing = line24Results.filter(c => 
      c.interiorPrice || c.oceanviewPrice || c.balconyPrice || c.suitePrice || c.cheapestPrice
    );
    
    console.log(`Line 24 cruises WITHOUT pricing: ${line24WithoutPricing.length}`);
    console.log(`Line 24 cruises WITH pricing: ${line24WithPricing.length}`);
    
    if (line24WithoutPricing.length > 0) {
      console.log('\nLine 24 cruises missing pricing:');
      for (const cruise of line24WithoutPricing) {
        console.log(`
🔹 ${cruise.sailingDate} | ${cruise.name}
   ID: ${cruise.id} | Ship: ${cruise.shipName}
   FTP: ${cruise.ftpFilePath}
        `);
      }
    }
    
    if (line24WithPricing.length > 0) {
      console.log('\nLine 24 cruises WITH pricing (examples):');
      for (const cruise of line24WithPricing.slice(0, 5)) {
        console.log(`
🔹 ${cruise.sailingDate} | ${cruise.name}
   ID: ${cruise.id} | Ship: ${cruise.shipName}
   Pricing: I=${cruise.interiorPrice} | O=${cruise.oceanviewPrice} | B=${cruise.balconyPrice} | S=${cruise.suitePrice}
   FTP: ${cruise.ftpFilePath}
        `);
      }
    }

    // Summary statistics
    console.log(`\n📊 SUMMARY`);
    console.log('='.repeat(80));
    console.log(`Total cruise lines affected: ${Object.keys(groupedResults).length}`);
    console.log(`Total cruises without pricing: ${results.length}`);
    
    const lineStats = Object.entries(groupedResults)
      .map(([lineId, cruises]) => ({ lineId: parseInt(lineId), count: cruises.length }))
      .sort((a, b) => b.count - a.count);
      
    console.log('\nMost affected lines:');
    for (const { lineId, count } of lineStats.slice(0, 5)) {
      const lineName = groupedResults[lineId][0].cruiseLineName || `Line ${lineId}`;
      console.log(`  Line ${lineId} (${lineName}): ${count} cruises`);
    }

    // Check needs_price_update flags
    const needsUpdateResults = await sql`
      SELECT 
        cruise_line_id,
        COUNT(*) as count
      FROM cruises 
      WHERE needs_price_update = true 
        AND sailing_date >= CURRENT_DATE
        AND is_active = true
      GROUP BY cruise_line_id
      ORDER BY count DESC;
    `;
    
    console.log(`\n🏁 CRUISES MARKED FOR PRICE UPDATES`);
    console.log('='.repeat(80));
    console.log(`Total cruise lines with needs_price_update=true: ${needsUpdateResults.length}`);
    
    for (const row of needsUpdateResults) {
      console.log(`  Line ${row.cruise_line_id}: ${row.count} cruises`);
    }

  } catch (error) {
    logger.error('❌ Error checking cruises without pricing:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  checkCruisesWithoutPricing();
}

export { checkCruisesWithoutPricing };