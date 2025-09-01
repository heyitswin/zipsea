import { pgTable, uuid, integer, varchar, text, timestamp, decimal, jsonb, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';
import { cruises } from './cruises';

export const quoteRequests = pgTable('quote_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  referenceNumber: varchar('reference_number', { length: 20 }).unique(), // Unique quote reference number
  userId: uuid('user_id').references(() => users.id),
  cruiseId: integer('cruise_id').references(() => cruises.id).notNull(),
  cabinCode: varchar('cabin_code', { length: 10 }),
  cabinType: varchar('cabin_type', { length: 50 }),
  passengerCount: integer('passenger_count').notNull(),
  passengerDetails: jsonb('passenger_details').default('[]'), // Array of passenger info
  specialRequirements: text('special_requirements'),
  contactInfo: jsonb('contact_info').notNull(), // Contact information
  preferences: jsonb('preferences').default('{}'), // Dining, insurance, etc.
  status: varchar('status', { length: 50 }).default('waiting'), // waiting, responded, expired, booked
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }),
  obcAmount: decimal('obc_amount', { precision: 10, scale: 2 }), // Onboard credit calculation
  commission: decimal('commission', { precision: 10, scale: 2 }),
  notes: text('notes'), // Internal notes
  quoteResponse: jsonb('quote_response'), // Store the admin's response with pricing details
  quoteExpiresAt: timestamp('quote_expires_at'),
  quotedAt: timestamp('quoted_at'),
  bookedAt: timestamp('booked_at'),
  isUrgent: boolean('is_urgent').default(false),
  source: varchar('source', { length: 50 }).default('website'), // website, phone, email, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type NewQuoteRequest = typeof quoteRequests.$inferInsert;