-- Migration: Add cabin hold fields to bookings table
-- Date: 2025-10-21
-- Description: Add bookingType, holdExpiresAt fields and update status validation

-- Add new columns to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS booking_type VARCHAR(20) NOT NULL DEFAULT 'full_payment',
ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMP;

-- Update status column to allow 'hold' value
-- Since booking_status enum type doesn't exist, status is using varchar
-- We'll add/update a check constraint to include 'hold'

DO $$
BEGIN
    -- Drop existing status constraint if it exists
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bookings_status_check'
        AND conrelid = 'bookings'::regclass
    ) THEN
        ALTER TABLE bookings DROP CONSTRAINT bookings_status_check;
    END IF;

    -- Add new constraint with 'hold' included
    ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
        CHECK (status IN ('confirmed', 'pending', 'cancelled', 'failed', 'hold'));
EXCEPTION
    WHEN OTHERS THEN
        -- If constraint already exists or other error, just continue
        RAISE NOTICE 'Status constraint update skipped: %', SQLERRM;
END $$;

-- Add index for faster queries on hold bookings
CREATE INDEX IF NOT EXISTS idx_bookings_booking_type ON bookings(booking_type);
CREATE INDEX IF NOT EXISTS idx_bookings_hold_expires_at ON bookings(hold_expires_at) WHERE booking_type = 'hold';

-- Add comment for documentation
COMMENT ON COLUMN bookings.booking_type IS 'Type of booking: hold (no payment yet), deposit (partial payment), or full_payment';
COMMENT ON COLUMN bookings.hold_expires_at IS 'Expiration timestamp for hold bookings (typically 7 days from creation)';
