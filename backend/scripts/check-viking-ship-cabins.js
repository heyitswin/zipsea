const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkVikingShipCabins() {
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_PRODUCTION;
  const pool = new Pool({ connectionString });

  try {
    console.log('Checking cabin categories for Viking ship (shipId: 107)...\n');

    // Check cabin categories for ship 107
    const result = await pool.query(`
      SELECT * FROM cabin_categories
      WHERE ship_id = 107
    `);

    console.log(`Found ${result.rows.length} cabin categories for shipId 107`);

    if (result.rows.length > 0) {
      console.log('\nCabin categories:');
      result.rows.forEach(cabin => {
        console.log(`- ${cabin.name} (code: ${cabin.cabin_code}, active: ${cabin.is_active})`);
        if (cabin.image_url) {
          console.log(`  Image: ${cabin.image_url}`);
        }
      });
    }

    // Check active cabin categories
    const activeResult = await pool.query(`
      SELECT * FROM cabin_categories
      WHERE ship_id = 107 AND is_active = true
    `);

    console.log(`\nActive cabin categories: ${activeResult.rows.length}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkVikingShipCabins();
