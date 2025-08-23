import { pgTable, integer, varchar, text, timestamp, decimal, jsonb, boolean } from 'drizzle-orm/pg-core';

export const ports = pgTable('ports', {
  id: integer('id').primaryKey(), // From portids array
  name: varchar('name', { length: 255 }).notNull(), // From ports array
  code: varchar('code', { length: 10 }),
  country: varchar('country', { length: 100 }),
  region: varchar('region', { length: 100 }),
  latitude: decimal('latitude', { precision: 10, scale: 8 }),
  longitude: decimal('longitude', { precision: 11, scale: 8 }),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Port = typeof ports.$inferSelect;
export type NewPort = typeof ports.$inferInsert;