-- Update cancellation policy URLs for all cruise lines
-- Run this script against the production database

UPDATE cruise_lines SET cancellation_policy_url = 'https://www.royalcaribbean.com/faq/questions/booking-cancellation-refund-policy' WHERE LOWER(name) LIKE '%royal caribbean%';

UPDATE cruise_lines SET cancellation_policy_url = 'https://www.carnival.com/popups/bookingengine/deposit-and-final-payment-cancellation-policy' WHERE LOWER(name) LIKE '%carnival%';

UPDATE cruise_lines SET cancellation_policy_url = 'https://www.msccruisesusa.com/-/media/us/documents/booking-terms-and-conditions-230323.pdf' WHERE LOWER(name) LIKE '%msc%';

UPDATE cruise_lines SET cancellation_policy_url = 'https://www.ncl.com/ca/en/about/cancellation-fee-schedule' WHERE LOWER(name) LIKE '%norwegian%';

UPDATE cruise_lines SET cancellation_policy_url = 'https://www.princess.com/plan/standard-cancellation-refund-policy' WHERE LOWER(name) LIKE '%princess%';

UPDATE cruise_lines SET cancellation_policy_url = 'https://www.celebritycruises.com/faqs/manage-plan' WHERE LOWER(name) LIKE '%celebrity%';

UPDATE cruise_lines SET cancellation_policy_url = 'https://www.poamericas.com/cruise_info/payments_and_refunds.cfm' WHERE LOWER(name) LIKE '%p&o%' OR LOWER(name) LIKE '%p & o%';

UPDATE cruise_lines SET cancellation_policy_url = 'https://www.costacruises.com/refund-policy.html' WHERE LOWER(name) LIKE '%costa%';

UPDATE cruise_lines SET cancellation_policy_url = 'https://disneycruise.disney.go.com/contracts-terms-safety/terms-conditions/united-states/' WHERE LOWER(name) LIKE '%disney%';

UPDATE cruise_lines SET cancellation_policy_url = 'https://media.aida.de/fileadmin/user_upload/v4/Extranet_International/Footer/AIDA_Travel_Terms_Conditions_2014-2015.pdf' WHERE LOWER(name) LIKE '%aida%';

UPDATE cruise_lines SET cancellation_policy_url = 'https://www.hollandamerica.com/en/gb/legal-privacy/cancellation-policy-uk' WHERE LOWER(name) LIKE '%holland america%';

UPDATE cruise_lines SET cancellation_policy_url = 'https://www.cunard.com/en-us/advice-and-policies/standard-cancellation-refund-policy' WHERE LOWER(name) LIKE '%cunard%';

UPDATE cruise_lines SET cancellation_policy_url = 'https://www.virginvoyages.com/flexible-booking-policy' WHERE LOWER(name) LIKE '%virgin%';

UPDATE cruise_lines SET cancellation_policy_url = 'https://docs.vikingcruises.com/pdf/2-210416_BookingAndSaleTermsAndConditions-US.pdf' WHERE LOWER(name) LIKE '%viking%';

UPDATE cruise_lines SET cancellation_policy_url = 'https://www.silversea.com/terms-and-conditions/world-cruise---terms-and-conditions.html' WHERE LOWER(name) LIKE '%silversea%';

-- Verify the updates
SELECT id, name, cancellation_policy_url
FROM cruise_lines
WHERE cancellation_policy_url IS NOT NULL
ORDER BY name;
