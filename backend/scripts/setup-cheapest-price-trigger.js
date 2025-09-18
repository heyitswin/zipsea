const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupCheapestPriceTrigger() {
  try {
    await client.connect();
    console.log('🔧 SETTING UP AUTOMATIC cheapest_price CALCULATION');
    console.log('=' + '='.repeat(70));
    console.log('');
    console.log('This creates a database trigger that automatically calculates');
    console.log('cheapest_price whenever prices are inserted or updated.\n');

    // Drop existing trigger if it exists
    console.log('Step 1: Removing any existing trigger...');
    await client.query(`
      DROP TRIGGER IF EXISTS calculate_cheapest_price_trigger ON cheapest_pricing;
      DROP FUNCTION IF EXISTS calculate_cheapest_price();
    `);

    // Create the trigger function
    console.log('Step 2: Creating trigger function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION calculate_cheapest_price()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Calculate the minimum price from all cabin types
        NEW.cheapest_price := LEAST(
          COALESCE(NEW.interior_price, 999999),
          COALESCE(NEW.oceanview_price, 999999),
          COALESCE(NEW.balcony_price, 999999),
          COALESCE(NEW.suite_price, 999999)
        );

        -- If all prices are null (result would be 999999), set to null
        IF NEW.cheapest_price = 999999 THEN
          NEW.cheapest_price := NULL;
        END IF;

        -- Also set cheapest_cabin_type based on which price matches
        IF NEW.cheapest_price IS NOT NULL THEN
          CASE
            WHEN NEW.cheapest_price = NEW.interior_price THEN
              NEW.cheapest_cabin_type := 'interior';
            WHEN NEW.cheapest_price = NEW.oceanview_price THEN
              NEW.cheapest_cabin_type := 'oceanview';
            WHEN NEW.cheapest_price = NEW.balcony_price THEN
              NEW.cheapest_cabin_type := 'balcony';
            WHEN NEW.cheapest_price = NEW.suite_price THEN
              NEW.cheapest_cabin_type := 'suite';
          END CASE;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create the trigger
    console.log('Step 3: Creating trigger...');
    await client.query(`
      CREATE TRIGGER calculate_cheapest_price_trigger
      BEFORE INSERT OR UPDATE ON cheapest_pricing
      FOR EACH ROW
      EXECUTE FUNCTION calculate_cheapest_price();
    `);

    console.log('✅ Trigger created successfully!\n');

    // Verify the trigger exists
    const verifyResult = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_trigger
      WHERE tgname = 'calculate_cheapest_price_trigger'
    `);

    if (verifyResult.rows[0].count > 0) {
      console.log('✅ Verification: Trigger is installed and active\n');
    } else {
      console.log('⚠️  Warning: Trigger verification failed\n');
    }

    // Test the trigger with a sample insert
    console.log('Step 4: Testing trigger with sample data...');

    // Create a test record
    const testId = 'test-' + Date.now();
    await client.query(`
      INSERT INTO cheapest_pricing (
        cruise_id,
        interior_price,
        oceanview_price,
        balcony_price,
        suite_price
      ) VALUES ($1, 1000, 1200, 1500, 2000)
      ON CONFLICT (cruise_id) DO UPDATE
      SET interior_price = 1000
    `, [testId]);

    // Check if cheapest_price was set
    const testResult = await client.query(`
      SELECT cheapest_price, cheapest_cabin_type
      FROM cheapest_pricing
      WHERE cruise_id = $1
    `, [testId]);

    if (testResult.rows[0] && testResult.rows[0].cheapest_price === '1000.00') {
      console.log('✅ Test passed! Trigger correctly set:');
      console.log(`   cheapest_price: $${testResult.rows[0].cheapest_price}`);
      console.log(`   cheapest_cabin_type: ${testResult.rows[0].cheapest_cabin_type}\n`);

      // Clean up test record
      await client.query(`DELETE FROM cheapest_pricing WHERE cruise_id = $1`, [testId]);
    } else {
      console.log('⚠️  Test failed - trigger may not be working correctly\n');
    }

    // Fix existing records that need cheapest_price
    console.log('Step 5: Fixing existing records...');

    const updateResult = await client.query(`
      UPDATE cheapest_pricing
      SET interior_price = interior_price
      WHERE cheapest_price IS NULL
        AND (interior_price IS NOT NULL
          OR oceanview_price IS NOT NULL
          OR balcony_price IS NOT NULL
          OR suite_price IS NOT NULL)
    `);

    console.log(`✅ Fixed ${updateResult.rowCount} existing records\n`);

    // Final check
    const finalCheck = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN cheapest_price IS NOT NULL THEN 1 END) as has_cheapest
      FROM cheapest_pricing
      WHERE interior_price IS NOT NULL
        OR oceanview_price IS NOT NULL
        OR balcony_price IS NOT NULL
        OR suite_price IS NOT NULL
    `);

    console.log('=' + '='.repeat(70));
    console.log('✨ SETUP COMPLETE!');
    console.log(`Records with prices: ${finalCheck.rows[0].total}`);
    console.log(`Records with cheapest_price: ${finalCheck.rows[0].has_cheapest}`);
    console.log('');
    console.log('🎉 From now on, cheapest_price will be automatically calculated');
    console.log('   for ALL new cruises and price updates!');
    console.log('');
    console.log('The search should now show all cruises with prices.');

  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  } finally {
    await client.end();
    process.exit(0);
  }
}

// Run the setup
setupCheapestPriceTrigger();
