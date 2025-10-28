import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  boolean,
  integer,
  decimal,
  text,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const savedSearches = pgTable('saved_searches', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  searchCriteria: jsonb('search_criteria').notNull(), // Search parameters
  alertEnabled: boolean('alert_enabled').default(false),
  alertFrequency: varchar('alert_frequency', { length: 20 }).default('daily'), // daily, weekly, monthly
  lastChecked: timestamp('last_checked'),
  lastNotified: timestamp('last_notified'),
  resultsCount: integer('results_count').default(0),
  isActive: boolean('is_active').default(true),
  // Price Alert specific fields
  maxBudget: decimal('max_budget', { precision: 10, scale: 2 }), // Maximum price threshold for alerts
  cabinTypes: text('cabin_types').array(), // Array of cabin types: ['interior', 'oceanview', 'balcony', 'suite']
  // Passenger information for Traveltek pricing
  adults: integer('adults').default(2).notNull(), // Number of adults
  children: integer('children').default(0).notNull(), // Number of children
  childAges: integer('child_ages').array(), // Ages of children
  infants: integer('infants').default(0).notNull(), // Number of infants
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type SavedSearch = typeof savedSearches.$inferSelect;
export type NewSavedSearch = typeof savedSearches.$inferInsert;
