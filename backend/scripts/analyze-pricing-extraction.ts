#!/usr/bin/env ts-node

/**
 * Pricing Extraction Analysis
 * 
 * Analyzes the different methods used across the codebase to extract pricing 
 * from Traveltek JSON files and identifies the discrepancy source.
 */

import { db } from '../src/db/connection';
import { sql } from 'drizzle-orm';

async function analyzePricingExtractionMethods() {
  console.log('🔍 PRICING EXTRACTION ANALYSIS');
  console.log('===============================\n');

  // Let's analyze the sample JSON file we have
  const sampleJsonPath = '/Users/winlin/Desktop/sites/zipsea/backend/sample-traveltek-cruise.json';
  
  try {
    const fs = require('fs');
    const sampleData = JSON.parse(fs.readFileSync(sampleJsonPath, 'utf8'));
    
    console.log('📂 Sample cruise data loaded:');
    console.log(`   Cruise ID: ${sampleData.codetocruiseid}`);
    console.log(`   Name: ${sampleData.name}`);
    console.log(`   Sailing Date: ${sampleData.saildate}\n`);
    
    // Method 1: Current sync services approach (direct cheapest fields)
    console.log('🔄 METHOD 1: Direct cheapest fields (current approach)');
    console.log('Used by: data-sync.service.ts, price-sync-batch-v5.service.ts, ftp-comprehensive-sync.service.ts');
    const method1 = {
      interior: sampleData.cheapestinside,
      oceanview: sampleData.cheapestoutside, 
      balcony: sampleData.cheapestbalcony,
      suite: sampleData.cheapestsuite
    };
    console.log('   Results:', JSON.stringify(method1, null, 2));
    
    // Method 2: Webhook service approach (cheapest.combined)
    console.log('\n🌐 METHOD 2: cheapest.combined (webhook approach)');
    console.log('Used by: traveltek-webhook.service.ts');
    const combined = sampleData.cheapest?.combined || {};
    const method2 = {
      interior: combined.inside,
      oceanview: combined.outside,
      balcony: combined.balcony,
      suite: combined.suite
    };
    console.log('   Results:', JSON.stringify(method2, null, 2));
    
    // Method 3: cheapest.prices (static pricing)
    console.log('\n💰 METHOD 3: cheapest.prices (static pricing)');
    console.log('Used by: traveltek-webhook.service.ts');
    const staticPrices = sampleData.cheapest?.prices || {};
    const method3 = {
      interior: staticPrices.inside,
      oceanview: staticPrices.outside,
      balcony: staticPrices.balcony,
      suite: staticPrices.suite
    };
    console.log('   Results:', JSON.stringify(method3, null, 2));
    
    // Method 4: cheapest.cachedprices (live pricing - usually empty)
    console.log('\n⚡ METHOD 4: cheapest.cachedprices (live pricing)');
    console.log('Used by: traveltek-webhook.service.ts');
    const cachedPrices = sampleData.cheapest?.cachedprices || {};
    const method4 = {
      interior: cachedPrices.inside,
      oceanview: cachedPrices.outside,
      balcony: cachedPrices.balcony,
      suite: cachedPrices.suite
    };
    console.log('   Results:', JSON.stringify(method4, null, 2));
    
    // Method 5: Calculate from detailed prices object
    console.log('\n🧮 METHOD 5: Calculate cheapest from prices object');
    console.log('Note: This method is NOT currently used but could be the answer');
    
    const allPricesByCategory = {
      interior: [] as number[],
      oceanview: [] as number[],
      balcony: [] as number[],
      suite: [] as number[]
    };
    
    if (sampleData.prices && Object.keys(sampleData.prices).length > 0) {
      console.log('   Processing prices object...');
      
      for (const [rateCode, rateCabins] of Object.entries(sampleData.prices)) {
        console.log(`   Rate Code: ${rateCode}`);
        
        for (const [cabinCode, priceData] of Object.entries(rateCabins as any)) {
          const info = priceData as any;
          if (info.price && info.cabintype) {
            const price = parseFloat(info.price);
            const cabinType = info.cabintype.toLowerCase();
            
            console.log(`     ${cabinCode} (${info.cabintype}): $${info.price}`);
            
            if (cabinType.includes('interior') || cabinType.includes('inside')) {
              allPricesByCategory.interior.push(price);
            } else if (cabinType.includes('ocean') || cabinType.includes('outside')) {
              allPricesByCategory.oceanview.push(price);
            } else if (cabinType.includes('balcony')) {
              allPricesByCategory.balcony.push(price);
            } else if (cabinType.includes('suite')) {
              allPricesByCategory.suite.push(price);
            }
          }
        }
      }
      
      const method5 = {
        interior: allPricesByCategory.interior.length > 0 ? Math.min(...allPricesByCategory.interior) : null,
        oceanview: allPricesByCategory.oceanview.length > 0 ? Math.min(...allPricesByCategory.oceanview) : null,
        balcony: allPricesByCategory.balcony.length > 0 ? Math.min(...allPricesByCategory.balcony) : null,
        suite: allPricesByCategory.suite.length > 0 ? Math.min(...allPricesByCategory.suite) : null
      };
      
      console.log('   Calculated Results:', JSON.stringify(method5, null, 2));
    } else {
      console.log('   No prices object available in sample data');
    }
    
    // Check database for cruise 2111828 if it exists
    console.log('\n🗄️ DATABASE COMPARISON');
    console.log('Checking database for cruise 2111828...');
    
    try {
      const dbResult = await db.execute(sql`
        SELECT 
          cruise_id,
          interior_price,
          oceanview_price,
          balcony_price,
          suite_price,
          last_updated
        FROM cheapest_pricing
        WHERE cruise_id = '2111828'
      `);
      
      if (dbResult.length > 0) {
        console.log('   Database pricing:', JSON.stringify(dbResult[0], null, 2));
      } else {
        console.log('   Cruise 2111828 not found in database');
      }
    } catch (dbError) {
      console.log('   Database query failed:', dbError);
    }
    
    // Analysis summary
    console.log('\n📊 ANALYSIS SUMMARY');
    console.log('===================');
    
    console.log('\n🎯 KEY FINDINGS:');
    console.log('1. Current sync services use METHOD 1 (direct cheapest fields)');
    console.log('2. Webhook service supports multiple methods including cheapest.combined');
    console.log('3. The discrepancy likely occurs because:');
    console.log('   - FTP batch sync uses direct fields (cheapestinside, cheapestoutside, etc.)');
    console.log('   - These fields might be null/empty in newer files');
    console.log('   - The actual pricing might be in cheapest.combined or prices object');
    
    console.log('\n🔧 RECOMMENDATIONS:');
    console.log('1. Check if the FTP file for cruise 2111828 has null cheapest fields');
    console.log('2. Implement fallback to cheapest.combined if direct fields are null');
    console.log('3. Consider calculating from prices object as ultimate fallback');
    console.log('4. Update batch sync services to match webhook service logic');
    
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Download the actual FTP file for cruise 2111828');
    console.log('2. Check which fields contain the correct pricing data');
    console.log('3. Update the sync services to use the correct field mapping');
    console.log('4. Test with a few cruises to verify the fix');
    
  } catch (error) {
    console.error('Error reading sample file:', error);
  }
}

