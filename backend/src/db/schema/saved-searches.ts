import { pgTable, uuid, varchar, timestamp, jsonb, boolean, integer } from 'drizzle-orm/pg-core';
import { users } from './users';

export const savedSearches = pgTable('saved_searches', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  searchCriteria: jsonb('search_criteria').notNull(), // Search parameters
  alertEnabled: boolean('alert_enabled').default(false),
  alertFrequency: varchar('alert_frequency', { length: 20 }).default('weekly'), // daily, weekly, monthly
  lastChecked: timestamp('last_checked'),
  lastNotified: timestamp('last_notified'),
  resultsCount: integer('results_count').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type SavedSearch = typeof savedSearches.$inferSelect;
export type NewSavedSearch = typeof savedSearches.$inferInsert;