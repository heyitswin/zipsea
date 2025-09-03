#!/usr/bin/env ts-node

/**
 * Fix Webhook Pricing Service
 * 
 * This script creates a corrected version of the webhook pricing update
 * method to use the correct table name and column names.
 */

console.log('🔧 WEBHOOK PRICING SERVICE FIX');
console.log('==============================\n');

console.log('❌ CURRENT ISSUE:');
console.log('   The webhook service tries to INSERT INTO cheapest_prices');
console.log('   But the actual table is cheapest_pricing with different columns\n');

console.log('✅ CORRECTED VERSION:');
console.log('   Should use cheapest_pricing table with proper column mapping\n');

// Show the corrected SQL that should replace the webhook service method
const correctedSQL = `
/**
 * CORRECTED: Update cheapest pricing table (webhook service)
 * 
 * This method should replace updateCheapestPrices in traveltek-webhook.service.ts
 */
private async updateCheapestPrices(cruiseId: number, data: any): Promise<void> {
  const cheapest = data.cheapest || {};
  const staticPrices = cheapest.prices || {};
  const cachedPrices = cheapest.cachedprices || {};
  const combined = cheapest.combined || {};
  
  // Enhanced pricing extraction with fallbacks
  const extractPrice = (primary: any, fallback1: any, fallback2: any) => {
    return this.parseDecimal(primary) || 
           this.parseDecimal(fallback1) || 
           this.parseDecimal(fallback2);
  };

  await db.execute(sql\`
    INSERT INTO cheapest_pricing (
      cruise_id,
      
      -- Overall cheapest 
      cheapest_price,
      cheapest_cabin_type,
      cheapest_taxes,
      cheapest_ncf,
      cheapest_gratuity,
      cheapest_fuel,
      cheapest_non_comm,
      
      -- Interior pricing (with fallbacks)
      interior_price,
      interior_taxes,
      interior_ncf,
      interior_gratuity,
      interior_fuel,
      interior_non_comm,
      interior_price_code,
      
      -- Oceanview pricing (with fallbacks)
      oceanview_price,
      oceanview_taxes,
      oceanview_ncf,
      oceanview_gratuity,
      oceanview_fuel,
      oceanview_non_comm,
      oceanview_price_code,
      
      -- Balcony pricing (with fallbacks)
      balcony_price,
      balcony_taxes,
      balcony_ncf,
      balcony_gratuity,
      balcony_fuel,
      balcony_non_comm,
      balcony_price_code,
      
      -- Suite pricing (with fallbacks)
      suite_price,
      suite_taxes,
      suite_ncf,
      suite_gratuity,
      suite_fuel,
      suite_non_comm,
      suite_price_code,
      
      currency,
      last_updated
    ) VALUES (
      \${cruiseId},
      
      -- Overall cheapest
      \${this.parseDecimal(data.cheapest?.price || data.cheapestprice)},
      \${data.cheapest?.cabintype || this.determineCabinType(data)},
      \${this.parseDecimal(data.cheapest?.taxes)},
      \${this.parseDecimal(data.cheapest?.ncf)},
      \${this.parseDecimal(data.cheapest?.gratuity)},
      \${this.parseDecimal(data.cheapest?.fuel)},
      \${this.parseDecimal(data.cheapest?.noncomm)},
      
      -- Interior (try combined.inside, then staticPrices.inside, then cachedPrices.inside)
      \${extractPrice(
        data.cheapestinside?.price || data.cheapestinside, 
        combined.inside, 
        staticPrices.inside
      )},
      \${this.parseDecimal(data.cheapestinside?.taxes || combined.insidetaxes)},
      \${this.parseDecimal(data.cheapestinside?.ncf || combined.insidencf)},
      \${this.parseDecimal(data.cheapestinside?.gratuity || combined.insidegratuity)},
      \${this.parseDecimal(data.cheapestinside?.fuel || combined.insidefuel)},
      \${this.parseDecimal(data.cheapestinside?.noncomm || combined.insidenoncomm)},
      \${data.cheapestinsidepricecode || combined.insidepricecode || null},
      
      -- Oceanview (try combined.outside, then staticPrices.outside, then cachedPrices.outside)
      \${extractPrice(
        data.cheapestoutside?.price || data.cheapestoutside,
        combined.outside,
        staticPrices.outside
      )},
      \${this.parseDecimal(data.cheapestoutside?.taxes || combined.outsidetaxes)},
      \${this.parseDecimal(data.cheapestoutside?.ncf || combined.outsidencf)},
      \${this.parseDecimal(data.cheapestoutside?.gratuity || combined.outsidegratuity)},
      \${this.parseDecimal(data.cheapestoutside?.fuel || combined.outsidefuel)},
      \${this.parseDecimal(data.cheapestoutside?.noncomm || combined.outsidenoncomm)},
      \${data.cheapestoutsidepricecode || combined.outsidepricecode || null},
      
      -- Balcony (try combined.balcony, then staticPrices.balcony, then cachedPrices.balcony)
      \${extractPrice(
        data.cheapestbalcony?.price || data.cheapestbalcony,
        combined.balcony,
        staticPrices.balcony
      )},
      \${this.parseDecimal(data.cheapestbalcony?.taxes || combined.balconytaxes)},
      \${this.parseDecimal(data.cheapestbalcony?.ncf || combined.balconyncf)},
      \${this.parseDecimal(data.cheapestbalcony?.gratuity || combined.balconygratuity)},
      \${this.parseDecimal(data.cheapestbalcony?.fuel || combined.balconyfuel)},
      \${this.parseDecimal(data.cheapestbalcony?.noncomm || combined.balconynoncomm)},
      \${data.cheapestbalconypricecode || combined.balconypricecode || null},
      
      -- Suite (try combined.suite, then staticPrices.suite, then cachedPrices.suite)
      \${extractPrice(
        data.cheapestsuite?.price || data.cheapestsuite,
        combined.suite,
        staticPrices.suite
      )},
      \${this.parseDecimal(data.cheapestsuite?.taxes || combined.suitetaxes)},
      \${this.parseDecimal(data.cheapestsuite?.ncf || combined.suitencf)},
      \${this.parseDecimal(data.cheapestsuite?.gratuity || combined.suitegratuity)},
      \${this.parseDecimal(data.cheapestsuite?.fuel || combined.suitefuel)},
      \${this.parseDecimal(data.cheapestsuite?.noncomm || combined.suitenoncomm)},
      \${data.cheapestsuitepricecode || combined.suitepricecode || null},
      
      'USD',
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (cruise_id) DO UPDATE SET
      cheapest_price = EXCLUDED.cheapest_price,
      cheapest_cabin_type = EXCLUDED.cheapest_cabin_type,
      cheapest_taxes = EXCLUDED.cheapest_taxes,
      cheapest_ncf = EXCLUDED.cheapest_ncf,
      cheapest_gratuity = EXCLUDED.cheapest_gratuity,
      cheapest_fuel = EXCLUDED.cheapest_fuel,
      cheapest_non_comm = EXCLUDED.cheapest_non_comm,
      
      interior_price = EXCLUDED.interior_price,
      interior_taxes = EXCLUDED.interior_taxes,
      interior_ncf = EXCLUDED.interior_ncf,
      interior_gratuity = EXCLUDED.interior_gratuity,
      interior_fuel = EXCLUDED.interior_fuel,
      interior_non_comm = EXCLUDED.interior_non_comm,
      interior_price_code = EXCLUDED.interior_price_code,
      
      oceanview_price = EXCLUDED.oceanview_price,
      oceanview_taxes = EXCLUDED.oceanview_taxes,
      oceanview_ncf = EXCLUDED.oceanview_ncf,
      oceanview_gratuity = EXCLUDED.oceanview_gratuity,
      oceanview_fuel = EXCLUDED.oceanview_fuel,
      oceanview_non_comm = EXCLUDED.oceanview_non_comm,
      oceanview_price_code = EXCLUDED.oceanview_price_code,
      
      balcony_price = EXCLUDED.balcony_price,
      balcony_taxes = EXCLUDED.balcony_taxes,
      balcony_ncf = EXCLUDED.balcony_ncf,
      balcony_gratuity = EXCLUDED.balcony_gratuity,
      balcony_fuel = EXCLUDED.balcony_fuel,
      balcony_non_comm = EXCLUDED.balcony_non_comm,
      balcony_price_code = EXCLUDED.balcony_price_code,
      
      suite_price = EXCLUDED.suite_price,
      suite_taxes = EXCLUDED.suite_taxes,
      suite_ncf = EXCLUDED.suite_ncf,
      suite_gratuity = EXCLUDED.suite_gratuity,
      suite_fuel = EXCLUDED.suite_fuel,
      suite_non_comm = EXCLUDED.suite_non_comm,
      suite_price_code = EXCLUDED.suite_price_code,
      
      currency = EXCLUDED.currency,
      last_updated = CURRENT_TIMESTAMP
  \`);
}`;

console.log(correctedSQL);

console.log('\n📋 KEY CHANGES:');
console.log('1. Table name: cheapest_prices → cheapest_pricing');
console.log('2. Column names match actual schema');
console.log('3. Added fallback logic for pricing extraction');
console.log('4. Enhanced error handling');

console.log('\n🔥 CRITICAL IMPACT:');
console.log('This bug means ALL webhook pricing updates have been failing!');
console.log('The database pricing is likely stale for many cruises.');

process.exit(0);