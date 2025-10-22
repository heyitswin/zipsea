-- Migration: Add is_hold_booking flag to booking_sessions table
-- Date: 2025-10-22
-- Description: Add is_hold_booking boolean field to track whether a session is for a hold booking

-- Add is_hold_booking column to booking_sessions table
ALTER TABLE booking_sessions
ADD COLUMN IF NOT EXISTS is_hold_booking BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN booking_sessions.is_hold_booking IS 'Flag to indicate if this session is for a hold booking (no payment) or a full payment booking';
