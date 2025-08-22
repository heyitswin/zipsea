import { pgTable, integer, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const cruiseLines = pgTable('cruise_lines', {
  id: integer('id').primaryKey(), // Traveltek lineid
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }),
  description: text('description'),
  engineName: varchar('engine_name', { length: 255 }),
  shortName: varchar('short_name', { length: 50 }),
  niceUrl: varchar('nice_url', { length: 255 }),
  logo: varchar('logo', { length: 500 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type CruiseLine = typeof cruiseLines.$inferSelect;
export type NewCruiseLine = typeof cruiseLines.$inferInsert;