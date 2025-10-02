const { Pool } = require('pg');
require('dotenv').config();

async function checkShipImages() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Get sample ship image data
    const result = await pool.query(`
      SELECT 
        id,
        name,
        default_ship_image IS NOT NULL as has_standard,
        default_ship_image_hd IS NOT NULL as has_hd,
        default_ship_image_2k IS NOT NULL as has_2k,
        default_ship_image,
        default_ship_image_hd,
        default_ship_image_2k
      FROM ships
      WHERE default_ship_image IS NOT NULL 
         OR default_ship_image_hd IS NOT NULL 
         OR default_ship_image_2k IS NOT NULL
      LIMIT 10
    `);

    console.log('\n=== Ship Image Data Sample ===\n');
    result.rows.forEach(ship => {
      console.log(`Ship: ${ship.name} (ID: ${ship.id})`);
      console.log(`  Has Standard: ${ship.has_standard}`);
      console.log(`  Has HD: ${ship.has_hd}`);
      console.log(`  Has 2K: ${ship.has_2k}`);
      if (ship.default_ship_image) console.log(`  Standard: ${ship.default_ship_image.substring(0, 80)}...`);
      if (ship.default_ship_image_hd) console.log(`  HD: ${ship.default_ship_image_hd.substring(0, 80)}...`);
      if (ship.default_ship_image_2k) console.log(`  2K: ${ship.default_ship_image_2k.substring(0, 80)}...`);
      console.log('');
    });

    // Check overall statistics
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_ships,
        COUNT(default_ship_image) as ships_with_standard,
        COUNT(default_ship_image_hd) as ships_with_hd,
        COUNT(default_ship_image_2k) as ships_with_2k
      FROM ships
    `);

    console.log('=== Overall Statistics ===');
    console.log(stats.rows[0]);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkShipImages();
