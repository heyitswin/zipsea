#!/usr/bin/env node

/**
 * Check ship images in the database
 */

const { db } = require('../dist/db/connection');
const { ships } = require('../dist/db/schema');
const { sql } = require('drizzle-orm');

async function checkShipImages() {
  try {
    console.log('Checking ship images in database...\n');

    // Get count of ships with and without images
    const stats = await db.execute(sql`
      SELECT
        COUNT(*) as total_ships,
        COUNT(default_ship_image) as ships_with_images,
        COUNT(*) - COUNT(default_ship_image) as ships_without_images,
        COUNT(CASE WHEN default_ship_image IS NOT NULL AND default_ship_image != '' THEN 1 END) as ships_with_valid_images
      FROM ships
      WHERE is_active = true
    `);

    console.log('Ship Image Statistics:');
    console.log('----------------------');
    console.log(`Total active ships: ${stats.rows[0].total_ships}`);
    console.log(`Ships with images: ${stats.rows[0].ships_with_images}`);
    console.log(`Ships without images: ${stats.rows[0].ships_without_images}`);
    console.log(`Ships with valid (non-empty) images: ${stats.rows[0].ships_with_valid_images}`);
    console.log();

    // Get sample of ships with images
    const shipsWithImages = await db.execute(sql`
      SELECT
        id,
        name,
        default_ship_image,
        default_ship_image_hd,
        default_ship_image_2k
      FROM ships
      WHERE default_ship_image IS NOT NULL
        AND default_ship_image != ''
        AND is_active = true
      LIMIT 5
    `);

    if (shipsWithImages.rows.length > 0) {
      console.log('Sample ships WITH images:');
      console.log('-------------------------');
      shipsWithImages.rows.forEach(ship => {
        console.log(`Ship: ${ship.name} (ID: ${ship.id})`);
        console.log(`  Image: ${ship.default_ship_image}`);
        console.log(`  HD: ${ship.default_ship_image_hd || 'N/A'}`);
        console.log(`  2K: ${ship.default_ship_image_2k || 'N/A'}`);
        console.log();
      });
    }

    // Get sample of ships without images
    const shipsWithoutImages = await db.execute(sql`
      SELECT
        id,
        name,
        cruise_line_id
      FROM ships
      WHERE (default_ship_image IS NULL OR default_ship_image = '')
        AND is_active = true
      LIMIT 5
    `);

    if (shipsWithoutImages.rows.length > 0) {
      console.log('Sample ships WITHOUT images:');
      console.log('-----------------------------');
      shipsWithoutImages.rows.forEach(ship => {
        console.log(`Ship: ${ship.name} (ID: ${ship.id}, Line ID: ${ship.cruise_line_id})`);
      });
      console.log();
    }

    // Check last minute deals ships specifically
    console.log('Checking Last Minute Deals Ships:');
    console.log('----------------------------------');

    const lastMinuteShips = await db.execute(sql`
      SELECT DISTINCT
        s.id,
        s.name as ship_name,
        cl.name as cruise_line_name,
        s.default_ship_image,
        COUNT(c.id) as cruise_count
      FROM cruises c
      LEFT JOIN ships s ON c.ship_id = s.id
      LEFT JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE + INTERVAL '21 days'
        AND c.sailing_date <= CURRENT_DATE + INTERVAL '1 year'
        AND cl.name IN (
          'Royal Caribbean',
          'Carnival Cruise Line',
          'Princess Cruises',
          'MSC Cruises',
          'Norwegian Cruise Line',
          'Celebrity Cruises'
        )
      GROUP BY s.id, s.name, cl.name, s.default_ship_image
      ORDER BY cl.name, s.name
      LIMIT 20
    `);

    lastMinuteShips.rows.forEach(ship => {
      const hasImage = ship.default_ship_image && ship.default_ship_image !== '';
      console.log(`${ship.cruise_line_name} - ${ship.ship_name}:`);
      console.log(`  Has image: ${hasImage ? 'YES' : 'NO'}`);
      if (hasImage) {
        console.log(`  Image URL: ${ship.default_ship_image}`);
      }
      console.log(`  Active cruises: ${ship.cruise_count}`);
      console.log();
    });

  } catch (error) {
    console.error('Error checking ship images:', error);
  } finally {
    process.exit(0);
  }
}

checkShipImages();
