import { index, uniqueIndex } from 'drizzle-orm/pg-core';
import { 
  users, 
  cruiseLines, 
  ships, 
  ports, 
  regions, 
  cruises, 
  alternativeSailings,
  itineraries, 
  cabinCategories, 
  pricing, 
  cheapestPricing, 
  quoteRequests, 
  savedSearches 
} from './index';

// User indexes
export const userClerkIdIndex = uniqueIndex('users_clerk_user_id_idx').on(users.clerkUserId);
export const userEmailIndex = index('users_email_idx').on(users.email);
export const userActiveIndex = index('users_active_idx').on(users.isActive);

// Cruise line indexes
export const cruiseLineNameIndex = index('cruise_lines_name_idx').on(cruiseLines.name);
export const cruiseLineActiveIndex = index('cruise_lines_active_idx').on(cruiseLines.isActive);

// Ship indexes
export const shipCruiseLineIndex = index('ships_cruise_line_idx').on(ships.cruiseLineId);
export const shipNameIndex = index('ships_name_idx').on(ships.name);
export const shipActiveIndex = index('ships_active_idx').on(ships.isActive);

// Port indexes
export const portNameIndex = index('ports_name_idx').on(ports.name);
export const portCountryIndex = index('ports_country_idx').on(ports.country);
export const portActiveIndex = index('ports_active_idx').on(ports.isActive);

// Region indexes
export const regionNameIndex = index('regions_name_idx').on(regions.name);
export const regionParentIndex = index('regions_parent_idx').on(regions.parentRegionId);
export const regionPopularIndex = index('regions_popular_idx').on(regions.isPopular);
export const regionActiveIndex = index('regions_active_idx').on(regions.isActive);

// Core cruise search indexes
export const cruiseSailingDateIndex = index('cruises_sailing_date_idx').on(cruises.sailingDate);
export const cruiseNightsIndex = index('cruises_nights_idx').on(cruises.nights);
export const cruiseCruiseLineIndex = index('cruises_cruise_line_idx').on(cruises.cruiseLineId);
export const cruiseShipIndex = index('cruises_ship_idx').on(cruises.shipId);
export const cruiseActiveIndex = index('cruises_active_idx').on(cruises.showCruise, cruises.isActive);
export const cruiseEmbarkPortIndex = index('cruises_embark_port_idx').on(cruises.embarkPortId);
export const cruiseDisembarkPortIndex = index('cruises_disembark_port_idx').on(cruises.disembarkPortId);

// Composite indexes for complex searches
export const cruiseDateNightsLineIndex = index('cruises_date_nights_line_idx').on(
  cruises.sailingDate, 
  cruises.nights, 
  cruises.cruiseLineId
);
export const cruiseDateActiveIndex = index('cruises_date_active_idx').on(
  cruises.sailingDate, 
  cruises.showCruise, 
  cruises.isActive
);
export const cruiseLineShipDateIndex = index('cruises_line_ship_date_idx').on(
  cruises.cruiseLineId, 
  cruises.shipId, 
  cruises.sailingDate
);

// Traveltek file path for sync operations
export const cruiseFilePathIndex = index('cruises_file_path_idx').on(cruises.traveltekFilePath);
export const cruiseCodeToCruiseIdIndex = uniqueIndex('cruises_code_to_cruise_id_idx').on(cruises.codeToCruiseId);

// Alternative sailings indexes
export const altSailingsBaseCruiseIndex = index('alt_sailings_base_cruise_idx').on(alternativeSailings.baseCruiseId);
export const altSailingsAltCruiseIndex = index('alt_sailings_alt_cruise_idx').on(alternativeSailings.alternativeCruiseId);
export const altSailingsDateIndex = index('alt_sailings_date_idx').on(alternativeSailings.sailingDate);

// Itinerary indexes
export const itineraryCruiseIndex = index('itineraries_cruise_idx').on(itineraries.cruiseId);
export const itineraryCruiseDayIndex = index('itineraries_cruise_day_idx').on(
  itineraries.cruiseId, 
  itineraries.dayNumber
);
export const itineraryPortIndex = index('itineraries_port_idx').on(itineraries.portId);
export const itineraryDateIndex = index('itineraries_date_idx').on(itineraries.date);

