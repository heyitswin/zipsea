require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

async function checkCabinImages() {
  console.log('=== CABIN IMAGE ANALYSIS ===\n');

  try {
    // 1. Check the specific Viking cruise
    const vikingQuery = `
      SELECT
        c.id,
        c.cruise_id,
        c.name,
        c.sailing_date,
        cl.name as cruise_line,
        c.interior_price,
        c.oceanview_price,
        c.balcony_price,
        c.suite_price,
        jsonb_typeof(c.raw_data) as raw_data_type,
        c.raw_data->'cheapestinsidepricecode' as inside_code,
        c.raw_data->'cheapestoutsidepricecode' as outside_code,
        c.raw_data->'cheapestbalconypricecode' as balcony_code,
        c.raw_data->'cheapestsuitepricecode' as suite_code,
        jsonb_array_length(COALESCE(c.raw_data->'cabincategories', '[]'::jsonb)) as cabin_count
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.id = '2069648'
    `;

    const vikingResult = await pool.query(vikingQuery);

    if (vikingResult.rows.length > 0) {
      const cruise = vikingResult.rows[0];
      console.log('VIKING CRUISE ANALYSIS (ID: 2069648):');
      console.log('=======================================');
      console.log(`Name: ${cruise.name}`);
      console.log(`Cruise Line: ${cruise.cruise_line}`);
      console.log(`Raw Data Type: ${cruise.raw_data_type}`);
      console.log(`Cabin Categories Count: ${cruise.cabin_count}`);
      console.log('\nPrice Codes from raw_data:');
      console.log(`  Inside: ${cruise.inside_code || 'NULL'}`);
      console.log(`  Outside: ${cruise.outside_code || 'NULL'}`);
      console.log(`  Balcony: ${cruise.balcony_code || 'NULL'}`);
      console.log(`  Suite: ${cruise.suite_code || 'NULL'}`);
      console.log('\nCabin Prices:');
      console.log(`  Interior: $${cruise.interior_price || 'N/A'}`);
      console.log(`  Oceanview: $${cruise.oceanview_price || 'N/A'}`);
      console.log(`  Balcony: $${cruise.balcony_price || 'N/A'}`);
      console.log(`  Suite: $${cruise.suite_price || 'N/A'}`);

      // Check if there are cabin categories in raw data
      const cabinCheckQuery = `
        SELECT
          c.raw_data->'cabincategories' as categories,
          jsonb_array_elements(c.raw_data->'cabincategories')->>'cabincode' as cabin_code,
          jsonb_array_elements(c.raw_data->'cabincategories')->>'imageurl' as image_url
        FROM cruises c
        WHERE c.id = '2069648'
          AND c.raw_data->'cabincategories' IS NOT NULL
        LIMIT 5
      `;

      try {
        const cabinDetails = await pool.query(cabinCheckQuery);
        if (cabinDetails.rows.length > 0) {
          console.log('\nSample Cabin Categories:');
          cabinDetails.rows.forEach((cabin, i) => {
            console.log(`  ${i + 1}. Code: ${cabin.cabin_code}, Image: ${cabin.image_url || 'NO IMAGE'}`);
          });
        } else {
          console.log('\n⚠️ No cabin categories found in raw_data!');
        }
      } catch (e) {
        console.log('\n⚠️ Error checking cabin categories:', e.message);
      }
    }

    // 2. Check broader pattern across cruise lines
    const patternQuery = `
      WITH cruise_stats AS (
        SELECT
          cl.name as cruise_line,
          COUNT(c.id) as total_cruises,
          COUNT(CASE WHEN jsonb_typeof(c.raw_data) = 'object' THEN 1 END) as has_raw_data,
          COUNT(CASE WHEN jsonb_array_length(COALESCE(c.raw_data->'cabincategories', '[]'::jsonb)) > 0 THEN 1 END) as has_cabins,
          AVG(jsonb_array_length(COALESCE(c.raw_data->'cabincategories', '[]'::jsonb))) as avg_cabin_count
        FROM cruises c
        JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        WHERE c.is_active = true
          AND c.sailing_date >= CURRENT_DATE
          AND c.sailing_date <= CURRENT_DATE + INTERVAL '3 months'
        GROUP BY cl.id, cl.name
        HAVING COUNT(*) >= 10
      )
      SELECT * FROM cruise_stats
      ORDER BY has_cabins DESC
      LIMIT 20
    `;

    const patternResult = await pool.query(patternQuery);

    console.log('\n\nCABIN DATA AVAILABILITY BY CRUISE LINE:');
    console.log('=========================================');
    console.log('Cruise Line                    | Total | Has Raw | Has Cabins | Avg Count');
    console.log('-------------------------------|-------|---------|------------|----------');

    patternResult.rows.forEach(row => {
      const name = row.cruise_line.padEnd(30).substring(0, 30);
      const total = String(row.total_cruises).padStart(5);
      const hasRaw = String(row.has_raw_data).padStart(7);
      const hasCabins = String(row.has_cabins).padStart(10);
      const avgCount = row.avg_cabin_count ? row.avg_cabin_count.toFixed(1).padStart(9) : 'N/A'.padStart(9);

      console.log(`${name} | ${total} | ${hasRaw} | ${hasCabins} | ${avgCount}`);
    });

    // 3. Check for broken image patterns
    const brokenImagesQuery = `
      WITH cabin_images AS (
        SELECT
          c.id,
          c.cruise_id,
          cl.name as cruise_line,
          c.name as cruise_name,
          jsonb_array_elements(c.raw_data->'cabincategories')->>'imageurl' as image_url,
          jsonb_array_elements(c.raw_data->'cabincategories')->>'cabincode' as cabin_code
        FROM cruises c
        JOIN cruise_lines cl ON c.cruise_line_id = cl.id
        WHERE c.is_active = true
          AND c.sailing_date >= CURRENT_DATE
          AND c.sailing_date <= CURRENT_DATE + INTERVAL '1 month'
          AND jsonb_typeof(c.raw_data) = 'object'
          AND jsonb_array_length(COALESCE(c.raw_data->'cabincategories', '[]'::jsonb)) > 0
        LIMIT 1000
      )
      SELECT
        cruise_line,
        COUNT(*) as total_cabins,
        COUNT(CASE WHEN image_url IS NULL OR image_url = '' THEN 1 END) as missing_images,
        COUNT(CASE WHEN image_url LIKE '%placeholder%' THEN 1 END) as placeholder_images
      FROM cabin_images
      GROUP BY cruise_line
      HAVING COUNT(CASE WHEN image_url IS NULL OR image_url = '' THEN 1 END) > 0
      ORDER BY missing_images DESC
    `;

    const brokenResult = await pool.query(brokenImagesQuery);

    if (brokenResult.rows.length > 0) {
      console.log('\n\nCRUISE LINES WITH MISSING CABIN IMAGES:');
      console.log('==========================================');
      console.log('Cruise Line                    | Total | Missing | Placeholder');
      console.log('-------------------------------|-------|---------|------------');

      brokenResult.rows.forEach(row => {
        const name = row.cruise_line.padEnd(30).substring(0, 30);
        const total = String(row.total_cabins).padStart(5);
        const missing = String(row.missing_images).padStart(7);
        const placeholder = String(row.placeholder_images).padStart(11);

        console.log(`${name} | ${total} | ${missing} | ${placeholder}`);
      });
    }

    // 4. Sample of cruises with no cabin categories
    const noCabinsQuery = `
      SELECT
        cl.name as cruise_line,
        COUNT(*) as cruises_without_cabins
      FROM cruises c
      JOIN cruise_lines cl ON c.cruise_line_id = cl.id
      WHERE c.is_active = true
        AND c.sailing_date >= CURRENT_DATE
        AND c.sailing_date <= CURRENT_DATE + INTERVAL '3 months'
        AND c.interior_price IS NOT NULL
        AND (
          c.raw_data IS NULL
          OR jsonb_typeof(c.raw_data) != 'object'
          OR jsonb_array_length(COALESCE(c.raw_data->'cabincategories', '[]'::jsonb)) = 0
        )
      GROUP BY cl.id, cl.name
      ORDER BY cruises_without_cabins DESC
      LIMIT 10
    `;

    const noCabinsResult = await pool.query(noCabinsQuery);

    if (noCabinsResult.rows.length > 0) {
      console.log('\n\nCRUISES WITH PRICES BUT NO CABIN CATEGORIES:');
      console.log('==============================================');

      noCabinsResult.rows.forEach(row => {
        console.log(`${row.cruise_line}: ${row.cruises_without_cabins} cruises`);
      });
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  } finally {
    await pool.end();
  }
}

checkCabinImages().catch(console.error);
