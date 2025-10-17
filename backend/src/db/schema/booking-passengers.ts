import {
  pgTable,
  uuid,
  varchar,
  integer,
  date,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { bookings } from './bookings';

// Passenger details for each booking
export const bookingPassengers = pgTable('booking_passengers', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Booking reference
  bookingId: uuid('booking_id')
    .references(() => bookings.id)
    .notNull(),

  // Passenger number (1, 2, 3, 4)
  passengerNumber: integer('passenger_number').notNull(),

  // Passenger type
  passengerType: varchar('passenger_type', { length: 20 })
    .notNull()
    .$type<'adult' | 'child' | 'infant'>(),

  // Personal information
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  dateOfBirth: date('date_of_birth').notNull(),
  gender: varchar('gender', { length: 10 }).notNull(), // M, F, X
  citizenship: varchar('citizenship', { length: 100 }), // Country name or code

  // Contact information (for lead passenger)
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),

  // Address information
  streetAddress: varchar('street_address', { length: 255 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  zipCode: varchar('zip_code', { length: 20 }),
  country: varchar('country', { length: 100 }),

  // Lead passenger flag (booker)
  isLeadPassenger: boolean('is_lead_passenger').default(false),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type BookingPassenger = typeof bookingPassengers.$inferSelect;
export type NewBookingPassenger = typeof bookingPassengers.$inferInsert;
