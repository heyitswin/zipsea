import { pgTable, uuid, integer, varchar, text, timestamp, date, time, boolean, jsonb } from 'drizzle-orm/pg-core';
import { cruises } from './cruises';
import { ports } from './ports';

export const itineraries = pgTable('itineraries', {
  id: uuid('id').primaryKey().defaultRandom(),
  cruiseId: integer('cruise_id').references(() => cruises.id).notNull(),
  dayNumber: integer('day_number').notNull(), // itinerary[].day
  date: date('date').notNull(), // itinerary[].date
  portName: varchar('port_name', { length: 255 }).notNull(), // itinerary[].port
  portId: integer('port_id').references(() => ports.id), // Foreign key, nullable
  arrivalTime: time('arrival_time'), // itinerary[].arrive
  departureTime: time('departure_time'), // itinerary[].depart
  status: varchar('status', { length: 20 }).default('port'), // 'embark', 'port', 'at_sea', 'disembark'
  overnight: boolean('overnight').default(false),
  description: text('description'), // itinerary[].description
  activities: jsonb('activities').default('[]'),
  shoreExcursions: jsonb('shore_excursions').default('[]'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Itinerary = typeof itineraries.$inferSelect;
export type NewItinerary = typeof itineraries.$inferInsert;