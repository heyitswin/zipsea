-- Migration to fix alternative_sailings table schema mismatch
-- Current schema has wrong columns, need to match the code expectations

BEGIN;

-- First, backup existing data if any
CREATE TABLE IF NOT EXISTS alternative_sailings_backup AS
SELECT * FROM alternative_sailings;

-- Drop the existing table with wrong schema
DROP TABLE IF EXISTS alternative_sailings CASCADE;

-- Create table with correct schema matching the code
CREATE TABLE alternative_sailings (
  id SERIAL PRIMARY KEY,
  base_cruise_id VARCHAR(255) NOT NULL,
  alternative_cruise_id VARCHAR(255) NOT NULL,
  sailing_date DATE,
  similarity_score DECIMAL(3, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_alt_sailings_base_cruise ON alternative_sailings(base_cruise_id);
CREATE INDEX idx_alt_sailings_alt_cruise ON alternative_sailings(alternative_cruise_id);
CREATE INDEX idx_alt_sailings_date ON alternative_sailings(sailing_date);

-- Add foreign key constraints
ALTER TABLE alternative_sailings
  ADD CONSTRAINT fk_base_cruise
  FOREIGN KEY (base_cruise_id)
  REFERENCES cruises(id)
  ON DELETE CASCADE;

ALTER TABLE alternative_sailings
  ADD CONSTRAINT fk_alternative_cruise
  FOREIGN KEY (alternative_cruise_id)
  REFERENCES cruises(id)
  ON DELETE CASCADE;

-- Add comment explaining the table
COMMENT ON TABLE alternative_sailings IS 'Stores alternative sailing options for cruises with similarity scores';
COMMENT ON COLUMN alternative_sailings.similarity_score IS 'Score from 0.00 to 1.00 indicating how similar the sailings are';

COMMIT;
