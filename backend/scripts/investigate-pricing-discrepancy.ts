#!/usr/bin/env ts-node

/**
 * Pricing Discrepancy Investigation Script
 * 
 * This script investigates the exact source of pricing data discrepancies 
 * between FTP files and the database for cruise 2111828.
 */

import * as ftp from 'basic-ftp';
import { db } from '../src/db/connection';
import { sql } from 'drizzle-orm';
import { traveltekConfig } from '../src/config/environment';

interface PricingAnalysis {
  cruiseId: string;
  ftpFileData: any;
  databaseData: any;
  fieldMappings: any;
  discrepancies: any[];
}

async function downloadCruiseJson(cruiseId: string): Promise<any> {
  const client = new ftp.Client();
  
  try {
    await client.access({
      host: traveltekConfig.ftp.host || '',
      user: traveltekConfig.ftp.user || '',
      password: traveltekConfig.ftp.password || '',
      secure: false,
      port: traveltekConfig.ftp.port || 21,
    });
    
    console.log('📡 Connected to FTP server');
    
    // Try multiple paths for Royal Caribbean (line 22)
    const possiblePaths = [
      '2026/02/22',  // February 2026 for Star of the Seas
      '2026/01/22',  // January 2026
      '2025/12/22',  // December 2025
      '2025/11/22',  // November 2025
    ];
    
    for (const yearMonthPath of possiblePaths) {
      try {
        console.log(`🔍 Checking path: ${yearMonthPath}`);
        await client.cd(`/${yearMonthPath}`);
        
        // List ship directories
        const shipDirs = await client.list();
        const directories = shipDirs.filter(item => item.type === 2);
        
        console.log(`   Found ${directories.length} ship directories`);
        
        for (const shipDir of directories) {
          try {
            const shipPath = `${yearMonthPath}/${shipDir.name}`;
            await client.cd(`/${shipPath}`);
            
            const fileName = `${cruiseId}.json`;
            console.log(`   📄 Looking for ${fileName} in ship ${shipDir.name}...`);
            
            // Try to download the file
            const chunks: Buffer[] = [];
            const stream = require('stream');
            const writableStream = new stream.Writable({
              write(chunk: Buffer, encoding: string, callback: Function) {
                chunks.push(chunk);
                callback();
              }
            });
            
            try {
              await client.downloadTo(writableStream, fileName);
              const buffer = Buffer.concat(chunks);
              const content = buffer.toString();
              const data = JSON.parse(content);
              
              console.log(`✅ Found file at: /${shipPath}/${fileName}`);
              return data;
            } catch (downloadErr) {
              // File not found in this ship directory, continue
            }
          } catch (shipErr) {
            // Ship directory issue, continue
          }
        }
      } catch (pathErr) {
        console.log(`   Path ${yearMonthPath} not accessible`);
      }
    }
    
    throw new Error(`Cruise ${cruiseId} not found in any FTP path`);
    
  } finally {
    client.close();
  }
}

async function getDatabasePricing(cruiseId: string) {
  console.log('🗄️ Fetching database pricing data...');
  
  const cheapestPricing = await db.execute(sql`
    SELECT 
      cruise_id,
      interior_price,
      oceanview_price,
      balcony_price,
      suite_price,
      cheapest_price,
      last_updated
    FROM cheapest_pricing
    WHERE cruise_id = ${cruiseId}
  `);
  
  return cheapestPricing[0] || null;
}

function analyzePricingFields(data: any): any {
  console.log('🔬 Analyzing FTP JSON pricing structure...');
  
  const analysis = {
    // Direct cheapest fields (what current sync uses)
    directCheapest: {
      cheapestinside: data.cheapestinside,
      cheapestoutside: data.cheapestoutside, 
      cheapestbalcony: data.cheapestbalcony,
      cheapestsuite: data.cheapestsuite,
    },
    
    // Nested cheapest object structure
    nestedCheapest: {
      cheapest: data.cheapest,
      cheapestStructure: data.cheapest ? {
        hasPrice: !!data.cheapest.price,
        hasPrices: !!data.cheapest.prices,
        hasCombined: !!data.cheapest.combined,
        hasCachedPrices: !!data.cheapest.cachedprices
      } : null
    },
    
    // Prices object structure (detailed pricing)
    pricesObject: {
      hasData: data.prices && Object.keys(data.prices).length > 0,
      structure: data.prices ? Object.keys(data.prices).map(rateCode => ({
        rateCode,
        cabins: Object.keys(data.prices[rateCode])
      })) : null
    },
    
    // Cached prices (live pricing - usually empty for us)
    cachedPrices: {
      hasData: data.cachedprices && Object.keys(data.cachedprices).length > 0,
      data: data.cachedprices
    }
  };
  
  return analysis;
}

