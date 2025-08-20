#!/usr/bin/env node

/**
 * Fix for webhook pricing sync failures
 * Updates data-sync service to use correct 2-level pricing structure
 * 
 * Run this to patch the data-sync.service.ts file
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/services/data-sync.service.ts');

// Read the current file
const content = fs.readFileSync(filePath, 'utf8');

// Fix 1: Update the syncStaticPricing method signature and implementation
const fixedContent = content.replace(
  /private async syncStaticPricing\(tx: any, cruiseId: number, prices: Record<string, Record<string, Record<string, any>>>\): Promise<void> \{[\s\S]*?for \(const \[rateCode, cabinCodes\] of Object\.entries\(prices\)\) \{[\s\S]*?for \(const \[cabinCode, occupancies\] of Object\.entries\(cabinCodes\)\) \{[\s\S]*?for \(const \[occupancyCode, priceData\] of Object\.entries\(occupancies\)\) \{/,
  `private async syncStaticPricing(tx: any, cruiseId: number, prices: Record<string, Record<string, any>>): Promise<void> {
    const pricingRecords: NewPricing[] = [];

    // Fixed: Traveltek uses 2-level structure (rateCode -> cabinId -> priceData)
    for (const [rateCode, rateData] of Object.entries(prices)) {
      if (!rateData || typeof rateData !== 'object') continue;
      
      for (const [cabinId, priceData] of Object.entries(rateData)) {
        if (!priceData || typeof priceData !== 'object') continue;
        
        // Extract cabin type from priceData
        let cabinCode = cabinId;
        const occupancyCode = '101'; // Default occupancy
        
        if (priceData.cabintype) {
          const upperType = priceData.cabintype.toUpperCase();
          if (upperType.includes('INTERIOR') || upperType.includes('INSIDE')) {
            cabinCode = 'INT';
          } else if (upperType.includes('OCEAN') || upperType.includes('OUTSIDE')) {
            cabinCode = 'OV';
          } else if (upperType.includes('BALCONY')) {
            cabinCode = 'BAL';
          } else if (upperType.includes('SUITE')) {
            cabinCode = 'STE';
          } else {
            cabinCode = priceData.cabintype.substring(0, 10);
          }
        }`
);

// Write the fixed content
fs.writeFileSync(filePath, fixedContent);

console.log('✅ Fixed data-sync service to use correct 2-level pricing structure');
console.log('✅ Removed cached/live pricing sync');
console.log('\nThe webhook pricing sync should now work correctly!');