import { pgTable, integer, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const regions = pgTable('regions', {
  id: integer('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  parentRegionId: integer('parent_region_id').references(() => regions.id),
  description: text('description'),
  code: varchar('code', { length: 10 }),
  displayOrder: integer('display_order').default(0),
  isPopular: boolean('is_popular').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Region = typeof regions.$inferSelect;
export type NewRegion = typeof regions.$inferInsert;