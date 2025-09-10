import {
  pgTable,
  varchar,
  text,
  timestamp,
  date,
  boolean,
  integer,
  jsonb,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { ships } from './ships';

export const cabinCategories = pgTable(
  'cabin_categories',
  {
    shipId: integer('ship_id')
      .references(() => ships.id)
      .notNull(),
    cabinCode: varchar('cabin_code', { length: 10 }).notNull(), // cabins.{code}.cabincode
    cabinCodeAlt: varchar('cabin_code_alt', { length: 10 }), // cabins.{code}.cabincode2
    name: varchar('name', { length: 255 }).notNull(), // cabins.{code}.name
    description: text('description'), // cabins.{code}.description
    category: varchar('category', { length: 50 }).notNull(), // cabins.{code}.codtype (inside/oceanview/balcony/suite)
    colorCode: varchar('colour_code', { length: 7 }), // cabins.{code}.colourcode - Note: DB uses British spelling
    imageUrl: varchar('image_url', { length: 500 }), // cabins.{code}.imageurl
    imageUrlHd: varchar('image_url_hd', { length: 500 }), // cabins.{code}.imageurlhd
    imageUrl2k: varchar('image_url_2k', { length: 500 }), // cabins.{code}.imageurl2k
    isDefault: boolean('is_default').default(false), // cabins.{code}.isdefault
    validFrom: date('valid_from'), // cabins.{code}.validfrom
    validTo: date('valid_to'), // cabins.{code}.validto
    cabinId: varchar('cabin_id', { length: 20 }), // cabins.{code}.id
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => {
    return {
      pk: primaryKey({ columns: [table.shipId, table.cabinCode] }),
    };
  }
);

export type CabinCategory = typeof cabinCategories.$inferSelect;
export type NewCabinCategory = typeof cabinCategories.$inferInsert;
