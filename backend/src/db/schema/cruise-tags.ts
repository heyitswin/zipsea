import { pgTable, varchar, timestamp, integer, serial, uuid } from 'drizzle-orm/pg-core';
import { cruises } from './cruises';

// Cruise tags/categories table
export const cruiseTags = pgTable('cruise_tags', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  description: varchar('description', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Junction table for many-to-many relationship between cruises and tags
// Using cruise name as the grouping key since we want to tag "7 Day Western Caribbean" not individual sailings
export const cruiseNameTags = pgTable('cruise_name_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Composite key of cruise_line_id + cruise_name + ship_id to uniquely identify a cruise
  cruiseLineId: integer('cruise_line_id').notNull(),
  cruiseName: varchar('cruise_name', { length: 500 }).notNull(),
  shipId: integer('ship_id').notNull(),
  tagId: integer('tag_id')
    .references(() => cruiseTags.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Type definitions
export type CruiseTag = typeof cruiseTags.$inferSelect;
export type NewCruiseTag = typeof cruiseTags.$inferInsert;
export type CruiseNameTag = typeof cruiseNameTags.$inferSelect;
export type NewCruiseNameTag = typeof cruiseNameTags.$inferInsert;
