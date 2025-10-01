-- Fix price_history and price_trends cruise_id type from INTEGER to VARCHAR
-- This migration fixes the type mismatch where cruise_id should be VARCHAR to match cruises.id

-- Step 1: Drop foreign key constraints
ALTER TABLE "price_history" DROP CONSTRAINT IF EXISTS "price_history_cruise_id_cruises_id_fk";
ALTER TABLE "price_trends" DROP CONSTRAINT IF EXISTS "price_trends_cruise_id_cruises_id_fk";

-- Step 2: Change cruise_id column type from INTEGER to VARCHAR
ALTER TABLE "price_history" ALTER COLUMN "cruise_id" TYPE varchar(255) USING "cruise_id"::varchar;
ALTER TABLE "price_trends" ALTER COLUMN "cruise_id" TYPE varchar(255) USING "cruise_id"::varchar;

-- Step 3: Recreate foreign key constraints with correct type
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_cruise_id_cruises_id_fk"
  FOREIGN KEY ("cruise_id") REFERENCES "cruises"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "price_trends" ADD CONSTRAINT "price_trends_cruise_id_cruises_id_fk"
  FOREIGN KEY ("cruise_id") REFERENCES "cruises"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Step 4: Verify indexes still work with VARCHAR type (they should)
-- Existing indexes:
-- - idx_price_history_cruise_id
-- - idx_price_history_cruise_snapshot
-- - idx_price_history_cruise_cabin_date
-- - idx_price_trends_cruise_id
-- - idx_price_trends_cruise_cabin_period
-- PostgreSQL will automatically handle these with VARCHAR type
