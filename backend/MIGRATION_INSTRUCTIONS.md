# Database Migration Instructions for Cabin Hold Feature

## Overview
This migration adds support for cabin hold bookings (reserve now, pay later feature).

## Changes Required

### 1. New Columns Added to `bookings` Table:
- `booking_type` - VARCHAR(20), default 'full_payment'
- `hold_expires_at` - TIMESTAMP, nullable

### 2. Updated `status` Enum:
- Added 'hold' as a valid status value

## Running the Migration

### Option 1: Using the SQL File (Recommended for Render)

```bash
# On Render or your production server
cd /path/to/backend

# Connect to your database and run the migration
psql $DATABASE_URL -f src/db/migrations/0001_add_booking_hold_fields.sql
```

### Option 2: Manual SQL Execution

Connect to your PostgreSQL database and run these commands:

```sql
-- Add new columns
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS booking_type VARCHAR(20) NOT NULL DEFAULT 'full_payment',
ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMP;

-- Add 'hold' to status enum (adjust based on your current implementation)
-- If status uses an enum type:
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'hold';

-- If status uses varchar with check constraint:
-- First, check what constraint exists:
-- SELECT conname FROM pg_constraint WHERE conname LIKE '%bookings_status%';
-- Then drop and recreate with new value

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_booking_type ON bookings(booking_type);
CREATE INDEX IF NOT EXISTS idx_bookings_hold_expires_at ON bookings(hold_expires_at) 
WHERE booking_type = 'hold';
```

### Option 3: Using Drizzle Kit (If Configured)

```bash
cd backend
npx drizzle-kit generate:pg
# Review the generated migration
# Then apply it:
npx drizzle-kit push:pg
```

## Verification

After running the migration, verify the changes:

```sql
-- Check new columns exist
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
AND column_name IN ('booking_type', 'hold_expires_at');

-- Check indexes were created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'bookings' 
AND indexname LIKE 'idx_bookings_%';

-- Verify enum/constraint for status field
-- For enum type:
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'booking_status');

-- For varchar with constraint:
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'bookings'::regclass 
AND conname LIKE '%status%';
```

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Remove indexes
DROP INDEX IF EXISTS idx_bookings_booking_type;
DROP INDEX IF EXISTS idx_bookings_hold_expires_at;

-- Remove columns
ALTER TABLE bookings DROP COLUMN IF EXISTS booking_type;
ALTER TABLE bookings DROP COLUMN IF EXISTS hold_expires_at;

-- Note: Removing enum values is more complex and may not be necessary
```

## Testing

After migration:

1. Restart your backend service
2. Test creating a hold booking via the UI
3. Check that hold bookings are stored correctly:
   ```sql
   SELECT id, status, booking_type, hold_expires_at 
   FROM bookings 
   WHERE booking_type = 'hold' 
   LIMIT 5;
   ```

## Notes

- The migration is designed to be idempotent (safe to run multiple times)
- Existing bookings will have `booking_type = 'full_payment'` by default
- `hold_expires_at` will be NULL for existing bookings
- Indexes are created for performance when querying hold bookings
