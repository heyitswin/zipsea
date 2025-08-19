import { pgTable, integer, varchar, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';
import { cruiseLines } from './cruise-lines';

export const ships = pgTable('ships', {
  id: integer('id').primaryKey(), // Traveltek shipid
  cruiseLineId: integer('cruise_line_id').references(() => cruiseLines.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }),
  shipClass: varchar('ship_class', { length: 100 }),
  tonnage: integer('tonnage'),
  totalCabins: integer('total_cabins'),
  capacity: integer('capacity'), // shipcontent.limitof
  rating: integer('rating'), // shipcontent.startrating
  description: text('description'), // shipcontent.shortdescription
  highlights: text('highlights'),
  defaultImageUrl: varchar('default_image_url', { length: 500 }), // shipcontent.defaultshipimage
  defaultImageUrlHd: varchar('default_image_url_hd', { length: 500 }), // shipcontent.defaultshipimage2k
  images: jsonb('images').default('[]'), // shipcontent.shipimages array
  additionalInfo: text('additional_info'), // shipcontent.additsoaly
  amenities: jsonb('amenities').default('[]'),
  launchedYear: integer('launched_year'),
  refurbishedYear: integer('refurbished_year'),
  decks: integer('decks'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Ship = typeof ships.$inferSelect;
export type NewShip = typeof ships.$inferInsert;