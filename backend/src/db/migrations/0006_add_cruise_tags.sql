-- Migration: Add cruise tags and cruise-tag associations
-- Created: 2025-09-30

-- Create cruise_tags table
CREATE TABLE IF NOT EXISTS cruise_tags (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create cruise_name_tags junction table
CREATE TABLE IF NOT EXISTS cruise_name_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cruise_line_id INTEGER NOT NULL,
  cruise_name VARCHAR(500) NOT NULL,
  ship_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL REFERENCES cruise_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cruise_name_tags_cruise_line_id ON cruise_name_tags(cruise_line_id);
CREATE INDEX IF NOT EXISTS idx_cruise_name_tags_ship_id ON cruise_name_tags(ship_id);
CREATE INDEX IF NOT EXISTS idx_cruise_name_tags_tag_id ON cruise_name_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_cruise_name_tags_cruise_name ON cruise_name_tags(cruise_name);
CREATE INDEX IF NOT EXISTS idx_cruise_name_tags_composite ON cruise_name_tags(cruise_line_id, cruise_name, ship_id);

-- Insert initial predefined tags
INSERT INTO cruise_tags (name, display_name, description) VALUES
  ('party-nightlife', 'Party & Nightlife', 'Cruises with vibrant nightlife, clubs, and entertainment'),
  ('kid-friendly', 'Kid-friendly Adventure', 'Family-friendly cruises with activities for children'),
  ('relaxation-spa', 'Relaxation & Spa', 'Peaceful cruises focused on wellness and relaxation'),
  ('wedding-anniversary', 'Wedding & Anniversaries', 'Romantic cruises perfect for special celebrations'),
  ('bucket-list', 'Bucket-list Destinations', 'Cruises to extraordinary and iconic destinations')
ON CONFLICT (name) DO NOTHING;

-- Add comment
COMMENT ON TABLE cruise_tags IS 'Predefined tags/categories for cruise experiences';
COMMENT ON TABLE cruise_name_tags IS 'Many-to-many relationship between cruise names and tags';
