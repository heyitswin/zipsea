import { pgTable, uuid, integer, varchar, decimal, timestamp, boolean } from 'drizzle-orm/pg-core';
import { cruises } from './cruises';

// Main pricing table for static pricing data from FTP
export const pricing = pgTable('pricing', {
  id: uuid('id').primaryKey().defaultRandom(),
  cruiseId: integer('cruise_id').references(() => cruises.id).notNull(),
  rateCode: varchar('rate_code', { length: 50 }).notNull(), // RATECODE1, BESTFARE, BROCHURE, etc
  cabinCode: varchar('cabin_code', { length: 10 }).notNull(), // IB, OV, BA, S1, etc
  occupancyCode: varchar('occupancy_code', { length: 10 }).notNull(), // 101, 102, 201, etc
  cabinType: varchar('cabin_type', { length: 50 }), // prices.{}.{}.{}.cabintype
  basePrice: decimal('base_price', { precision: 10, scale: 2 }), // prices.{}.{}.{}.price
  adultPrice: decimal('adult_price', { precision: 10, scale: 2 }), // prices.{}.{}.{}.adultprice
  childPrice: decimal('child_price', { precision: 10, scale: 2 }), // prices.{}.{}.{}.childprice
  infantPrice: decimal('infant_price', { precision: 10, scale: 2 }), // prices.{}.{}.{}.infantprice
  singlePrice: decimal('single_price', { precision: 10, scale: 2 }), // prices.{}.{}.{}.singleprice
  thirdAdultPrice: decimal('third_adult_price', { precision: 10, scale: 2 }), // prices.{}.{}.{}.thirdadultprice
  fourthAdultPrice: decimal('fourth_adult_price', { precision: 10, scale: 2 }), // prices.{}.{}.{}.fourthadultprice
  taxes: decimal('taxes', { precision: 10, scale: 2 }), // prices.{}.{}.{}.taxes
  ncf: decimal('ncf', { precision: 10, scale: 2 }), // prices.{}.{}.{}.ncf (Non-Commissionable Fees)
  gratuity: decimal('gratuity', { precision: 10, scale: 2 }), // prices.{}.{}.{}.gratuity
  fuel: decimal('fuel', { precision: 10, scale: 2 }), // prices.{}.{}.{}.fuel
  nonComm: decimal('non_comm', { precision: 10, scale: 2 }), // prices.{}.{}.{}.noncomm
  portCharges: decimal('port_charges', { precision: 10, scale: 2 }),
  governmentFees: decimal('government_fees', { precision: 10, scale: 2 }),
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }), // Calculated total
  commission: decimal('commission', { precision: 10, scale: 2 }), // For agent pricing
  isAvailable: boolean('is_available').default(true),
  inventory: integer('inventory'), // Available inventory
  waitlist: boolean('waitlist').default(false),
  guarantee: boolean('guarantee').default(false),
  currency: varchar('currency', { length: 3 }).default('USD'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Denormalized cheapest pricing table for fast search
export const cheapestPricing = pgTable('cheapest_pricing', {
  id: uuid('id').primaryKey().defaultRandom(),
  cruiseId: integer('cruise_id').references(() => cruises.id).unique().notNull(),
  
  // Overall cheapest pricing
  cheapestPrice: decimal('cheapest_price', { precision: 10, scale: 2 }), // cheapest.price
  cheapestCabinType: varchar('cheapest_cabin_type', { length: 50 }), // cheapest.cabintype
  cheapestTaxes: decimal('cheapest_taxes', { precision: 10, scale: 2 }), // cheapest.taxes
  cheapestNcf: decimal('cheapest_ncf', { precision: 10, scale: 2 }), // cheapest.ncf
  cheapestGratuity: decimal('cheapest_gratuity', { precision: 10, scale: 2 }), // cheapest.gratuity
  cheapestFuel: decimal('cheapest_fuel', { precision: 10, scale: 2 }), // cheapest.fuel
  cheapestNonComm: decimal('cheapest_non_comm', { precision: 10, scale: 2 }), // cheapest.noncomm
  
  // Interior pricing
  interiorPrice: decimal('interior_price', { precision: 10, scale: 2 }), // cheapestinside.price
  interiorTaxes: decimal('interior_taxes', { precision: 10, scale: 2 }), // cheapestinside.taxes
  interiorNcf: decimal('interior_ncf', { precision: 10, scale: 2 }), // cheapestinside.ncf
  interiorGratuity: decimal('interior_gratuity', { precision: 10, scale: 2 }), // cheapestinside.gratuity
  interiorFuel: decimal('interior_fuel', { precision: 10, scale: 2 }), // cheapestinside.fuel
  interiorNonComm: decimal('interior_non_comm', { precision: 10, scale: 2 }), // cheapestinside.noncomm
  interiorPriceCode: varchar('interior_price_code', { length: 50 }), // cheapestinsidepricecode (RATECODE|CABIN|OCC)
  
  // Oceanview pricing
  oceanviewPrice: decimal('oceanview_price', { precision: 10, scale: 2 }), // cheapestoutside.price
  oceanviewTaxes: decimal('oceanview_taxes', { precision: 10, scale: 2 }), // cheapestoutside.taxes
  oceanviewNcf: decimal('oceanview_ncf', { precision: 10, scale: 2 }), // cheapestoutside.ncf
  oceanviewGratuity: decimal('oceanview_gratuity', { precision: 10, scale: 2 }), // cheapestoutside.gratuity
  oceanviewFuel: decimal('oceanview_fuel', { precision: 10, scale: 2 }), // cheapestoutside.fuel
  oceanviewNonComm: decimal('oceanview_non_comm', { precision: 10, scale: 2 }), // cheapestoutside.noncomm
  oceanviewPriceCode: varchar('oceanview_price_code', { length: 50 }), // cheapestoutsidepricecode
  
  // Balcony pricing
  balconyPrice: decimal('balcony_price', { precision: 10, scale: 2 }), // cheapestbalcony.price
  balconyTaxes: decimal('balcony_taxes', { precision: 10, scale: 2 }), // cheapestbalcony.taxes
  balconyNcf: decimal('balcony_ncf', { precision: 10, scale: 2 }), // cheapestbalcony.ncf
  balconyGratuity: decimal('balcony_gratuity', { precision: 10, scale: 2 }), // cheapestbalcony.gratuity
  balconyFuel: decimal('balcony_fuel', { precision: 10, scale: 2 }), // cheapestbalcony.fuel
  balconyNonComm: decimal('balcony_non_comm', { precision: 10, scale: 2 }), // cheapestbalcony.noncomm
  balconyPriceCode: varchar('balcony_price_code', { length: 50 }), // cheapestbalconypricecode
  
  // Suite pricing
  suitePrice: decimal('suite_price', { precision: 10, scale: 2 }), // cheapestsuite.price
  suiteTaxes: decimal('suite_taxes', { precision: 10, scale: 2 }), // cheapestsuite.taxes
  suiteNcf: decimal('suite_ncf', { precision: 10, scale: 2 }), // cheapestsuite.ncf
  suiteGratuity: decimal('suite_gratuity', { precision: 10, scale: 2 }), // cheapestsuite.gratuity
  suiteFuel: decimal('suite_fuel', { precision: 10, scale: 2 }), // cheapestsuite.fuel
  suiteNonComm: decimal('suite_non_comm', { precision: 10, scale: 2 }), // cheapestsuite.noncomm
  suitePriceCode: varchar('suite_price_code', { length: 50 }), // cheapestsuitepricecode
  
  currency: varchar('currency', { length: 3 }).default('USD'), // From cruise record
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
});

export type Pricing = typeof pricing.$inferSelect;
export type NewPricing = typeof pricing.$inferInsert;
export type CheapestPricing = typeof cheapestPricing.$inferSelect;
export type NewCheapestPricing = typeof cheapestPricing.$inferInsert;