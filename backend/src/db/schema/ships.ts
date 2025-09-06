import {
  pgTable,
  integer,
  varchar,
  text,
  timestamp,
  jsonb,
  boolean,
  date,
  numeric,
} from 'drizzle-orm/pg-core';
import { cruiseLines } from './cruise-lines';

export const ships = pgTable('ships', {
  id: integer('id').primaryKey(), // Traveltek shipid
  cruiseLineId: integer('cruise_line_id')
    .references(() => cruiseLines.id)
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  niceName: varchar('nice_name', { length: 255 }),
  shortName: varchar('short_name', { length: 255 }),
  code: varchar('code', { length: 50 }),
  tonnage: integer('tonnage'),
  totalCabins: integer('total_cabins'),
  maxPassengers: integer('max_passengers'), // shipcontent.maxpassengers
  crew: integer('crew'),
  length: numeric('length', { precision: 10, scale: 2 }),
  beam: numeric('beam', { precision: 10, scale: 2 }),
  draft: numeric('draft', { precision: 10, scale: 2 }),
  speed: numeric('speed', { precision: 5, scale: 2 }),
  registry: varchar('registry', { length: 100 }),
  builtYear: integer('built_year'),
  refurbishedYear: integer('refurbished_year'),
  description: text('description'),
  starRating: integer('star_rating'), // shipcontent.startrating
  adultsOnly: boolean('adults_only').default(false),
  highlights: text('highlights'),
  shipClass: varchar('ship_class', { length: 100 }),
  defaultShipImage: varchar('default_ship_image', { length: 500 }), // shipcontent.defaultshipimage
  defaultShipImageHd: varchar('default_ship_image_hd', { length: 500 }),
  defaultShipImage2k: varchar('default_ship_image_2k', { length: 500 }), // shipcontent.defaultshipimage2k
  niceUrl: varchar('nice_url', { length: 255 }),
  rawShipContent: jsonb('raw_ship_content'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Ship = typeof ships.$inferSelect;
export type NewShip = typeof ships.$inferInsert;
