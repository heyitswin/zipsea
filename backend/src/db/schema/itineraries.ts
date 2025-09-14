import {
  pgTable,
  uuid,
  integer,
  varchar,
  text,
  timestamp,
  date,
  time,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';
import { cruises } from './cruises';
import { ports } from './ports';

export const itineraries = pgTable('cruise_itinerary', {
  id: integer('id').primaryKey(), // Using serial ID to match production schema
  cruiseId: varchar('cruise_id')
    .references(() => cruises.id)
    .notNull(), // Changed to varchar to match database
  dayNumber: integer('day_number').notNull(), // itinerary[].day
  portId: integer('port_id').references(() => ports.id), // Foreign key, nullable
  portName: varchar('port_name', { length: 255 }), // itinerary[].port
  arrivalTime: varchar('arrival_time', { length: 10 }), // itinerary[].arrive
  departureTime: varchar('departure_time', { length: 10 }), // itinerary[].depart
  description: text('description'), // itinerary[].description
  isSeaDay: boolean('is_sea_day').default(false),
  isTenderPort: boolean('is_tender_port').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Itinerary = typeof itineraries.$inferSelect;
export type NewItinerary = typeof itineraries.$inferInsert;
