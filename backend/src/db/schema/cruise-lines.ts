import { pgTable, integer, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const cruiseLines = pgTable('cruise_lines', {
  id: integer('id').primaryKey(), // Traveltek lineid
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 10 }),
  logoUrl: varchar('logo_url', { length: 500 }),
  description: text('description'),
  website: varchar('website', { length: 255 }),
  headquarters: varchar('headquarters', { length: 255 }),
  foundedYear: integer('founded_year'),
  fleetSize: integer('fleet_size'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type CruiseLine = typeof cruiseLines.$inferSelect;
export type NewCruiseLine = typeof cruiseLines.$inferInsert;