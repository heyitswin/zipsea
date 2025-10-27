require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

// Test multiple cruises to verify cached pricing accuracy
const TEST_CRUISES = [
  { id: '2106593', name: 'Harmony of the Seas - Mar 2026' },
  { id: '2144436', name: 'Quantum of the Seas - Apr 2026' },
  { id: '2219483', name: 'Utopia of the Seas - May 2026' },
  { id: '2190559', name: 'Brilliance of the Seas - Jun 2026' },
  { id: '2220320', name: 'Spectrum of the Seas - Jul 2026' },
];

const databaseUrl = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
const isProduction = databaseUrl && databaseUrl.includes('render.com');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

async function checkPricing() {
  console.log('📊 CACHED PRICING COMPARISON (Database Per-Person Prices)\n');
  console.log('=' .repeat(80));

  try {
    for (const cruise of TEST_CRUISES) {
      const query = `
        SELECT
          c.id, c.name, c.sailing_date, c.nights, c.cruise_line_id,
          cp.interior_price, cp.oceanview_price, cp.balcony_price,
          cp.suite_price, cp.cheapest_price
        FROM cruises c
        LEFT JOIN cheapest_pricing cp ON c.id = cp.cruise_id
        WHERE c.id = $1
      `;

      const result = await pool.query(query, [cruise.id]);

      if (result.rows.length === 0) {
        console.log(`\n❌ ${cruise.name} (ID: ${cruise.id})`);
        console.log('   NOT FOUND IN DATABASE\n');
        continue;
      }

      const data = result.rows[0];

      console.log(`\n✅ ${cruise.name}`);
      console.log(`   Cruise ID: ${cruise.id}`);
      console.log(`   Sailing: ${data.sailing_date?.toISOString().split('T')[0]}`);
      console.log(`   Nights: ${data.nights}`);
      console.log('   ---');
      console.log('   Per-Person Prices (for 2 adults):');

      if (data.interior_price) {
        const perPerson = parseFloat(data.interior_price);
        const totalFor2 = perPerson * 2;
        console.log(`   Interior:   $${perPerson.toFixed(2)} pp → $${totalFor2.toFixed(2)} total`);
      }

      if (data.oceanview_price) {
        const perPerson = parseFloat(data.oceanview_price);
        const totalFor2 = perPerson * 2;
        console.log(`   Oceanview:  $${perPerson.toFixed(2)} pp → $${totalFor2.toFixed(2)} total`);
      }

      if (data.balcony_price) {
        const perPerson = parseFloat(data.balcony_price);
        const totalFor2 = perPerson * 2;
        console.log(`   Balcony:    $${perPerson.toFixed(2)} pp → $${totalFor2.toFixed(2)} total`);
      }

      if (data.suite_price) {
        const perPerson = parseFloat(data.suite_price);
        const totalFor2 = perPerson * 2;
        console.log(`   Suite:      $${perPerson.toFixed(2)} pp → $${totalFor2.toFixed(2)} total`);
      }

      if (data.cheapest_price) {
        const perPerson = parseFloat(data.cheapest_price);
        const totalFor2 = perPerson * 2;
        console.log(`   Cheapest:   $${perPerson.toFixed(2)} pp → $${totalFor2.toFixed(2)} total`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📝 NOTE: These are cached prices from our database.');
    console.log('To verify accuracy, compare with live pricing on staging frontend:');
    console.log('https://zipsea-frontend-staging.onrender.com/cruise/[cruise-slug-here]\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkPricing().catch(console.error);
