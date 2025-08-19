import { pgTable, varchar, text, timestamp, date, boolean, integer, jsonb, primaryKey } from 'drizzle-orm/pg-core';
import { ships } from './ships';

export const cabinCategories = pgTable('cabin_categories', {
  shipId: integer('ship_id').references(() => ships.id).notNull(),
  cabinCode: varchar('cabin_code', { length: 10 }).notNull(), // cabins.{code}.cabincode
  cabinCodeAlt: varchar('cabin_code_alt', { length: 10 }), // cabins.{code}.cabincode2
  name: varchar('name', { length: 255 }).notNull(), // cabins.{code}.name
  description: text('description'), // cabins.{code}.description
  category: varchar('category', { length: 50 }).notNull(), // cabins.{code}.codtype (inside/oceanview/balcony/suite)
  categoryAlt: varchar('category_alt', { length: 50 }), // cabins.{code}.codtype2
  colorCode: varchar('color_code', { length: 7 }), // cabins.{code}.colourcode
  colorCodeAlt: varchar('color_code_alt', { length: 7 }), // cabins.{code}.colourcode2
  imageUrl: varchar('image_url', { length: 500 }), // cabins.{code}.imageurl
  imageUrlHd: varchar('image_url_hd', { length: 500 }), // cabins.{code}.imageurl2k
  isDefault: boolean('is_default').default(false), // cabins.{code}.isdefault
  validFrom: date('valid_from'), // cabins.{code}.validfrom
  validTo: date('valid_to'), // cabins.{code}.validto
  maxOccupancy: integer('max_occupancy').default(2), // Derived from pricing analysis
  minOccupancy: integer('min_occupancy').default(1),
  size: varchar('size', { length: 50 }), // Manual entry
  bedConfiguration: varchar('bed_configuration', { length: 100 }), // Manual entry
  amenities: jsonb('amenities').default('[]'),
  deckLocations: jsonb('deck_locations').default('[]'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.shipId, table.cabinCode] }),
  };
});

export type CabinCategory = typeof cabinCategories.$inferSelect;
export type NewCabinCategory = typeof cabinCategories.$inferInsert;