import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  decimal,
  text,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { cruises } from './cruises';
import { bookingSessions } from './booking-sessions';

// Main bookings table for completed bookings
export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Reference to booking session
  bookingSessionId: uuid('booking_session_id')
    .references(() => bookingSessions.id)
    .notNull(),

  // User reference (created if guest booking)
  userId: uuid('user_id').references(() => users.id),

  // Cruise reference
  cruiseId: varchar('cruise_id')
    .references(() => cruises.id)
    .notNull(),

  // Traveltek booking references
  traveltekBookingId: varchar('traveltek_booking_id', { length: 255 }).notNull(), // From /book.pl response
  traveltekPortfolioId: varchar('traveltek_portfolio_id', { length: 255 }), // For iBOS integration

  // Booking status
  status: varchar('status', { length: 20 })
    .notNull()
    .default('pending')
    .$type<'confirmed' | 'pending' | 'cancelled' | 'failed'>(),

  // Complete booking response from Traveltek
  bookingDetails: jsonb('booking_details').notNull().$type<{
    confirmation?: string;
    cruiseid?: string;
    passengers?: any[];
    cabin?: any;
    dining?: string;
    [key: string]: any;
  }>(),

  // Pricing information
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  depositAmount: decimal('deposit_amount', { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal('paid_amount', { precision: 10, scale: 2 }).notNull(),

  // Payment status
  paymentStatus: varchar('payment_status', { length: 20 })
    .notNull()
    .default('pending')
    .$type<'deposit_paid' | 'fully_paid' | 'pending' | 'failed'>(),

  // Balance due date
  balanceDueDate: timestamp('balance_due_date'),

  // Admin notes
  notes: text('notes'),

  // Timestamps
  confirmedAt: timestamp('confirmed_at'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
