require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function extractPrices() {
  try {
    const result = await pool.query(`
      SELECT 
        raw_data,
        raw_data->>'cheapestinside' as cheapest_inside,
        raw_data->>'cheapestoutside' as cheapest_outside,
        raw_data->>'cheapestbalcony' as cheapest_balcony,
        raw_data->>'cheapestsuite' as cheapest_suite,
        raw_data->'cheapest'->>'inside' as cheapest_obj_inside,
        raw_data->'cheapest'->'combined'->>'inside' as cheapest_combined_inside,
        jsonb_array_length(COALESCE(raw_data->'cabins', '[]'::jsonb)) as cabin_count
      FROM cruises
      WHERE id = '2145865'
    `);
    
    if (result.rows.length > 0) {
      const data = result.rows[0];
      console.log('\n📊 PRICE EXTRACTION FROM RAW_DATA:');
      console.log('=' .repeat(50));
      
      console.log('\nTop-level fields:');
      console.log(`  cheapestinside:  $${data.cheapest_inside || 'NULL'}`);
      console.log(`  cheapestoutside: $${data.cheapest_outside || 'NULL'}`);
      console.log(`  cheapestbalcony: $${data.cheapest_balcony || 'NULL'}`);
      console.log(`  cheapestsuite:   $${data.cheapest_suite || 'NULL'}`);
      
      console.log('\nCheapest object fields:');
      console.log(`  cheapest.inside: $${data.cheapest_obj_inside || 'NULL'}`);
      console.log(`  cheapest.combined.inside: $${data.cheapest_combined_inside || 'NULL'}`);
      
      console.log(`\nCabin count: ${data.cabin_count || 0}`);
      
      // Get actual raw_data to check structure
      if (data.raw_data) {
        const raw = data.raw_data;
        
        // Check if cheapest exists
        if (raw.cheapest) {
          console.log('\n✅ cheapest object exists');
          if (raw.cheapest.combined) {
            console.log('  ✅ cheapest.combined exists');
            console.log(`    inside:  $${raw.cheapest.combined.inside || 'N/A'}`);
            console.log(`    outside: $${raw.cheapest.combined.outside || 'N/A'}`);
            console.log(`    balcony: $${raw.cheapest.combined.balcony || 'N/A'}`);
            console.log(`    suite:   $${raw.cheapest.combined.suite || 'N/A'}`);
          }
        }
        
        // Check cabins
        if (raw.cabins) {
          const cabinsArray = Object.values(raw.cabins);
          console.log(`\n📦 Cabins: ${cabinsArray.length} total`);
          
          // Get first 3 cabin prices
          const firstThree = cabinsArray.slice(0, 3);
          console.log('\nFirst 3 cabin prices:');
          firstThree.forEach((cabin, i) => {
            console.log(`  Cabin ${i+1}: $${cabin.price || 'N/A'} (${cabin.cabintype || 'Unknown type'})`);
          });
          
          // Find cheapest by type
          const byType = {};
          cabinsArray.forEach(cabin => {
            if (cabin.price && cabin.cabintype) {
              const type = cabin.cabintype.toLowerCase();
              const price = parseFloat(cabin.price);
              
              let category = 'other';
              if (type.includes('inside') || type.includes('interior')) category = 'interior';
              else if (type.includes('outside') || type.includes('ocean')) category = 'oceanview';
              else if (type.includes('balcony')) category = 'balcony';
              else if (type.includes('suite')) category = 'suite';
              
              if (!byType[category] || price < byType[category]) {
                byType[category] = price;
              }
            }
          });
          
          console.log('\nCheapest cabin by type:');
          console.log(`  Interior:  $${byType.interior || 'N/A'}`);
          console.log(`  Oceanview: $${byType.oceanview || 'N/A'}`);
          console.log(`  Balcony:   $${byType.balcony || 'N/A'}`);
          console.log(`  Suite:     $${byType.suite || 'N/A'}`);
        }
      }
    }
    
    // Compare with what's in the database
    const dbPrices = await pool.query(`
      SELECT interior_price, oceanview_price, balcony_price, suite_price
      FROM cruises
      WHERE id = '2145865'
    `);
    
    if (dbPrices.rows.length > 0) {
      const prices = dbPrices.rows[0];
      console.log('\n⚠️  CURRENT DATABASE PRICES:');
      console.log(`  Interior:  $${prices.interior_price}`);
      console.log(`  Oceanview: $${prices.oceanview_price}`);
      console.log(`  Balcony:   $${prices.balcony_price}`);
      console.log(`  Suite:     $${prices.suite_price}`);
      
      console.log('\n❌ DATABASE HAS WRONG PRICES!');
      console.log('The webhook processor is using the wrong extraction logic.');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

extractPrices();
