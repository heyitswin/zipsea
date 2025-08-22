import { pgTable, integer, varchar, text, timestamp, jsonb, boolean, date } from 'drizzle-orm/pg-core';
import { cruiseLines } from './cruise-lines';

export const ships = pgTable('ships', {
  id: integer('id').primaryKey(), // Traveltek shipid
  cruiseLineId: integer('cruise_line_id').references(() => cruiseLines.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }),
  tonnage: integer('tonnage'),
  totalCabins: integer('total_cabins'),
  occupancy: integer('occupancy'), // shipcontent.limitof
  totalCrew: integer('total_crew'),
  length: integer('length'),
  launched: date('launched'),
  starRating: integer('star_rating'), // shipcontent.startrating
  adultsOnly: boolean('adults_only').default(false),
  shortDescription: text('short_description'), // shipcontent.shortdescription
  highlights: text('highlights'),
  shipClass: varchar('ship_class', { length: 100 }),
  defaultShipImage: varchar('default_ship_image', { length: 500 }), // shipcontent.defaultshipimage
  defaultShipImageHd: varchar('default_ship_image_hd', { length: 500 }),
  defaultShipImage2k: varchar('default_ship_image_2k', { length: 500 }), // shipcontent.defaultshipimage2k
  niceUrl: varchar('nice_url', { length: 255 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Ship = typeof ships.$inferSelect;
export type NewShip = typeof ships.$inferInsert;