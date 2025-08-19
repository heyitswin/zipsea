import { pgTable, integer, varchar, text, timestamp, date, boolean, jsonb, uuid, decimal } from 'drizzle-orm/pg-core';
import { cruiseLines } from './cruise-lines';
import { ships } from './ships';
import { ports } from './ports';

export const cruises = pgTable('cruises', {
  id: integer('id').primaryKey(), // Traveltek cruiseid
  codeToCruiseId: varchar('code_to_cruise_id', { length: 50 }).notNull(), // codetocruiseid for file naming
  cruiseLineId: integer('cruise_line_id').references(() => cruiseLines.id).notNull(),
  shipId: integer('ship_id').references(() => ships.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  itineraryCode: varchar('itinerary_code', { length: 50 }),
  voyageCode: varchar('voyage_code', { length: 50 }),
  sailingDate: date('sailing_date').notNull(), // startdate/saildate
  returnDate: date('return_date'), // Calculated from sailing_date + nights
  nights: integer('nights').notNull(),
  sailNights: integer('sail_nights'), // sailnights
  seaDays: integer('sea_days'), // seadays
  embarkPortId: integer('embark_port_id').references(() => ports.id),
  disembarkPortId: integer('disembark_port_id').references(() => ports.id),
  regionIds: jsonb('region_ids').default('[]'), // regionids array as INTEGER[]
  portIds: jsonb('port_ids').default('[]'), // portids array as INTEGER[]
  marketId: integer('market_id'), // marketid
  ownerId: integer('owner_id'), // ownerid
  noFly: boolean('no_fly').default(false), // nofly
  departUk: boolean('depart_uk').default(false), // departuk
  showCruise: boolean('show_cruise').default(true), // showcruise (active flag)
  flyCruiseInfo: text('fly_cruise_info'), // flycruiseinfo
  lineContent: text('line_content'), // linecontent
  traveltekFilePath: varchar('traveltek_file_path', { length: 500 }), // [year]/[month]/[lineid]/[shipid]/[codetocruiseid].json
  lastCached: timestamp('last_cached'), // lastcached
  cachedDate: date('cached_date'), // cacheddate
  currency: varchar('currency', { length: 3 }).default('USD'), // ISO currency code from file
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Alternative sailings table for cross-references
export const alternativeSailings = pgTable('alternative_sailings', {
  id: uuid('id').primaryKey().defaultRandom(),
  baseCruiseId: integer('base_cruise_id').references(() => cruises.id).notNull(),
  alternativeCruiseId: integer('alternative_cruise_id').references(() => cruises.id).notNull(),
  sailingDate: date('sailing_date').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Cruise = typeof cruises.$inferSelect;
export type NewCruise = typeof cruises.$inferInsert;
export type AlternativeSailing = typeof alternativeSailings.$inferSelect;
export type NewAlternativeSailing = typeof alternativeSailings.$inferInsert;