-- Create promotions table for admin-configurable promotional messages
CREATE TABLE IF NOT EXISTS promotions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  message VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'onboard_credit',
  calculation_type VARCHAR(50) NOT NULL DEFAULT 'percentage',
  calculation_value INTEGER,
  formula TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  min_price INTEGER,
  max_price INTEGER,
  applicable_cruise_line_ids INTEGER[],
  applicable_region_ids INTEGER[],
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on is_active for faster queries
CREATE INDEX idx_promotions_is_active ON promotions(is_active);

-- Create index on priority for sorting
CREATE INDEX idx_promotions_priority ON promotions(priority DESC);

-- Insert a default onboard credit promotion
INSERT INTO promotions (name, message, type, calculation_type, calculation_value, formula, is_active, priority, notes)
VALUES (
  'Default Onboard Credit',
  '+$XXX onboard credit',
  'onboard_credit',
  'formula',
  NULL,
  'Math.floor((price * 0.2) / 10) * 10',
  true,
  100,
  'Default 20% onboard credit promotion, rounded down to nearest $10'
);
