-- Migration: Add Live Booking Tables
-- Created: 2025-10-17
-- Description: Adds tables for Traveltek live booking integration including booking sessions, bookings, passengers, and payments

-- =====================================================
-- BOOKING SESSIONS TABLE
-- =====================================================
-- Tracks active booking flows with Traveltek session management
CREATE TABLE IF NOT EXISTS booking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  cruise_id VARCHAR(255) REFERENCES cruises(id) NOT NULL,

  -- Traveltek session data
  traveltek_session_key VARCHAR(255) NOT NULL,
  traveltek_sid VARCHAR(255) NOT NULL,
  traveltek_access_token TEXT,

  -- Passenger information
  passenger_count JSONB NOT NULL,

  -- Cabin selection
  selected_cabin_grade JSONB,

  -- Booking options
  dining_selection VARCHAR(50),
  travel_insurance BOOLEAN DEFAULT FALSE,
  special_requests TEXT,

  -- Basket data from Traveltek API
  basket_data JSONB,

  -- Session management
  expires_at TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT booking_sessions_status_check CHECK (status IN ('active', 'expired', 'completed', 'abandoned'))
);

-- Indexes for booking_sessions
CREATE INDEX idx_booking_sessions_user_id ON booking_sessions(user_id);
CREATE INDEX idx_booking_sessions_cruise_id ON booking_sessions(cruise_id);
CREATE INDEX idx_booking_sessions_status ON booking_sessions(status);
CREATE INDEX idx_booking_sessions_expires_at ON booking_sessions(expires_at);
CREATE INDEX idx_booking_sessions_traveltek_session_key ON booking_sessions(traveltek_session_key);

-- =====================================================
-- BOOKINGS TABLE
-- =====================================================
-- Stores completed bookings with Traveltek confirmation
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_session_id UUID REFERENCES booking_sessions(id) NOT NULL,
  user_id UUID REFERENCES users(id),
  cruise_id VARCHAR(255) REFERENCES cruises(id) NOT NULL,

  -- Traveltek booking references
  traveltek_booking_id VARCHAR(255) NOT NULL,
  traveltek_portfolio_id VARCHAR(255),

  -- Booking status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Complete booking response from Traveltek
  booking_details JSONB NOT NULL,

  -- Pricing information
  total_amount DECIMAL(10, 2) NOT NULL,
  deposit_amount DECIMAL(10, 2) NOT NULL,
  paid_amount DECIMAL(10, 2) NOT NULL,

  -- Payment status
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Balance due date
  balance_due_date TIMESTAMP,

  -- Admin notes
  notes TEXT,

  -- Timestamps
  confirmed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT bookings_status_check CHECK (status IN ('confirmed', 'pending', 'cancelled', 'failed')),
  CONSTRAINT bookings_payment_status_check CHECK (payment_status IN ('deposit_paid', 'fully_paid', 'pending', 'failed'))
);

-- Indexes for bookings
CREATE INDEX idx_bookings_booking_session_id ON bookings(booking_session_id);
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_cruise_id ON bookings(cruise_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX idx_bookings_traveltek_booking_id ON bookings(traveltek_booking_id);
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);
CREATE INDEX idx_bookings_confirmed_at ON bookings(confirmed_at DESC);

-- =====================================================
-- BOOKING PASSENGERS TABLE
-- =====================================================
-- Stores passenger details for each booking
CREATE TABLE IF NOT EXISTS booking_passengers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) NOT NULL,

  -- Passenger information
  passenger_number INTEGER NOT NULL,
  passenger_type VARCHAR(20) NOT NULL,

  -- Personal details
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(10) NOT NULL,
  citizenship VARCHAR(100),

  -- Contact information (for lead passenger)
  email VARCHAR(255),
  phone VARCHAR(50),

  -- Address
  street_address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  zip_code VARCHAR(20),
  country VARCHAR(100),

  -- Lead passenger flag
  is_lead_passenger BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT booking_passengers_type_check CHECK (passenger_type IN ('adult', 'child', 'infant'))
);

-- Indexes for booking_passengers
CREATE INDEX idx_booking_passengers_booking_id ON booking_passengers(booking_id);
CREATE INDEX idx_booking_passengers_is_lead ON booking_passengers(is_lead_passenger);
CREATE INDEX idx_booking_passengers_email ON booking_passengers(email);

-- =====================================================
-- BOOKING PAYMENTS TABLE
-- =====================================================
-- Tracks payment transactions for bookings
CREATE TABLE IF NOT EXISTS booking_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) NOT NULL,

  -- Payment details
  amount DECIMAL(10, 2) NOT NULL,
  payment_type VARCHAR(20) NOT NULL,

  -- Payment method
  payment_method VARCHAR(50) NOT NULL,
  last4 VARCHAR(4),

  -- Transaction reference
  transaction_id VARCHAR(255),

  -- Payment status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,

  -- Timestamps
  paid_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT booking_payments_type_check CHECK (payment_type IN ('deposit', 'full_payment', 'balance')),
  CONSTRAINT booking_payments_status_check CHECK (status IN ('pending', 'completed', 'failed', 'refunded'))
);

-- Indexes for booking_payments
CREATE INDEX idx_booking_payments_booking_id ON booking_payments(booking_id);
CREATE INDEX idx_booking_payments_status ON booking_payments(status);
CREATE INDEX idx_booking_payments_transaction_id ON booking_payments(transaction_id);
CREATE INDEX idx_booking_payments_created_at ON booking_payments(created_at DESC);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE booking_sessions IS 'Active booking sessions with Traveltek API session management (2hr TTL)';
COMMENT ON TABLE bookings IS 'Completed cruise bookings confirmed with Traveltek';
COMMENT ON TABLE booking_passengers IS 'Passenger details for each booking';
COMMENT ON TABLE booking_payments IS 'Payment transactions for bookings (deposits and final payments)';

COMMENT ON COLUMN booking_sessions.traveltek_session_key IS 'Traveltek sessionkey (UUID) valid for 2 hours';
COMMENT ON COLUMN booking_sessions.traveltek_sid IS 'Traveltek search ID (sid) for supplier context';
COMMENT ON COLUMN booking_sessions.passenger_count IS 'JSON: {adults: number, children: number, childAges: number[]}';
COMMENT ON COLUMN booking_sessions.expires_at IS 'Session expiry timestamp (2 hours from creation)';

COMMENT ON COLUMN bookings.traveltek_booking_id IS 'Booking reference from Traveltek /book.pl response';
COMMENT ON COLUMN bookings.booking_details IS 'Complete booking response JSON from Traveltek';
COMMENT ON COLUMN bookings.payment_status IS 'Tracks deposit vs full payment status';

COMMENT ON COLUMN booking_passengers.is_lead_passenger IS 'Lead passenger is the booker/contact person';

COMMENT ON COLUMN booking_payments.last4 IS 'Last 4 digits of payment card (for display only, PCI compliant)';
