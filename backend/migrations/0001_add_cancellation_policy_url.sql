-- Add cancellation_policy_url column to cruise_lines table
ALTER TABLE cruise_lines ADD COLUMN IF NOT EXISTS cancellation_policy_url VARCHAR(500);

-- Set Royal Caribbean's cancellation policy URL (ID 22)
UPDATE cruise_lines
SET cancellation_policy_url = 'https://www.royalcaribbean.com/faq/questions/cancellation-policy'
WHERE id = 22;

-- Set Celebrity Cruises' cancellation policy URL (if exists)
UPDATE cruise_lines
SET cancellation_policy_url = 'https://www.celebrity.com/faq/details/what-is-your-cancellation-policy'
WHERE name ILIKE '%celebrity%';