function extractAllPossiblePrices(data: any) {
  console.log('💰 Extracting all possible pricing sources...');
  
  const prices: any = {
    // Method 1: Direct cheapest fields (currently used)
    direct: {
      interior: data.cheapestinside,
      oceanview: data.cheapestoutside,
      balcony: data.cheapestbalcony,
      suite: data.cheapestsuite
    },
    
    // Method 2: From cheapest.combined (mentioned in documentation)
    combined: null,
    
    // Method 3: From cheapest.prices (static pricing)
    static: null,
    
    // Method 4: From cheapest.cachedprices (live pricing)  
    cached: null,
    
    // Method 5: From main prices object (find cheapest in each category)
    calculated: {
      interior: null,
      oceanview: null,
      balcony: null,
      suite: null
    }
  };
  
  // Extract combined prices if available
  if (data.cheapest && data.cheapest.combined) {
    prices.combined = {
      interior: data.cheapest.combined.inside,
      oceanview: data.cheapest.combined.outside,
      balcony: data.cheapest.combined.balcony,
      suite: data.cheapest.combined.suite
    };
  }
  
  // Extract static prices if available
  if (data.cheapest && data.cheapest.prices) {
    prices.static = {
      interior: data.cheapest.prices.inside,
      oceanview: data.cheapest.prices.outside,
      balcony: data.cheapest.prices.balcony,
      suite: data.cheapest.prices.suite
    };
  }
  
  // Extract cached prices if available
  if (data.cheapest && data.cheapest.cachedprices) {
    prices.cached = {
      interior: data.cheapest.cachedprices.inside,
      oceanview: data.cheapest.cachedprices.outside,
      balcony: data.cheapest.cachedprices.balcony,
      suite: data.cheapest.cachedprices.suite
    };
  }
  
  // Calculate cheapest from detailed prices object
  if (data.prices && Object.keys(data.prices).length > 0) {
    const allPricesByCategory: any = {
      interior: [],
      oceanview: [],
      balcony: [],
      suite: []
    };
    
    // Iterate through all rate codes and cabins
    for (const [rateCode, rateCabins] of Object.entries(data.prices)) {
      for (const [cabinCode, priceData] of Object.entries(rateCabins as any)) {
        const info = priceData as any;
        if (info.price && info.cabintype) {
          const price = parseFloat(info.price);
          const cabinType = info.cabintype.toLowerCase();
          
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
    
    // Find minimum price in each category
    prices.calculated = {
      interior: allPricesByCategory.interior.length > 0 ? Math.min(...allPricesByCategory.interior) : null,
      oceanview: allPricesByCategory.oceanview.length > 0 ? Math.min(...allPricesByCategory.oceanview) : null,
      balcony: allPricesByCategory.balcony.length > 0 ? Math.min(...allPricesByCategory.balcony) : null,
      suite: allPricesByCategory.suite.length > 0 ? Math.min(...allPricesByCategory.suite) : null
    };
  }
  
  return prices;
}

function compareWithWebsitePrices(extractedPrices: any) {
  console.log('🌐 Comparing with website prices...');
  
  const websitePrices = {
    interior: 1398.20,
    oceanview: 1505.20,  
    balcony: 1750.20,
    suite: 3736.20
  };
  
  const comparison: any = {
    websitePrices,
    matches: {}
  };
  
  // Check each extraction method
  for (const [method, prices] of Object.entries(extractedPrices)) {
    if (prices && typeof prices === 'object' && 'interior' in prices) {
      const priceObj = prices as any;
      comparison.matches[method] = {
        interior: priceObj.interior == websitePrices.interior,
        oceanview: priceObj.oceanview == websitePrices.oceanview,
        balcony: priceObj.balcony == websitePrices.balcony,
        suite: priceObj.suite == websitePrices.suite,
        exactMatch: priceObj.interior == websitePrices.interior &&
                   priceObj.oceanview == websitePrices.oceanview &&
                   priceObj.balcony == websitePrices.balcony &&
                   priceObj.suite == websitePrices.suite
      };
    }
  }
  
  return comparison;
}

async function investigatePricingDiscrepancy(cruiseId: string): Promise<PricingAnalysis> {
  console.log(`🕵️ Starting pricing investigation for cruise ${cruiseId}`);
  console.log('=====================================\n');
  
  try {
    // Download FTP data
    console.log('Step 1: Download FTP JSON file');
    const ftpData = await downloadCruiseJson(cruiseId);
    console.log(`✅ Successfully downloaded FTP data for cruise ${cruiseId}\n`);
    
    // Get database data
    console.log('Step 2: Fetch database pricing');
    const dbData = await getDatabasePricing(cruiseId);
    console.log('✅ Retrieved database pricing data\n');
    
    // Analyze FTP structure
    console.log('Step 3: Analyze FTP pricing structure');
    const ftpAnalysis = analyzePricingFields(ftpData);
    
    // Extract all possible prices
    console.log('Step 4: Extract pricing from all possible sources');
    const extractedPrices = extractAllPossiblePrices(ftpData);
    
    // Compare with website
    console.log('Step 5: Compare with website prices');
    const websiteComparison = compareWithWebsitePrices(extractedPrices);
    
    // Generate detailed report
    console.log('\n📊 DETAILED ANALYSIS REPORT');
    console.log('=====================================');
    
    console.log('\n1. FTP FILE STRUCTURE:');
    console.log('   Direct cheapest fields:', JSON.stringify(ftpAnalysis.directCheapest, null, 2));
    console.log('   Nested cheapest structure:', JSON.stringify(ftpAnalysis.nestedCheapest, null, 2));
    console.log('   Prices object:', JSON.stringify(ftpAnalysis.pricesObject, null, 2));
    
    console.log('\n2. ALL EXTRACTED PRICES:');
    for (const [method, prices] of Object.entries(extractedPrices)) {
      if (prices) {
        console.log(`   ${method.toUpperCase()}:`, JSON.stringify(prices, null, 2));
      }
    }
    
    console.log('\n3. DATABASE CURRENT VALUES:');
    console.log('   Database data:', JSON.stringify(dbData, null, 2));
    
    console.log('\n4. WEBSITE PRICE COMPARISON:');
    console.log('   Website prices:', JSON.stringify(websiteComparison.websitePrices, null, 2));
    console.log('   Match analysis:');
    for (const [method, match] of Object.entries(websiteComparison.matches)) {
      console.log(`     ${method}: Exact match = ${(match as any).exactMatch}`);
      if (!(match as any).exactMatch) {
        console.log(`       Details:`, JSON.stringify(match, null, 2));
      }
    }
    
    // Find the correct method
    console.log('\n5. RECOMMENDATIONS:');
    let correctMethod = null;
    for (const [method, match] of Object.entries(websiteComparison.matches)) {
      if ((match as any).exactMatch) {
        correctMethod = method;
        break;
      }
    }
    
    if (correctMethod) {
      console.log(`   ✅ FOUND CORRECT METHOD: "${correctMethod}"`);
      console.log(`   The sync should use: ${correctMethod} pricing extraction`);
    } else {
      console.log('   ❌ NO EXACT MATCH FOUND');
      console.log('   This suggests either:');
      console.log('   - The FTP file is outdated');
      console.log('   - The website uses different pricing source');
      console.log('   - There\'s a calculation/transformation missing');
    }
    
    return {
      cruiseId,
      ftpFileData: ftpData,
      databaseData: dbData,
      fieldMappings: extractedPrices,
      discrepancies: websiteComparison.matches
    };
    
  } catch (error) {
    console.error('❌ Investigation failed:', error);
    throw error;
  }
}

// Run the investigation
if (require.main === module) {
  investigatePricingDiscrepancy('2111828')
    .then(() => {
      console.log('\n✅ Investigation completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Investigation failed:', error);
      process.exit(1);
    });
}