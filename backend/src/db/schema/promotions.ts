import { pgTable, varchar, timestamp, integer, serial, boolean, text } from 'drizzle-orm/pg-core';

// Promotions table - admin-configurable promotional messages
export const promotions = pgTable('promotions', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(), // Internal name for admins
  message: varchar('message', { length: 200 }).notNull(), // The promotional message to display
  type: varchar('type', { length: 50 }).notNull().default('onboard_credit'), // Type: onboard_credit, gratuities_paid, specialty_dining, etc.
  calculationType: varchar('calculation_type', { length: 50 }).notNull().default('percentage'), // percentage, fixed, formula
  calculationValue: integer('calculation_value'), // e.g., 20 for 20%, or 500 for $500
  formula: text('formula'), // Custom formula for complex calculations (e.g., "price * 0.2 rounded to nearest 10")
  isActive: boolean('is_active').notNull().default(true),
  priority: integer('priority').notNull().default(0), // Higher priority promotions show first
  startDate: timestamp('start_date'), // Optional: promotion valid from this date
  endDate: timestamp('end_date'), // Optional: promotion valid until this date
  minPrice: integer('min_price'), // Optional: minimum cruise price to qualify
  maxPrice: integer('max_price'), // Optional: maximum cruise price to qualify
  applicableCruiseLineIds: integer('applicable_cruise_line_ids').array(), // Optional: array of cruise line IDs
  applicableRegionIds: integer('applicable_region_ids').array(), // Optional: array of region IDs
  notes: text('notes'), // Admin notes about the promotion
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Type definitions
export type Promotion = typeof promotions.$inferSelect;
export type NewPromotion = typeof promotions.$inferInsert;