// Code Analysis: Show which services use which methods
function analyzeCodeImplementations() {
  console.log('\n💻 CODE IMPLEMENTATION ANALYSIS');
  console.log('================================');
  
  console.log('\n📁 FILES USING DIRECT CHEAPEST FIELDS:');
  console.log('   • data-sync.service.ts (lines 553-586)');
  console.log('     - Uses: data.cheapestinside?.price, data.cheapestoutside?.price, etc.');
  console.log('     - Maps to: cheapestPricing table');
  console.log('');
  console.log('   • price-sync-batch-v5.service.ts (lines 328-331)');
  console.log('     - Uses: data.cheapestinside, data.cheapestoutside, etc.');
  console.log('     - Maps to: cruises table pricing columns');
  console.log('');
  console.log('   • ftp-comprehensive-sync.service.ts (lines 308-311)');
  console.log('     - Uses: data.cheapestinside, data.cheapestoutside, etc.');
  console.log('     - Maps to: cruises table pricing columns');
  
  console.log('\n📁 FILES USING COMBINED/MULTIPLE METHODS:');
  console.log('   • traveltek-webhook.service.ts (lines 915-918)');
  console.log('     - Uses: cheapest.prices, cheapest.cachedprices, cheapest.combined');
  console.log('     - Maps to: cheapest_prices table (different from cheapest_pricing!)');
  console.log('');
  
  console.log('\n⚠️  CRITICAL ISSUE IDENTIFIED:');
  console.log('   There are TWO different pricing tables:');
  console.log('   • cheapest_pricing (used by most services)');
  console.log('   • cheapest_prices (used by webhook service)');
  console.log('   This suggests table naming inconsistency in the codebase!');
}

// Run the analysis
if (require.main === module) {
  analyzePricingExtractionMethods()
    .then(() => {
      analyzeCodeImplementations();
      process.exit(0);
    })
    .catch((error) => {
      console.error('Analysis failed:', error);
      process.exit(1);
    });
}