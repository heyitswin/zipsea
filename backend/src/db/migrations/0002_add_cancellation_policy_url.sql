-- Add cancellation_policy_url column to cruise_lines table
ALTER TABLE cruise_lines
ADD COLUMN IF NOT EXISTS cancellation_policy_url VARCHAR(500);

-- Update known cruise lines with their cancellation policy URLs
UPDATE cruise_lines SET cancellation_policy_url = 'https://www.royalcaribbean.com/faq/questions/booking-cancellation-refund-policy' WHERE name ILIKE '%royal caribbean%';
UPDATE cruise_lines SET cancellation_policy_url = 'https://www.carnival.com/popups/bookingengine/deposit-and-final-payment-cancellation-policy' WHERE name ILIKE '%carnival%';
UPDATE cruise_lines SET cancellation_policy_url = 'https://www.msccruisesusa.com/-/media/us/documents/booking-terms-and-conditions-230323.pdf' WHERE name ILIKE '%msc%';
UPDATE cruise_lines SET cancellation_policy_url = 'https://www.ncl.com/ca/en/about/cancellation-fee-schedule' WHERE name ILIKE '%norwegian%';
UPDATE cruise_lines SET cancellation_policy_url = 'https://www.princess.com/plan/standard-cancellation-refund-policy' WHERE name ILIKE '%princess%';
UPDATE cruise_lines SET cancellation_policy_url = 'https://www.celebritycruises.com/faqs/manage-plan' WHERE name ILIKE '%celebrity%';
UPDATE cruise_lines SET cancellation_policy_url = 'https://www.poamericas.com/cruise_info/payments_and_refunds.cfm' WHERE name ILIKE '%p&o%' OR name ILIKE '%p & o%';
UPDATE cruise_lines SET cancellation_policy_url = 'https://www.costacruises.com/refund-policy.html' WHERE name ILIKE '%costa%';
UPDATE cruise_lines SET cancellation_policy_url = 'https://disneycruise.disney.go.com/contracts-terms-safety/terms-conditions/united-states/' WHERE name ILIKE '%disney%';
UPDATE cruise_lines SET cancellation_policy_url = 'https://media.aida.de/fileadmin/user_upload/v4/Extranet_International/Footer/AIDA_Travel_Terms_Conditions_2014-2015.pdf' WHERE name ILIKE '%aida%';
UPDATE cruise_lines SET cancellation_policy_url = 'https://www.hollandamerica.com/en/gb/legal-privacy/cancellation-policy-uk' WHERE name ILIKE '%holland america%';
UPDATE cruise_lines SET cancellation_policy_url = 'https://www.cunard.com/en-us/advice-and-policies/standard-cancellation-refund-policy' WHERE name ILIKE '%cunard%';
UPDATE cruise_lines SET cancellation_policy_url = 'https://www.virginvoyages.com/flexible-booking-policy' WHERE name ILIKE '%virgin%';
UPDATE cruise_lines SET cancellation_policy_url = 'https://docs.vikingcruises.com/pdf/2-210416_BookingAndSaleTermsAndConditions-US.pdf' WHERE name ILIKE '%viking%';
UPDATE cruise_lines SET cancellation_policy_url = 'https://www.silversea.com/terms-and-conditions/world-cruise---terms-and-conditions.html' WHERE name ILIKE '%silversea%';
