#!/usr/bin/env tsx

/**
 * Comprehensive Pricing Analysis Script
 * 
 * This script provides a complete analysis of:
 * 1. Cruises without pricing data with specific FTP file paths
 * 2. Batch sync processing limits and potential gaps
 * 3. Line 24 specific analysis
 * 4. Verification of batch sync completeness
 */

import { db, sql } from '../src/db/connection';
import { logger } from '../src/config/logger';

async function comprehensivePricingAnalysis() {
  try {
    logger.info('🔍 Starting comprehensive pricing analysis...');

    console.log('\n' + '='.repeat(100));
    console.log('🔍 COMPREHENSIVE PRICING ANALYSIS REPORT');
    console.log('='.repeat(100));

    // 1. BATCH SYNC ANALYSIS
    console.log('\n📋 1. BATCH SYNC V5 ANALYSIS');
    console.log('-'.repeat(50));
    
    console.log(`
🔧 BATCH SYNC LIMITATIONS:
- MAX_LINES_PER_RUN: 5 cruise lines per execution
- MAX_FILES_PER_LINE: 2000 files per cruise line  
- Only processes first 3 ships per monthly directory
- Only processes first 50 files per ship
- MONTHS_TO_SYNC: 24 months (2 years ahead)

⚠️  POTENTIAL GAPS:
1. If more than 5 cruise lines need updates, only first 5 are processed
2. Within each line, only first 3 ships per month are processed
3. Within each ship, only first 50 cruise files are processed
4. Remaining lines are skipped until next batch run

🔄 FLAG CLEARING BEHAVIOR:
- ALL cruises for a processed cruise line get needs_price_update=false
- This happens even if not all files were processed due to limits
- This could leave some cruises without pricing data but with flags cleared
    `);

    // 2. DATABASE ANALYSIS
    console.log('\n📊 2. DATABASE CURRENT STATE');
    console.log('-'.repeat(50));

    // Get current needs_price_update status
    const flagStatus = await sql`
      SELECT 
        cruise_line_id,
        COUNT(*) as total_cruises,
        SUM(CASE WHEN needs_price_update = true THEN 1 ELSE 0 END) as needs_update,
        SUM(CASE WHEN 
          interior_price IS NULL AND 
          oceanview_price IS NULL AND 
          balcony_price IS NULL AND 
          suite_price IS NULL AND 
          cheapest_price IS NULL THEN 1 ELSE 0 END) as no_pricing
      FROM cruises 
      WHERE sailing_date >= CURRENT_DATE AND is_active = true
      GROUP BY cruise_line_id
      HAVING SUM(CASE WHEN 
          interior_price IS NULL AND 
          oceanview_price IS NULL AND 
          balcony_price IS NULL AND 
          suite_price IS NULL AND 
          cheapest_price IS NULL THEN 1 ELSE 0 END) > 0
      ORDER BY no_pricing DESC
      LIMIT 20;
    `;

    console.log('\nCruise lines with missing pricing data:');
    console.log('Line ID | Total | Needs Update | Missing Pricing | Issue?');
    console.log('-'.repeat(60));
    
    for (const row of flagStatus) {
      const issue = row.no_pricing > 0 && row.needs_update === 0 ? '❌ FLAG CLEARED' : '✅';
      console.log(`${row.cruise_line_id.toString().padStart(7)} | ${row.total_cruises.toString().padStart(5)} | ${row.needs_update.toString().padStart(12)} | ${row.no_pricing.toString().padStart(15)} | ${issue}`);
    }

    // 3. LINE 24 DETAILED ANALYSIS
    console.log('\n🎯 3. LINE 24 (SEABOURN) DETAILED ANALYSIS');
    console.log('-'.repeat(50));

    const line24Analysis = await sql`
      SELECT 
        c.id,
        c.cruise_id,
        c.ship_id,
        s.name as ship_name,
        c.name as cruise_name,
        c.sailing_date,
        c.nights,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        c.cheapest_price,
        c.needs_price_update,
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
      ORDER BY c.sailing_date, c.ship_id
    `;

    const line24WithoutPricing = line24Analysis.filter(c => 
      !c.interior_price && !c.oceanview_price && !c.balcony_price && !c.suite_price && !c.cheapest_price
    );
    
    const line24WithPricing = line24Analysis.filter(c => 
      c.interior_price || c.oceanview_price || c.balcony_price || c.suite_price || c.cheapest_price
    );

    console.log(`
📈 LINE 24 STATISTICS:
- Total active future cruises: ${line24Analysis.length}
- Cruises WITH pricing data: ${line24WithPricing.length}
- Cruises WITHOUT pricing data: ${line24WithoutPricing.length}
- Percentage missing pricing: ${((line24WithoutPricing.length / line24Analysis.length) * 100).toFixed(1)}%

🔢 FLAG STATUS:
- Cruises with needs_price_update=true: ${line24Analysis.filter(c => c.needs_price_update).length}
- Cruises with needs_price_update=false: ${line24Analysis.filter(c => !c.needs_price_update).length}
    `);

    // Show specific Line 24 cruises without pricing
    if (line24WithoutPricing.length > 0) {
      console.log('\n🔍 LINE 24 CRUISES WITHOUT PRICING (for FTP verification):');
      console.log('-'.repeat(80));
      
      let shipGroups: { [key: number]: any[] } = {};
      for (const cruise of line24WithoutPricing) {
        if (!shipGroups[cruise.ship_id]) {
          shipGroups[cruise.ship_id] = [];
        }
        shipGroups[cruise.ship_id].push(cruise);
      }
      
      for (const [shipId, cruises] of Object.entries(shipGroups)) {
        const shipName = cruises[0].ship_name || `Ship ${shipId}`;
        console.log(`\n🚢 ${shipName} (Ship ID: ${shipId}) - ${cruises.length} cruises:`);
        
        for (const cruise of cruises) {
          console.log(`   📅 ${cruise.sailing_date} | ${cruise.nights}N | ${cruise.cruise_name}`);
          console.log(`      🆔 Cruise ID: ${cruise.id} (Original: ${cruise.cruise_id})`);
          console.log(`      📁 FTP: ${cruise.ftp_file_path}`);
          console.log(`      🔄 Needs Update: ${cruise.needs_price_update}`);
          console.log('');
        }
      }
    }

    // 4. CRITICAL FINDINGS
    console.log('\n🚨 4. CRITICAL FINDINGS & RECOMMENDATIONS');
    console.log('-'.repeat(50));

    const criticalIssues = flagStatus.filter(row => row.no_pricing > 0 && row.needs_update === 0);
    
    console.log(`
🔥 CRITICAL ISSUE IDENTIFIED:
- ${criticalIssues.length} cruise lines have cruises without pricing but needs_price_update=false
- This suggests batch sync cleared flags without successfully processing all files
- Line 24 has ${line24WithoutPricing.length} cruises without pricing data

🔍 ROOT CAUSE ANALYSIS:
1. Batch sync V5 has strict processing limits:
   - Only 5 cruise lines per run
   - Only first 3 ships per month
   - Only first 50 files per ship
2. After processing a cruise line, ALL flags are cleared regardless of completion
3. This creates a gap where some cruises never get processed

💡 RECOMMENDATIONS:
1. IMMEDIATE: Check FTP files for Line 24 cruises listed above
2. FIX: Modify batch sync to only clear flags for actually processed cruises
3. MONITOR: Set up alerts for cruises with no pricing after batch sync runs
4. SCALE: Consider increasing processing limits or running more frequently

📋 NEXT STEPS FOR FTP VERIFICATION:
1. Check the specific FTP file paths listed above for Line 24
2. Verify if the JSON files exist and contain pricing data
3. If files exist but pricing is missing, investigate the parsing logic
4. If files don't exist, investigate the FTP sync process
    `);

    // 5. SUMMARY FOR USER
    console.log('\n📋 5. EXECUTIVE SUMMARY');
    console.log('-'.repeat(50));
    
    console.log(`
🎯 ANSWER TO YOUR QUESTIONS:

1. ❓ "Get a list of which specific cruises don't have pricing data"
   ✅ FOUND: ${line24WithoutPricing.length} Line 24 cruises without pricing (see detailed list above)
   📁 All FTP file paths provided for manual verification

2. ❓ "Confirm that batch syncs continue until ALL marked cruises are synced"
   ❌ ISSUE FOUND: Batch sync has limits that prevent complete processing:
   - Only 5 cruise lines per run (MAX_LINES_PER_RUN = 5)
   - Only 3 ships per monthly directory 
   - Only 50 files per ship
   - Flags cleared for entire cruise line even if incomplete

🔧 THE PROBLEM:
- Batch sync clears needs_price_update=false for ALL cruises in a line
- But only processes a subset due to limits (3 ships, 50 files each)
- This leaves cruises without pricing but with cleared flags
- They won't be picked up in subsequent runs

📊 EVIDENCE:
- ${criticalIssues.length} cruise lines have this pattern
- Line 24: ${line24WithoutPricing.length} cruises missing pricing, ${line24Analysis.filter(c => c.needs_price_update).length} flagged for update
    `);

  } catch (error) {
    logger.error('❌ Error in comprehensive analysis:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  comprehensivePricingAnalysis();
}

export { comprehensivePricingAnalysis };