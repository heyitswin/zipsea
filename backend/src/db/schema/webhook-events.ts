import {
  pgTable,
  serial,
  varchar,
  integer,
  jsonb,
  timestamp,
  text,
  boolean,
  index,
} from 'drizzle-orm/pg-core';

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: serial('id').primaryKey(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    lineId: integer('line_id'),
    payload: jsonb('payload').notNull(),
    status: varchar('status', { length: 50 }).default('pending'),
    createdAt: timestamp('created_at').defaultNow(),
    processedAt: timestamp('processed_at'),
    metadata: jsonb('metadata'),
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').default(0),
  },
  table => ({
    statusIdx: index('idx_webhook_events_status').on(table.status),
    lineIdIdx: index('idx_webhook_events_line_id').on(table.lineId),
    createdAtIdx: index('idx_webhook_events_created_at').on(table.createdAt),
  })
);

export const systemFlags = pgTable(
  'system_flags',
  {
    id: serial('id').primaryKey(),
    flagKey: varchar('flag_key', { length: 255 }).unique().notNull(),
    flagValue: text('flag_value'),
    flagType: varchar('flag_type', { length: 50 }),
    description: text('description'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  table => ({
    typeIdx: index('idx_system_flags_type').on(table.flagType),
    keyIdx: index('idx_system_flags_key').on(table.flagKey),
  })
);

export const priceSnapshots = pgTable(
  'price_snapshots',
  {
    id: serial('id').primaryKey(),
    lineId: integer('line_id'),
    cruiseId: varchar('cruise_id', { length: 255 }),
    snapshotData: jsonb('snapshot_data').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    webhookEventId: integer('webhook_event_id').references(() => webhookEvents.id),
    priceChangeDetected: boolean('price_change_detected').default(false),
    metadata: jsonb('metadata'),
  },
  table => ({
    cruiseIdIdx: index('idx_price_snapshots_cruise_id').on(table.cruiseId),
    dateIdx: index('idx_price_snapshots_date').on(table.createdAt),
    webhookIdx: index('idx_price_snapshots_webhook').on(table.webhookEventId),
  })
);

export const syncLocks = pgTable(
  'sync_locks',
  {
    id: serial('id').primaryKey(),
    lockKey: varchar('lock_key', { length: 255 }).unique().notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    acquiredAt: timestamp('acquired_at').defaultNow().notNull(),
    releasedAt: timestamp('released_at'),
    metadata: jsonb('metadata'),
  },
  table => ({
    keyIdx: index('idx_sync_locks_key').on(table.lockKey),
    activeIdx: index('idx_sync_locks_active').on(table.isActive),
  })
);

export const webhookProcessingLog = pgTable(
  'webhook_processing_log',
  {
    id: serial('id').primaryKey(),
    webhookEventId: integer('webhook_event_id').references(() => webhookEvents.id),
    cruiseId: varchar('cruise_id', { length: 255 }),
    action: varchar('action', { length: 50 }),
    status: varchar('status', { length: 50 }),
    message: text('message'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => ({
    eventIdx: index('idx_webhook_log_event').on(table.webhookEventId),
    cruiseIdx: index('idx_webhook_log_cruise').on(table.cruiseId),
  })
);

// Type exports for TypeScript
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;

export type SystemFlag = typeof systemFlags.$inferSelect;
export type NewSystemFlag = typeof systemFlags.$inferInsert;

export type PriceSnapshot = typeof priceSnapshots.$inferSelect;
export type NewPriceSnapshot = typeof priceSnapshots.$inferInsert;

export type SyncLock = typeof syncLocks.$inferSelect;
export type NewSyncLock = typeof syncLocks.$inferInsert;

export type WebhookProcessingLogEntry = typeof webhookProcessingLog.$inferSelect;
export type NewWebhookProcessingLogEntry = typeof webhookProcessingLog.$inferInsert;
