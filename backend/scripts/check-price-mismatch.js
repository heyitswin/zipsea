/**
 * Check price mismatch between listing and detail pages
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

async function main() {
  console.log('=' .repeat(80));
  console.log('CHECKING PRICE MISMATCH FOR SPECIFIC CRUISES');
  console.log('=' .repeat(80));
  console.log();

  // Cruises reported with price mismatch
  const cruiseIds = ['2134927', '2222014'];

  try {
    for (const cruiseId of cruiseIds) {
      console.log(`\nChecking Cruise ID: ${cruiseId}`);
      console.log('-'.repeat(50));

      // Get all price data for the cruise
      const cruise = await sql`
        SELECT
          id,
          cruise_id,
          name,
          cruise_line_id,
          interior_price::decimal as interior_price,
          oceanview_price::decimal as oceanview_price,
          balcony_price::decimal as balcony_price,
          suite_price::decimal as suite_price,
          cheapest_price::decimal as cheapest_price,
          raw_data,
          updated_at,
          pg_typeof(raw_data) as data_type
        FROM cruises
        WHERE id = ${cruiseId}
      `;

      if (cruise.length === 0) {
        console.log('❌ Cruise not found');
        continue;
      }

      const c = cruise[0];
      console.log(`Name: ${c.name}`);
      console.log(`Last Updated: ${c.updated_at}`);
      console.log(`Data Type: ${c.data_type}`);

      console.log('\n📊 Database Price Columns:');
      console.log(`  cheapest_price: $${c.cheapest_price || 'null'}`);
      console.log(`  interior_price: $${c.interior_price || 'null'}`);
      console.log(`  oceanview_price: $${c.oceanview_price || 'null'}`);
      console.log(`  balcony_price: $${c.balcony_price || 'null'}`);
      console.log(`  suite_price: $${c.suite_price || 'null'}`);

      // Calculate what cheapest should be
      const prices = [c.interior_price, c.oceanview_price, c.balcony_price, c.suite_price]
        .filter(p => p !== null && p > 0);
      const calculatedCheapest = prices.length > 0 ? Math.min(...prices) : null;
      console.log(`  Calculated cheapest: $${calculatedCheapest || 'null'}`);

      // Check raw_data structure
      console.log('\n📦 Raw Data Analysis:');
      const rd = c.raw_data;

      if (typeof rd === 'string') {
        console.log('  ❌ ERROR: raw_data is still a STRING!');
        console.log(`  String length: ${rd.length} characters`);

        // Try to parse it
        try {
          const parsed = JSON.parse(rd);
          console.log('  Can be parsed to JSON');
          console.log(`  cheapestinside: $${parsed.cheapestinside || 'null'}`);
          console.log(`  cheapestoutside: $${parsed.cheapestoutside || 'null'}`);
          console.log(`  cheapestbalcony: $${parsed.cheapestbalcony || 'null'}`);
          console.log(`  cheapestsuite: $${parsed.cheapestsuite || 'null'}`);
        } catch (e) {
          console.log('  Cannot parse as JSON');
        }
      } else if (typeof rd === 'object' && rd !== null) {
        console.log('  ✅ raw_data is an object');

        // Direct FTP fields
        console.log('\n  Direct FTP Fields:');
        console.log(`    cheapestinside: $${rd.cheapestinside || 'null'}`);
        console.log(`    cheapestoutside: $${rd.cheapestoutside || 'null'}`);
        console.log(`    cheapestbalcony: $${rd.cheapestbalcony || 'null'}`);
        console.log(`    cheapestsuite: $${rd.cheapestsuite || 'null'}`);

        // cheapest object
        if (rd.cheapest) {
          console.log('\n  cheapest.prices:');
          if (rd.cheapest.prices) {
            console.log(`    inside: $${rd.cheapest.prices.inside || 'null'}`);
            console.log(`    outside: $${rd.cheapest.prices.outside || 'null'}`);
            console.log(`    balcony: $${rd.cheapest.prices.balcony || 'null'}`);
            console.log(`    suite: $${rd.cheapest.prices.suite || 'null'}`);
          } else {
            console.log('    No prices object');
          }

          if (rd.cheapest.cachedprices) {
            console.log('\n  cheapest.cachedprices (STALE):');
            console.log(`    inside: $${rd.cheapest.cachedprices.inside || 'null'}`);
            console.log(`    outside: $${rd.cheapest.cachedprices.outside || 'null'}`);
            console.log(`    balcony: $${rd.cheapest.cachedprices.balcony || 'null'}`);
            console.log(`    suite: $${rd.cheapest.cachedprices.suite || 'null'}`);
          }

          if (rd.cheapest.combined) {
            console.log('\n  cheapest.combined (MIXED):');
            console.log(`    inside: $${rd.cheapest.combined.inside || 'null'}`);
            console.log(`    outside: $${rd.cheapest.combined.outside || 'null'}`);
            console.log(`    balcony: $${rd.cheapest.combined.balcony || 'null'}`);
            console.log(`    suite: $${rd.cheapest.combined.suite || 'null'}`);
          }
        }

        // Check for Riviera Travel special pricing
        if (c.cruise_line_id === 329) {
          console.log('\n  ⚠️  Riviera Travel (line 329) - prices should be divided by 1000');
        }
      }

      // Check cheapest_pricing table
      console.log('\n💰 Cheapest Pricing Table:');
      const cheapestPricing = await sql`
        SELECT
          interior_price,
          oceanview_price,
          balcony_price,
          suite_price,
          cheapest_price,
          last_updated
        FROM cheapest_pricing
        WHERE cruise_id = ${cruiseId}
      `;

      if (cheapestPricing.length > 0) {
        const cp = cheapestPricing[0];
        console.log(`  interior_price: $${cp.interior_price || 'null'}`);
        console.log(`  oceanview_price: $${cp.oceanview_price || 'null'}`);
        console.log(`  balcony_price: $${cp.balcony_price || 'null'}`);
        console.log(`  suite_price: $${cp.suite_price || 'null'}`);
        console.log(`  cheapest_price: $${cp.cheapest_price || 'null'}`);
        console.log(`  last_updated: ${cp.last_updated}`);
      } else {
        console.log('  No entry in cheapest_pricing table');
      }

      // Check what needs fixing
      console.log('\n🔧 Issues Found:');
      let hasIssues = false;

      if (typeof rd === 'string') {
        console.log('  ❌ raw_data is still a JSON string - needs fixing');
        hasIssues = true;
      }

      if (calculatedCheapest && Math.abs(c.cheapest_price - calculatedCheapest) > 0.01) {
        console.log(`  ❌ cheapest_price ($${c.cheapest_price}) doesn't match calculated ($${calculatedCheapest})`);
        hasIssues = true;
      }

      if (rd.cheapest?.cachedprices && rd.cheapestinside) {
        const cached = parseFloat(rd.cheapest.cachedprices.inside);
        const fresh = parseFloat(rd.cheapestinside);
        if (Math.abs(cached - fresh) > 0.01) {
          console.log(`  ⚠️  Cached prices differ from fresh FTP data`);
        }
      }

      if (!hasIssues) {
        console.log('  ✅ No issues found');
      }
    }

    // Check frontend endpoints
    console.log('\n' + '=' .repeat(80));
    console.log('FRONTEND DATA SOURCE ANALYSIS:');
    console.log('=' .repeat(80));
    console.log('\nThe frontend likely uses different endpoints:');
    console.log('1. Listing page (/cruises) might use:');
    console.log('   - GET /api/cruises or /api/search');
    console.log('   - Fields: cheapest_price from cruises table');
    console.log('\n2. Detail page (/cruise/:id) might use:');
    console.log('   - GET /api/cruises/:id');
    console.log('   - Fields: Could be using raw_data prices or cheapest_pricing table');
    console.log('\nRecommendation: Check frontend code to see which fields each page uses');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

main();