// Cabin category indexes
export const cabinCategoryShipIndex = index('cabin_categories_ship_idx').on(cabinCategories.shipId);
export const cabinCategoryCodeIndex = index('cabin_categories_code_idx').on(
  cabinCategories.shipId, 
  cabinCategories.cabinCode
);
export const cabinCategoryTypeIndex = index('cabin_categories_category_idx').on(cabinCategories.category);
export const cabinCategoryActiveIndex = index('cabin_categories_active_idx').on(cabinCategories.isActive);

// Pricing indexes for search performance
export const pricingCruiseIndex = index('pricing_cruise_idx').on(pricing.cruiseId);
export const pricingCruiseCabinIndex = index('pricing_cruise_cabin_idx').on(
  pricing.cruiseId, 
  pricing.cabinCode
);
export const pricingRateCodeIndex = index('pricing_rate_code_idx').on(
  pricing.rateCode
);
export const pricingAvailableIndex = index('pricing_available_idx').on(pricing.isAvailable);
export const pricingBasePriceIndex = index('pricing_base_price_idx').on(pricing.basePrice);
export const pricingCruiseAvailableIndex = index('pricing_cruise_available_idx').on(
  pricing.cruiseId, 
  pricing.isAvailable
);

// Cheapest pricing indexes for fast search
export const cheapestPricingCruiseIndex = uniqueIndex('cheapest_pricing_cruise_idx').on(cheapestPricing.cruiseId);
export const cheapestPricingPriceIndex = index('cheapest_pricing_price_idx').on(cheapestPricing.cheapestPrice);
export const cheapestPricingInteriorIndex = index('cheapest_pricing_interior_idx').on(cheapestPricing.interiorPrice);
export const cheapestPricingOceanviewIndex = index('cheapest_pricing_oceanview_idx').on(cheapestPricing.oceanviewPrice);
export const cheapestPricingBalconyIndex = index('cheapest_pricing_balcony_idx').on(cheapestPricing.balconyPrice);
export const cheapestPricingSuiteIndex = index('cheapest_pricing_suite_idx').on(cheapestPricing.suitePrice);

// Quote request indexes
export const quoteRequestUserIndex = index('quote_requests_user_idx').on(quoteRequests.userId);
export const quoteRequestCruiseIndex = index('quote_requests_cruise_idx').on(quoteRequests.cruiseId);
export const quoteRequestStatusIndex = index('quote_requests_status_idx').on(quoteRequests.status);
export const quoteRequestCreatedIndex = index('quote_requests_created_idx').on(quoteRequests.createdAt);
export const quoteRequestExpiresIndex = index('quote_requests_expires_idx').on(quoteRequests.quoteExpiresAt);

// Saved search indexes
export const savedSearchUserIndex = index('saved_searches_user_idx').on(savedSearches.userId);
export const savedSearchActiveIndex = index('saved_searches_active_idx').on(savedSearches.isActive);
export const savedSearchAlertIndex = index('saved_searches_alert_idx').on(
  savedSearches.alertEnabled, 
  savedSearches.isActive
);
export const savedSearchLastCheckedIndex = index('saved_searches_last_checked_idx').on(savedSearches.lastChecked);

// Full-text search indexes (using PostgreSQL's built-in text search)
// Note: These would be created via raw SQL in migrations since Drizzle doesn't have built-in GIN index support yet
export const fullTextSearchQueries = [
  // Cruise name search
  `CREATE INDEX IF NOT EXISTS cruises_name_search_idx ON cruises USING GIN (to_tsvector('english', name))`,
  
  // Port name and location search
  `CREATE INDEX IF NOT EXISTS ports_name_search_idx ON ports USING GIN (to_tsvector('english', name || ' ' || COALESCE(city, '') || ' ' || COALESCE(country, '')))`,
  
  // Ship name search
  `CREATE INDEX IF NOT EXISTS ships_name_search_idx ON ships USING GIN (to_tsvector('english', name))`,
  
  // Cruise line name search
  `CREATE INDEX IF NOT EXISTS cruise_lines_name_search_idx ON cruise_lines USING GIN (to_tsvector('english', name))`,
  
  // Region name search
  `CREATE INDEX IF NOT EXISTS regions_name_search_idx ON regions USING GIN (to_tsvector('english', name))`,
];

