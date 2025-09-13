import {
  pgTable,
  uuid,
  integer,
  varchar,
  text,
  timestamp,
  decimal,
  jsonb,
  boolean,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { cruises } from './cruises';

export const quoteRequests = pgTable('quote_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  cruiseId: varchar('cruise_id').notNull(),
  firstName: varchar('first_name'),
  lastName: varchar('last_name'),
  email: varchar('email'),
  phone: varchar('phone'),
  customer_details: jsonb('customer_details'), // All other fields stored here for production compatibility
  status: varchar('status').default('pending'),
  quoteResponse: jsonb('quote_response'), // Store pricing categories and details
  quotedAt: timestamp('quoted_at'), // When quote was responded to
  notes: text('notes'), // Admin notes for the quote
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type NewQuoteRequest = typeof quoteRequests.$inferInsert;
