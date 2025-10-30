import { pgTable, uuid, varchar, jsonb, timestamp, text, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';
import { cruises } from './cruises';

// Booking sessions track active booking flows
// Session keys are valid for 2 hours from Traveltek API
export const bookingSessions = pgTable('booking_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),

  // User reference (nullable for guest bookings)
  userId: uuid('user_id').references(() => users.id),

  // Cruise being booked
  cruiseId: varchar('cruise_id')
    .references(() => cruises.id)
    .notNull(),

  // Traveltek session data
  traveltekSessionKey: varchar('traveltek_session_key', { length: 255 }).notNull(), // UUID from Traveltek
  traveltekSid: varchar('traveltek_sid', { length: 255 }).notNull(), // Search ID from Traveltek
  traveltekAccessToken: text('traveltek_access_token'), // OAuth token (encrypted in production)

  // Passenger information
  passengerCount: jsonb('passenger_count').notNull().$type<{
    adults: number;
    children: number;
    childAges: number[];
  }>(),

  // Cabin selection
  selectedCabinGrade: jsonb('selected_cabin_grade').$type<{
    resultno: string;
    gradeno: string;
    ratecode: string;
    cabinCode: string;
    cabinType: string;
    description: string;
    totalPrice: number;
    obcAmount?: number; // Onboard credit amount from cabin card (8% of commissionable fare)
  }>(),

  // Booking options
  diningSelection: varchar('dining_selection', { length: 50 }), // e.g., 'my_time_dining'
  travelInsurance: boolean('travel_insurance').default(false),
  specialRequests: text('special_requests'),

  // Basket data from Traveltek
  basketData: jsonb('basket_data').$type<{
    itemkey?: string;
    totalprice?: number;
    totaldeposit?: number;
    duedate?: string;
  }>(),

  // Item key for booking (extracted from basket for easy access)
  itemkey: varchar('itemkey', { length: 255 }),

  // Pricing breakdown from cruisecabingradebreakdown.pl API
  pricingBreakdown: jsonb('pricing_breakdown').$type<
    Array<{
      description?: string;
      totalcost?: string;
      sprice?: string;
      category?: string;
    }>
  >(),

  // Hold booking flag
  isHoldBooking: boolean('is_hold_booking').default(false),

  // Session management
  expiresAt: timestamp('expires_at').notNull(), // 2 hours from creation
  status: varchar('status', { length: 20 })
    .notNull()
    .default('active')
    .$type<'active' | 'expired' | 'completed' | 'abandoned'>(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type BookingSession = typeof bookingSessions.$inferSelect;
export type NewBookingSession = typeof bookingSessions.$inferInsert;
