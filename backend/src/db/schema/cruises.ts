import { pgTable, integer, varchar, text, timestamp, date, boolean, jsonb, uuid, decimal } from 'drizzle-orm/pg-core';
import { cruiseLines } from './cruise-lines';
import { ships } from './ships';
import { ports } from './ports';

// New table for cruise definitions (ship + itinerary combination)
export const cruiseDefinitions = pgTable('cruise_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  traveltekCruiseId: integer('traveltek_cruise_id').notNull(), // Original cruiseid from Traveltek
  cruiseLineId: integer('cruise_line_id').references(() => cruiseLines.id).notNull(),
  shipId: integer('ship_id').references(() => ships.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  itineraryCode: varchar('itinerary_code', { length: 50 }),
  voyageCode: varchar('voyage_code', { length: 50 }),
  nights: integer('nights').notNull(),
  sailNights: integer('sail_nights'), // sailnights
  seaDays: integer('sea_days'), // seadays
  embarkPortId: integer('embarkation_port_id').references(() => ports.id),
  disembarkPortId: integer('disembarkation_port_id').references(() => ports.id),
  regionIds: jsonb('region_ids').default('[]'), // regionids array as INTEGER[]
  portIds: jsonb('port_ids').default('[]'), // portids array as INTEGER[]
  marketId: integer('market_id'), // marketid
  ownerId: integer('owner_id'), // ownerid
  noFly: boolean('no_fly').default(false), // nofly
  departUk: boolean('depart_uk').default(false), // departuk
  showCruise: boolean('show_cruise').default(true), // showcruise (active flag)
  flyCruiseInfo: text('fly_cruise_info'), // flycruiseinfo
  lineContent: text('line_content'), // linecontent
  currency: varchar('currency', { length: 3 }).default('USD'), // ISO currency code from file
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// New table for individual sailings (specific sailing dates)
export const cruiseSailings = pgTable('cruise_sailings', {
  id: uuid('id').primaryKey().defaultRandom(),
  cruiseDefinitionId: uuid('cruise_definition_id').references(() => cruiseDefinitions.id).notNull(),
  codeToCruiseId: integer('code_to_cruise_id').notNull().unique(), // Unique identifier from Traveltek
  sailingDate: date('sailing_date').notNull(), // startdate/saildate
  returnDate: date('return_date'), // Calculated from sailing_date + nights
  traveltekFilePath: varchar('traveltek_file_path', { length: 500 }), // [year]/[month]/[lineid]/[shipid]/[codetocruiseid].json
  lastCached: timestamp('last_cached'), // lastcached
  cachedDate: date('cached_date'), // cacheddate
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Main cruises table - matches the working code expectations
export const cruises = pgTable('cruises', {
  id: integer('id').primaryKey(), // Back to integer to match working code expectations
  cruiseId: varchar('cruise_id'), // Original cruiseid from Traveltek (can duplicate)
  cruiseLineId: integer('cruise_line_id').references(() => cruiseLines.id).notNull(),
  shipId: integer('ship_id').references(() => ships.id).notNull(),
  name: varchar('name', { length: 500 }),
  voyageCode: varchar('voyage_code', { length: 50 }),
  itineraryCode: varchar('itinerary_code', { length: 50 }),
  sailingDate: date('sailing_date').notNull(),
  returnDate: date('return_date'),
  nights: integer('nights'),
  seaDays: integer('sea_days'),
  embarkPortId: integer('embarkation_port_id').references(() => ports.id), // Match working code
  disembarkPortId: integer('disembarkation_port_id').references(() => ports.id), // Match working code
  portIds: varchar('port_ids', { length: 500 }), // Comma-separated string from API
  regionIds: varchar('region_ids', { length: 200 }), // Comma-separated string from API
  marketId: varchar('market_id', { length: 50 }),
  ownerId: varchar('owner_id', { length: 50 }),
  noFly: boolean('no_fly').default(false),
  departUk: boolean('depart_uk').default(false),
  showCruise: boolean('show_cruise').default(true),
  lastCached: integer('last_cached'),
  cachedDate: varchar('cached_date', { length: 100 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Alternative sailings table for cross-references
export const alternativeSailings = pgTable('alternative_sailings', {
  id: integer('id').primaryKey(),
  baseCruiseId: integer('base_cruise_id').references(() => cruises.id).notNull(),
  alternativeCruiseId: integer('alternative_cruise_id').references(() => cruises.id).notNull(),
  sailingDate: date('sailing_date').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Index definitions for optimal performance
export const cruiseDefinitionsIndexes = {
  traveltekCruiseId: 'idx_cruise_definitions_traveltek_cruise_id',
  cruiseLineShip: 'idx_cruise_definitions_cruise_line_ship',
  voyageCode: 'idx_cruise_definitions_voyage_code',
  embarkPort: 'idx_cruise_definitions_embark_port',
  nights: 'idx_cruise_definitions_nights',
  regionIds: 'idx_cruise_definitions_region_ids',
  isActive: 'idx_cruise_definitions_is_active'
};

export const cruiseSailingsIndexes = {
  cruiseDefinitionId: 'idx_cruise_sailings_cruise_definition_id',
  codeToCruiseId: 'idx_cruise_sailings_code_to_cruise_id',
  sailingDate: 'idx_cruise_sailings_sailing_date',
  sailingDateRange: 'idx_cruise_sailings_sailing_date_range',
  traveltekFilePath: 'idx_cruise_sailings_traveltek_file_path',
  isActive: 'idx_cruise_sailings_is_active'
};

// Type definitions
export type CruiseDefinition = typeof cruiseDefinitions.$inferSelect;
export type NewCruiseDefinition = typeof cruiseDefinitions.$inferInsert;
export type CruiseSailing = typeof cruiseSailings.$inferSelect;
export type NewCruiseSailing = typeof cruiseSailings.$inferInsert;
export type Cruise = typeof cruises.$inferSelect;
export type NewCruise = typeof cruises.$inferInsert;
export type AlternativeSailing = typeof alternativeSailings.$inferSelect;
export type NewAlternativeSailing = typeof alternativeSailings.$inferInsert;