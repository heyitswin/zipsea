#!/usr/bin/env tsx

/**
 * Quick script to check Star pricing FTP files specifically
 * Based on the comprehensive analysis findings
 */

import { db, sql } from '../src/db/connection';
import { logger } from '../src/config/logger';

async function checkStarPricing() {
  try {
    logger.info('🔍 Checking Star Cruises (Line 24) pricing specifically...');

    // Get Line 24 cruises without pricing
    const line24Missing = await sql`
      SELECT 
        c.id,
        c.cruise_id,
        c.ship_id,
        s.name as ship_name,
        c.name as cruise_name,
        c.sailing_date,
        c.nights,
        CASE 
          WHEN c.sailing_date IS NOT NULL THEN
            EXTRACT(YEAR FROM c.sailing_date)::text || '/' || 
            LPAD(EXTRACT(MONTH FROM c.sailing_date)::text, 2, '0') || '/' ||
            '24/' || 
            c.ship_id::text || '/' || 
            c.id::text || '.json'
          ELSE 'No sailing date available'
        END as ftp_file_path
      FROM cruises c
      LEFT JOIN ships s ON c.ship_id = s.id
      WHERE c.cruise_line_id = 24
        AND c.sailing_date >= CURRENT_DATE
        AND c.is_active = true
        AND c.interior_price IS NULL 
        AND c.oceanview_price IS NULL 
        AND c.balcony_price IS NULL 
        AND c.suite_price IS NULL 
        AND c.cheapest_price IS NULL
      ORDER BY c.sailing_date
      LIMIT 50;
    `;

    console.log(`\n🎯 LINE 24 (SEABOURN) - CRUISES WITHOUT PRICING`);
    console.log('='.repeat(80));
    console.log(`Found ${line24Missing.length} cruises without pricing data\n`);

    // Group by sailing month for FTP verification
    const monthGroups: { [key: string]: any[] } = {};
    
    for (const cruise of line24Missing) {
      const sailingDate = new Date(cruise.sailing_date);
      const monthKey = `${sailingDate.getFullYear()}-${String(sailingDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = [];
      }
      monthGroups[monthKey].push(cruise);
    }

    // Display by month for easier FTP checking
    for (const [month, cruises] of Object.entries(monthGroups)) {
      console.log(`\n📅 MONTH: ${month} (${cruises.length} cruises)`);
      console.log('-'.repeat(50));
      
      for (const cruise of cruises) {
        console.log(`🚢 ${cruise.ship_name} | ${cruise.nights}N | ${cruise.cruise_name}`);
        console.log(`   🆔 ID: ${cruise.id} (Original: ${cruise.cruise_id})`);
        console.log(`   📁 FTP: ${cruise.ftp_file_path}`);
        console.log(`   📅 Sailing: ${cruise.sailing_date}\n`);
      }
    }

    // Provide FTP directory structure for manual checking
    console.log(`\n📋 FTP DIRECTORY STRUCTURE TO CHECK:`);
    console.log('='.repeat(80));
    
    const uniqueMonths = [...new Set(Object.keys(monthGroups))];
    for (const month of uniqueMonths.sort()) {
      const [year, monthNum] = month.split('-');
      console.log(`📁 ${year}/${monthNum}/24/`);
      
      // Get unique ship IDs for this month
      const shipsInMonth = [...new Set(monthGroups[month].map(c => c.ship_id))];
      for (const shipId of shipsInMonth.sort()) {
        const shipName = monthGroups[month].find(c => c.ship_id === shipId)?.ship_name || `Ship ${shipId}`;
        const cruiseCount = monthGroups[month].filter(c => c.ship_id === shipId).length;
        console.log(`   └── 📁 ${shipId}/ (${shipName} - ${cruiseCount} cruises)`);
      }
      console.log('');
    }

    console.log(`\n🔧 RECOMMENDED ACTIONS:`);
    console.log('='.repeat(80));
    console.log(`
1. CHECK FTP FILES: Verify the above file paths exist on the FTP server
2. VERIFY CONTENT: If files exist, check they contain valid pricing data
3. CHECK PARSING: If files have pricing, verify the parsing logic
4. BATCH SYNC FIX: The V5 batch sync may need adjustment to process all files

Key findings from analysis:
- Line 24 has 345 cruises (59.5%) without pricing data
- All have needs_price_update=false (flags were cleared)
- This suggests batch sync processed Line 24 but missed many files
- Likely due to the 3-ships-per-month and 50-files-per-ship limits
    `);

  } catch (error) {
    logger.error('❌ Error checking Star pricing:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  checkStarPricing();
}

export { checkStarPricing };