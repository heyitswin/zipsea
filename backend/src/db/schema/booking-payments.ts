import {
  pgTable,
  uuid,
  varchar,
  decimal,
  timestamp,
  text,
} from 'drizzle-orm/pg-core';
import { bookings } from './bookings';

// Payment records for bookings
export const bookingPayments = pgTable('booking_payments', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Booking reference
  bookingId: uuid('booking_id')
    .references(() => bookings.id)
    .notNull(),

  // Payment amount
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),

  // Payment type
  paymentType: varchar('payment_type', { length: 20 })
    .notNull()
    .$type<'deposit' | 'full_payment' | 'balance'>(),

  // Payment method
  paymentMethod: varchar('payment_method', { length: 50 }).notNull(), // visa, mastercard, amex, etc.
  last4: varchar('last4', { length: 4 }), // Last 4 digits of card

  // Transaction details
  transactionId: varchar('transaction_id', { length: 255 }), // From Traveltek payment response

  // Payment status
  status: varchar('status', { length: 20 })
    .notNull()
    .default('pending')
    .$type<'pending' | 'completed' | 'failed' | 'refunded'>(),

  // Error message if payment failed
  errorMessage: text('error_message'),

  // Timestamps
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type BookingPayment = typeof bookingPayments.$inferSelect;
export type NewBookingPayment = typeof bookingPayments.$inferInsert;
