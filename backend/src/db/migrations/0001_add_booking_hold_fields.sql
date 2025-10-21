-- Migration: Add cabin hold fields to bookings table
-- Date: 2025-10-21
-- Description: Add bookingType, holdExpiresAt fields and update status enum

-- Add new columns to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS booking_type VARCHAR(20) NOT NULL DEFAULT 'full_payment',
ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMP;

-- Update status enum to include 'hold'
-- Note: PostgreSQL requires recreating the enum type or using a check constraint
-- For simplicity, we'll add a check constraint if the column uses varchar

-- If status is an enum type, you'll need to:
-- 1. Add the new value to the enum
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'hold';

-- Or if status is varchar, update the check constraint
-- ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
-- ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
--   CHECK (status IN ('confirmed', 'pending', 'cancelled', 'failed', 'hold'));

-- Add index for faster queries on hold bookings
CREATE INDEX IF NOT EXISTS idx_bookings_booking_type ON bookings(booking_type);
CREATE INDEX IF NOT EXISTS idx_bookings_hold_expires_at ON bookings(hold_expires_at) WHERE booking_type = 'hold';

-- Add comment for documentation
COMMENT ON COLUMN bookings.booking_type IS 'Type of booking: hold (no payment yet), deposit (partial payment), or full_payment';
COMMENT ON COLUMN bookings.hold_expires_at IS 'Expiration timestamp for hold bookings (typically 7 days from creation)';
