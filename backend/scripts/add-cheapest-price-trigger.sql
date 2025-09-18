-- Database trigger to automatically populate cheapest_price field
-- This ensures that ANY insert or update to cheapest_pricing table
-- will automatically calculate and set the cheapest_price field

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS calculate_cheapest_price_trigger ON cheapest_pricing;
DROP FUNCTION IF EXISTS calculate_cheapest_price();

-- Create function to calculate cheapest price
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

-- Create trigger that fires before INSERT or UPDATE
CREATE TRIGGER calculate_cheapest_price_trigger
BEFORE INSERT OR UPDATE ON cheapest_pricing
FOR EACH ROW
EXECUTE FUNCTION calculate_cheapest_price();

-- Test the trigger by updating a sample record
-- This will show if the trigger is working
DO $$
DECLARE
  test_id UUID;
BEGIN
  -- Get a sample record to test
  SELECT cruise_id INTO test_id
  FROM cheapest_pricing
  WHERE interior_price IS NOT NULL
  LIMIT 1;

  IF test_id IS NOT NULL THEN
    -- Update the record (trigger will fire)
    UPDATE cheapest_pricing
    SET interior_price = interior_price
    WHERE cruise_id = test_id;

    RAISE NOTICE 'Trigger test completed for cruise_id: %', test_id;
  END IF;
END $$;

-- Verify the trigger is installed
SELECT
  tgname as trigger_name,
  tgtype as trigger_type,
  proname as function_name
FROM pg_trigger
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
WHERE tgname = 'calculate_cheapest_price_trigger';

-- Show count of records that will be automatically fixed
SELECT
  COUNT(*) as records_needing_cheapest_price
FROM cheapest_pricing
WHERE cheapest_price IS NULL
  AND (interior_price IS NOT NULL
    OR oceanview_price IS NOT NULL
    OR balcony_price IS NOT NULL
    OR suite_price IS NOT NULL);

-- Final message
SELECT 'Trigger installed successfully! All future inserts and updates will automatically calculate cheapest_price.' as message;
