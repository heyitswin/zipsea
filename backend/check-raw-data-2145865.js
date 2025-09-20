require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkRawData() {
  try {
    const result = await pool.query(`
      SELECT raw_data::text as raw_text
      FROM cruises
      WHERE id = '2145865'
    `);
    
    if (result.rows.length > 0) {
      const rawText = result.rows[0].raw_text;
      const rawData = JSON.parse(rawText);
      
      console.log('\n📄 COMPLETE RAW_DATA PRICING ANALYSIS FOR CRUISE 2145865:');
      console.log('=' .repeat(60));
      
      // Check top-level cheapest fields
      console.log('\nTop-level cheapest fields:');
      console.log(`  cheapestinside:  $${rawData.cheapestinside || 'NOT FOUND'}`);
      console.log(`  cheapestoutside: $${rawData.cheapestoutside || 'NOT FOUND'}`);
      console.log(`  cheapestbalcony: $${rawData.cheapestbalcony || 'NOT FOUND'}`);
      console.log(`  cheapestsuite:   $${rawData.cheapestsuite || 'NOT FOUND'}`);
      
      // Check cheapest object
      if (rawData.cheapest) {
        console.log('\nCheapest object structure:');
        if (rawData.cheapest.combined) {
          console.log('  cheapest.combined:');
          console.log(`    inside:  $${rawData.cheapest.combined.inside || 'N/A'}`);
          console.log(`    outside: $${rawData.cheapest.combined.outside || 'N/A'}`);
          console.log(`    balcony: $${rawData.cheapest.combined.balcony || 'N/A'}`);
          console.log(`    suite:   $${rawData.cheapest.combined.suite || 'N/A'}`);
        }
        if (rawData.cheapest.prices) {
          console.log('  cheapest.prices:');
          console.log(`    inside:  $${rawData.cheapest.prices.inside || 'N/A'}`);
          console.log(`    outside: $${rawData.cheapest.prices.outside || 'N/A'}`);
          console.log(`    balcony: $${rawData.cheapest.prices.balcony || 'N/A'}`);
          console.log(`    suite:   $${rawData.cheapest.prices.suite || 'N/A'}`);
        }
      }
      
      // Check individual cheapest objects
      console.log('\nIndividual cheapest objects:');
      if (rawData.cheapestinside_obj) {
        console.log(`  cheapestinside_obj.price: $${rawData.cheapestinside_obj.price || 'N/A'}`);
        console.log(`  cheapestinside_obj.adultprice: $${rawData.cheapestinside_obj.adultprice || 'N/A'}`);
      }
      if (rawData.cheapestoutside_obj) {
        console.log(`  cheapestoutside_obj.price: $${rawData.cheapestoutside_obj.price || 'N/A'}`);
        console.log(`  cheapestoutside_obj.adultprice: $${rawData.cheapestoutside_obj.adultprice || 'N/A'}`);
      }
      
      // Check cabin prices
      if (rawData.cabins) {
        const cabinPrices = [];
        const interiorPrices = [];
        const oceanviewPrices = [];
        const balconyPrices = [];
        const suitePrices = [];
        
        Object.entries(rawData.cabins).forEach(([id, cabin]) => {
          if (cabin.price) {
            const price = parseFloat(cabin.price);
            cabinPrices.push(price);
            
            // Categorize by type
            const type = (cabin.cabintype || '').toLowerCase();
            if (type.includes('inside') || type.includes('interior')) {
              interiorPrices.push(price);
            } else if (type.includes('outside') || type.includes('oceanview') || type.includes('ocean view')) {
              oceanviewPrices.push(price);
            } else if (type.includes('balcony')) {
              balconyPrices.push(price);
            } else if (type.includes('suite')) {
              suitePrices.push(price);
            }
          }
        });
        
        console.log(`\n📦 CABIN PRICES ANALYSIS (${Object.keys(rawData.cabins).length} cabins):`);
        if (interiorPrices.length > 0) {
          interiorPrices.sort((a, b) => a - b);
          console.log(`  Interior cabins (${interiorPrices.length}): $${interiorPrices[0]} - $${interiorPrices[interiorPrices.length - 1]}`);
        }
        if (oceanviewPrices.length > 0) {
          oceanviewPrices.sort((a, b) => a - b);
          console.log(`  Oceanview cabins (${oceanviewPrices.length}): $${oceanviewPrices[0]} - $${oceanviewPrices[oceanviewPrices.length - 1]}`);
        }
        if (balconyPrices.length > 0) {
          balconyPrices.sort((a, b) => a - b);
          console.log(`  Balcony cabins (${balconyPrices.length}): $${balconyPrices[0]} - $${balconyPrices[balconyPrices.length - 1]}`);
        }
        if (suitePrices.length > 0) {
          suitePrices.sort((a, b) => a - b);
          console.log(`  Suite cabins (${suitePrices.length}): $${suitePrices[0]} - $${suitePrices[suitePrices.length - 1]}`);
        }
        
        // Show sample cabin
        const firstCabin = Object.values(rawData.cabins)[0];
        console.log('\nSample cabin data:');
        console.log(`  Cabin type: ${firstCabin.cabintype}`);
        console.log(`  Price: $${firstCabin.price}`);
        console.log(`  Adult price: $${firstCabin.adultprice || 'N/A'}`);
        console.log(`  Category: ${firstCabin.category || 'N/A'}`);
      }
      
      // Check cached prices
      if (rawData.cheapest && rawData.cheapest.cachedprices) {
        console.log('\nCached prices in cheapest.cachedprices:');
        const cached = rawData.cheapest.cachedprices;
        Object.entries(cached).forEach(([key, value]) => {
          if (value && typeof value === 'object' && value.price) {
            console.log(`  ${key}: $${value.price}`);
          }
        });
      }
      
      console.log('\n🔍 ANALYSIS SUMMARY:');
      console.log('-------------------');
      console.log('The webhook processor is extracting prices from the wrong fields!');
      console.log('It\'s using the top-level cheapestinside/outside/balcony/suite fields');
      console.log('which contain the WRONG prices ($101, $121.50, etc.)');
      console.log('\nThe CORRECT prices should come from the individual cabin analysis');
      console.log('or from the cheapest.combined object if available.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkRawData();
