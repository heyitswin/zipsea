import { pgTable, uuid, varchar, decimal, timestamp } from 'drizzle-orm/pg-core';
import { savedSearches } from './saved-searches';
import { cruises } from './cruises';

/**
 * Alert Matches Table
 * Tracks which cruises have already been notified for each alert
 * Prevents duplicate notifications for the same cruise/cabin combination
 */
export const alertMatches = pgTable('alert_matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  alertId: uuid('alert_id')
    .references(() => savedSearches.id, { onDelete: 'cascade' })
    .notNull(),
  cruiseId: varchar('cruise_id', { length: 50 })
    .references(() => cruises.id, { onDelete: 'cascade' })
    .notNull(),
  cabinType: varchar('cabin_type', { length: 20 }).notNull(), // interior, oceanview, balcony, suite
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  notifiedAt: timestamp('notified_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type AlertMatch = typeof alertMatches.$inferSelect;
export type NewAlertMatch = typeof alertMatches.$inferInsert;
