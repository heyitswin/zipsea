const { Client } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function fixInvalidJson() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Find cruises with invalid JSON in raw_data
    const findInvalidQuery = `
      SELECT id, raw_data::text as raw_data_text
      FROM cruises
      WHERE raw_data IS NOT NULL
      LIMIT 10
    `;

    const result = await client.query(findInvalidQuery);
    console.log(`Checking ${result.rows.length} cruises for invalid JSON...`);

    let invalidCount = 0;
    let fixedCount = 0;

    for (const row of result.rows) {
      try {
        // Try to parse the JSON
        if (row.raw_data_text) {
          JSON.parse(row.raw_data_text);
        }
      } catch (error) {
        invalidCount++;
        console.log(`\nFound invalid JSON in cruise ${row.id}`);
        console.log('Error:', error.message);

        // Log first 200 chars of the problematic JSON
        if (row.raw_data_text) {
          console.log('JSON preview:', row.raw_data_text.substring(0, 200));

          // Check for common issues
          if (row.raw_data_text.includes('27,...')) {
            console.log('Found "27,..." pattern - likely truncated or malformed array');
          }

          // Try to fix common issues
          let fixed = row.raw_data_text;

          // Remove trailing commas before closing brackets
          fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

          // Fix multiple consecutive commas
          fixed = fixed.replace(/,{2,}/g, ',');

          // Try to parse the fixed version
          try {
            JSON.parse(fixed);
            console.log(`✅ Fixed JSON for cruise ${row.id}`);

            // Update the database with the fixed JSON
            await client.query(
              'UPDATE cruises SET raw_data = $1::jsonb WHERE id = $2',
              [fixed, row.id]
            );
            fixedCount++;
          } catch (fixError) {
            console.log(`❌ Could not fix JSON for cruise ${row.id}:`, fixError.message);

            // If we can't fix it, set raw_data to null to prevent errors
            await client.query(
              'UPDATE cruises SET raw_data = NULL WHERE id = $1',
              [row.id]
            );
            console.log(`Set raw_data to NULL for cruise ${row.id}`);
          }
        }
      }
    }

    // Check for the specific "27,..." issue
    console.log('\n\nChecking for specific "27,..." pattern in regions...');

    const regionsQuery = `
      SELECT id, raw_data->>'regions' as regions_data
      FROM cruises
      WHERE raw_data->>'regions' LIKE '%27,%'
      LIMIT 10
    `;

    try {
      const regionsResult = await client.query(regionsQuery);
      console.log(`Found ${regionsResult.rows.length} cruises with "27,..." in regions`);

      for (const row of regionsResult.rows) {
        console.log(`Cruise ${row.id} regions:`, row.regions_data);

        // Fix the regions field
        if (row.regions_data && row.regions_data.includes('27,...')) {
          // This looks like a truncated array, fix it
          const fixedRegions = row.regions_data.replace('27,...', '27');

          await client.query(`
            UPDATE cruises
            SET raw_data = jsonb_set(
              raw_data,
              '{regions}',
              $1::jsonb
            )
            WHERE id = $2
          `, [JSON.stringify(fixedRegions), row.id]);

          console.log(`Fixed regions for cruise ${row.id}`);
        }
      }
    } catch (regionsError) {
      console.log('Error checking regions:', regionsError.message);
    }

    // Find any cruises with malformed raw_data that can't be cast to JSONB
    console.log('\n\nFinding cruises with completely invalid raw_data...');

    const invalidRawDataQuery = `
      SELECT id, length(raw_data::text) as data_length
      FROM cruises
      WHERE raw_data IS NOT NULL
      AND id NOT IN (
        SELECT id FROM cruises
        WHERE raw_data IS NOT NULL
        AND jsonb_typeof(raw_data) IS NOT NULL
      )
      LIMIT 10
    `;

    try {
      const invalidResult = await client.query(invalidRawDataQuery);
      console.log(`Found ${invalidResult.rows.length} cruises with invalid raw_data`);

      // Set these to NULL to prevent errors
      for (const row of invalidResult.rows) {
        await client.query(
          'UPDATE cruises SET raw_data = NULL WHERE id = $1',
          [row.id]
        );
        console.log(`Set raw_data to NULL for cruise ${row.id} (was ${row.data_length} bytes)`);
      }
    } catch (err) {
      console.log('Error finding invalid raw_data:', err.message);
    }

    console.log('\n\nSummary:');
    console.log(`Invalid JSON found: ${invalidCount}`);
    console.log(`Fixed: ${fixedCount}`);
    console.log(`Set to NULL: ${invalidCount - fixedCount}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    console.log('\nDisconnected from database');
  }
}

// Run the fix
fixInvalidJson().catch(console.error);