// GIN indexes for JSONB fields
export const jsonbIndexQueries = [
  // Region IDs array search
  `CREATE INDEX IF NOT EXISTS cruises_region_ids_gin_idx ON cruises USING GIN (region_ids)`,
  
  // Port IDs array search
  `CREATE INDEX IF NOT EXISTS cruises_port_ids_gin_idx ON cruises USING GIN (port_ids)`,
  
  // Ship images search
  `CREATE INDEX IF NOT EXISTS ships_images_gin_idx ON ships USING GIN (images)`,
  
  // Port amenities search
  `CREATE INDEX IF NOT EXISTS ports_amenities_gin_idx ON ports USING GIN (amenities)`,
  
  // Cabin amenities search
  `CREATE INDEX IF NOT EXISTS cabin_categories_amenities_gin_idx ON cabin_categories USING GIN (amenities)`,
  
  // User preferences search
  `CREATE INDEX IF NOT EXISTS users_preferences_gin_idx ON users USING GIN (preferences)`,
  
  // Quote request passenger details
  `CREATE INDEX IF NOT EXISTS quote_requests_passenger_details_gin_idx ON quote_requests USING GIN (passenger_details)`,
  
  // Saved search criteria
  `CREATE INDEX IF NOT EXISTS saved_searches_criteria_gin_idx ON saved_searches USING GIN (search_criteria)`,
];

// Export all index creation queries for use in migrations
export const allIndexQueries = [
  ...fullTextSearchQueries,
  ...jsonbIndexQueries,
];

export default {
  // User indexes
  userClerkIdIndex,
  userEmailIndex,
  userActiveIndex,
  
  // Cruise line indexes
  cruiseLineNameIndex,
  cruiseLineActiveIndex,
  
  // Ship indexes
  shipCruiseLineIndex,
  shipNameIndex,
  shipActiveIndex,
  
  // Port indexes
  portNameIndex,
  portCountryIndex,
  portActiveIndex,
  
  // Region indexes
  regionNameIndex,
  regionParentIndex,
  regionPopularIndex,
  regionActiveIndex,
  
  // Cruise indexes
  cruiseSailingDateIndex,
  cruiseNightsIndex,
  cruiseCruiseLineIndex,
  cruiseShipIndex,
  cruiseActiveIndex,
  cruiseEmbarkPortIndex,
  cruiseDisembarkPortIndex,
  cruiseDateNightsLineIndex,
  cruiseDateActiveIndex,
  cruiseLineShipDateIndex,
  cruiseFilePathIndex,
  cruiseCodeToCruiseIdIndex,
  
  // Alternative sailings indexes
  altSailingsBaseCruiseIndex,
  altSailingsAltCruiseIndex,
  altSailingsDateIndex,
  
  // Itinerary indexes
  itineraryCruiseIndex,
  itineraryCruiseDayIndex,
  itineraryPortIndex,
  itineraryDateIndex,
  
  // Cabin category indexes
  cabinCategoryShipIndex,
  cabinCategoryCodeIndex,
  cabinCategoryTypeIndex,
  cabinCategoryActiveIndex,
  
  // Pricing indexes
  pricingCruiseIndex,
  pricingCruiseCabinIndex,
  pricingRateCodeIndex,
  pricingAvailableIndex,
  pricingBasePriceIndex,
  pricingCruiseAvailableIndex,
  
  // Cheapest pricing indexes
  cheapestPricingCruiseIndex,
  cheapestPricingPriceIndex,
  cheapestPricingInteriorIndex,
  cheapestPricingOceanviewIndex,
  cheapestPricingBalconyIndex,
  cheapestPricingSuiteIndex,
  
  // Quote request indexes
  quoteRequestUserIndex,
  quoteRequestCruiseIndex,
  quoteRequestStatusIndex,
  quoteRequestCreatedIndex,
  quoteRequestExpiresIndex,
  
  // Saved search indexes
  savedSearchUserIndex,
  savedSearchActiveIndex,
  savedSearchAlertIndex,
  savedSearchLastCheckedIndex,
  
  // Additional index queries
  allIndexQueries,
};