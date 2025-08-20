import { pgTable, uuid, integer, varchar, decimal, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { cruises } from './cruises';

// Historical price tracking table
export const priceHistory = pgTable('price_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  cruiseId: integer('cruise_id').references(() => cruises.id).notNull(),
  
  // Original pricing data fields (for comparison)
  rateCode: varchar('rate_code', { length: 50 }).notNull(),
  cabinCode: varchar('cabin_code', { length: 10 }).notNull(),
  occupancyCode: varchar('occupancy_code', { length: 10 }).notNull(),
  cabinType: varchar('cabin_type', { length: 50 }),
  
  // Price fields (storing the snapshot values)
  basePrice: decimal('base_price', { precision: 10, scale: 2 }),
  adultPrice: decimal('adult_price', { precision: 10, scale: 2 }),
  childPrice: decimal('child_price', { precision: 10, scale: 2 }),
  infantPrice: decimal('infant_price', { precision: 10, scale: 2 }),
  singlePrice: decimal('single_price', { precision: 10, scale: 2 }),
  thirdAdultPrice: decimal('third_adult_price', { precision: 10, scale: 2 }),
  fourthAdultPrice: decimal('fourth_adult_price', { precision: 10, scale: 2 }),
  taxes: decimal('taxes', { precision: 10, scale: 2 }),
  ncf: decimal('ncf', { precision: 10, scale: 2 }),
  gratuity: decimal('gratuity', { precision: 10, scale: 2 }),
  fuel: decimal('fuel', { precision: 10, scale: 2 }),
  nonComm: decimal('non_comm', { precision: 10, scale: 2 }),
  portCharges: decimal('port_charges', { precision: 10, scale: 2 }),
  governmentFees: decimal('government_fees', { precision: 10, scale: 2 }),
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }),
  commission: decimal('commission', { precision: 10, scale: 2 }),
  
  // Metadata
  isAvailable: boolean('is_available').default(true),
  inventory: integer('inventory'),
  waitlist: boolean('waitlist').default(false),
  guarantee: boolean('guarantee').default(false),
  priceType: varchar('price_type', { length: 10 }).default('static'), // 'static' or 'live'
  currency: varchar('currency', { length: 3 }).default('USD'),
  
  // History tracking fields
  snapshotDate: timestamp('snapshot_date').defaultNow().notNull(),
  changeType: varchar('change_type', { length: 20 }).notNull(), // 'insert', 'update', 'delete'
  changeReason: varchar('change_reason', { length: 100 }), // 'webhook_update', 'ftp_sync', 'manual', etc.
  
  // Price change analytics
  priceChange: decimal('price_change', { precision: 10, scale: 2 }), // Difference from previous price
  priceChangePercent: decimal('price_change_percent', { precision: 5, scale: 2 }), // Percentage change
  
  // Optional: Store original pricing record ID for reference
  originalPricingId: uuid('original_pricing_id'),
  
  // Batch tracking for bulk operations
  batchId: uuid('batch_id'), // Groups related price changes
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Indexes for performance optimization
  cruiseIdIdx: index('idx_price_history_cruise_id').on(table.cruiseId),
  snapshotDateIdx: index('idx_price_history_snapshot_date').on(table.snapshotDate),
  cruiseSnapshotIdx: index('idx_price_history_cruise_snapshot').on(table.cruiseId, table.snapshotDate),
  rateCodeIdx: index('idx_price_history_rate_code').on(table.rateCode),
  cabinCodeIdx: index('idx_price_history_cabin_code').on(table.cabinCode),
  changeTypeIdx: index('idx_price_history_change_type').on(table.changeType),
  batchIdIdx: index('idx_price_history_batch_id').on(table.batchId),
  // Composite index for efficient queries by cruise, cabin, and date range
  cruiseCabinDateIdx: index('idx_price_history_cruise_cabin_date').on(
    table.cruiseId, 
    table.cabinCode, 
    table.rateCode, 
    table.snapshotDate
  ),
}));

// Aggregated price trends table for faster trend analysis
export const priceTrends = pgTable('price_trends', {
  id: uuid('id').primaryKey().defaultRandom(),
  cruiseId: integer('cruise_id').references(() => cruises.id).notNull(),
  cabinCode: varchar('cabin_code', { length: 10 }).notNull(),
  rateCode: varchar('rate_code', { length: 50 }).notNull(),
  
  // Trend period (daily, weekly, monthly)
  trendPeriod: varchar('trend_period', { length: 10 }).notNull(), // 'daily', 'weekly', 'monthly'
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  
  // Price trend data
  startPrice: decimal('start_price', { precision: 10, scale: 2 }),
  endPrice: decimal('end_price', { precision: 10, scale: 2 }),
  minPrice: decimal('min_price', { precision: 10, scale: 2 }),
  maxPrice: decimal('max_price', { precision: 10, scale: 2 }),
  avgPrice: decimal('avg_price', { precision: 10, scale: 2 }),
  
  // Change metrics
  totalChange: decimal('total_change', { precision: 10, scale: 2 }),
  totalChangePercent: decimal('total_change_percent', { precision: 5, scale: 2 }),
  priceVolatility: decimal('price_volatility', { precision: 5, scale: 2 }), // Standard deviation
  
  // Trend classification
  trendDirection: varchar('trend_direction', { length: 15 }), // 'increasing', 'decreasing', 'stable', 'volatile'
  changeCount: integer('change_count').default(0), // Number of price changes in period
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Indexes for trend analysis
  cruiseIdIdx: index('idx_price_trends_cruise_id').on(table.cruiseId),
  periodIdx: index('idx_price_trends_period').on(table.trendPeriod, table.periodStart),
  trendDirectionIdx: index('idx_price_trends_direction').on(table.trendDirection),
  cruiseCabinPeriodIdx: index('idx_price_trends_cruise_cabin_period').on(
    table.cruiseId, 
    table.cabinCode, 
    table.trendPeriod, 
    table.periodStart
  ),
}));

export type PriceHistory = typeof priceHistory.$inferSelect;
export type NewPriceHistory = typeof priceHistory.$inferInsert;
export type PriceTrends = typeof priceTrends.$inferSelect;
export type NewPriceTrends = typeof priceTrends.$inferInsert;