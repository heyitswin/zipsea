# Frontend Live Booking Flow - Final Specification

**Date:** October 18, 2025  
**Status:** Ready for Phase 5 Implementation  
**Project Progress:** 55% → Starting Frontend

---

## Overview

This document defines the complete user flow for live cruise booking on Zipsea, optimized for minimal steps while meeting Traveltek API requirements.

### Design Principles
1. **Minimize friction** - Fewest possible steps and form fields
2. **Progressive disclosure** - Simple path for most users, advanced options for power users
3. **Clear expectations** - Users always know what's next
4. **Trust & transparency** - Show pricing breakdown, no surprises

---

## Complete User Journey

### 0️⃣ Homepage / Any Page (Entry Point)

**Passenger Selection Widget** (Always visible)

```
┌─────────────────────────────────────────┐
│ Plan Your Cruise                         │
│                                          │
│ Adults: [2 ▼]    Children: [0 ▼]        │
│                                          │
│ [Search Cruises]  ← Creates session     │
└─────────────────────────────────────────┘
```

**If Children > 0, show age selectors:**
```
┌─────────────────────────────────────────┐
│ Adults: [2 ▼]    Children: [2 ▼]        │
│                                          │
│ Child 1 Age: [5 ▼]                       │
│ Child 2 Age: [8 ▼]                       │
│                                          │
│ [Search Cruises]                         │
└─────────────────────────────────────────┘
```

**Backend Action:**
- Creates Traveltek session with passenger count
- Returns `sessionId` (stored in URL + localStorage)
- Session valid for 2 hours

**Technical Notes:**
- Age selectors: Dropdown 0-17 years
- Session ID format: UUID (e.g., `a1b2c3d4-...`)
- Store in URL: `?sessionId=xxx` for shareable links

---

### 1️⃣ Cruise Browse (Search Results)

**No changes from current implementation**

- Grid/list view of cruises
- Shows cached cheapest prices (independent of passenger count)
- Filter by date, destination, cruise line, price, etc.
- Click cruise → Cruise Detail

**Note:** Search results use cached pricing from daily sync, not live pricing (by design for performance)

---

### 2️⃣ Cruise Detail Page (The Big Change!)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ 🚢 7-Night Alaska                                    │
│ Royal Caribbean • Ovation of the Seas               │
│ Jun 1 - Jun 8, 2026 • Seattle Roundtrip            │
│                                                      │
│ [Overview] [Itinerary] [Ship] [Select Cabin]        │
├─────────────────────────────────────────────────────┤
│                                                      │
│ 🛏️ Select Your Cabin                                │
│ Pricing for 2 Adults                                │
│                                                      │
│ [Interior] [Oceanview] [Balcony] [Suite]  ← Tabs   │
│                                                      │
│ ┌─────────────────────────────────────────────┐    │
│ │ Interior Stateroom - Guaranteed       ⭐    │    │
│ │ $2,487 total • $1,243 per person            │    │
│ │                                              │    │
│ │ ✓ 166 sq ft                                 │    │
│ │ ✓ Two twin beds convert to Royal King      │    │
│ │ ✓ Bathroom with shower                      │    │
│ │                                              │    │
│ │           [Reserve This Cabin] ←────────────┤    │
│ └─────────────────────────────────────────────┘    │
│                                                      │
│ ┌─────────────────────────────────────────────┐    │
│ │ Interior with Virtual Balcony                │    │
│ │ $2,746 total • $1,373 per person            │    │
│ │                                              │    │
│ │ ✓ 166 sq ft with HD live ocean view        │    │
│ │ ✓ Two twin beds + sofa bed                 │    │
│ │                                              │    │
│ │      [Choose Specific Cabin] ←──────────────┤    │
│ └─────────────────────────────────────────────┘    │
│                                                      │
│ ┌─────────────────────────────────────────────┐    │
│ │ Connecting Interior with Virtual Balcony     │    │
│ │ $2,967 total • $1,483 per person            │    │
│ │                                              │    │
│ │      [Choose Specific Cabin]                │    │
│ └─────────────────────────────────────────────┘    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Cabin Sorting Logic:**
1. **First cabin** in each category = "Guaranteed" (cheapest)
   - Shows "⭐ Best Value" badge
   - CTA: "Reserve This Cabin" (green, prominent)
   - Clicking → Proceed directly to Step 1 (Options page)

2. **Other cabins** = Specific grades/categories
   - CTA: "Choose Specific Cabin" (secondary style)
   - Clicking → Opens cabin selection modal (see below)

**Price Display:**
```
$2,487 total • $1,243 per person
```
- Always USD (fixed in backend)
- Total = Fare + Taxes + NCF + Gratuities
- Show price breakdown on hover/expand

**Data Source:**
- API: `GET /api/v1/booking/:sessionId/pricing?cruiseId=xxx`
- Returns all cabin grades with live pricing
- Group by `codtype`: inside, outside, balcony, suite
- Sort by `cheapestprice` ascending

---

### 2.5️⃣ Cabin Selection Modal (Optional - Advanced Users)

**Triggered by:** Clicking "Choose Specific Cabin" on non-guaranteed cabins

```
┌─────────────────────────────────────────────┐
│ Choose Your Cabin                      [X]  │
├─────────────────────────────────────────────┤
│ Interior with Virtual Balcony               │
│ $2,746 total for 2 guests                   │
│                                             │
│ Select Deck & Cabin:                        │
│                                             │
│ Deck 7 - Forward                            │
│ ○ 7001 - Port side    $2,746               │
│ ○ 7002 - Starboard    $2,746               │
│ ● 7003 - Port side    $2,746 ✓ Selected    │
│                                             │
│ Deck 8 - Midship                            │
│ ○ 8001 - Port side    $2,799               │
│ ○ 8002 - Starboard    $2,799               │
│                                             │
│ Deck 9 - Aft                                │
│ ○ 9001 - Port side    $2,850               │
│ ⊗ 9002 - Unavailable                        │
│                                             │
│ [Cancel]           [Reserve Cabin 7003] ←───│
└─────────────────────────────────────────────┘
```

**Modal Features:**
- Shows available cabins by deck
- Displays position (Forward/Midship/Aft, Port/Starboard)
- Price may vary by cabin (premium locations cost more)
- Unavailable cabins shown as disabled
- Selected cabin highlighted
- CTA updates with cabin number

**Backend Call:**
- API: `GET /api/v1/booking/:sessionId/cabins?gradeNo=xxx`
- Returns specific cabin availability
- **Note:** This endpoint needs to be implemented (call Traveltek's cabin selection API)

**User Action:**
- Select cabin → Click "Reserve Cabin 7003"
- Modal closes → Proceed to Step 1 (Options page)

---

### 3️⃣ Step 1: Booking Options

```
┌─────────────────────────────────────────────┐
│ ← Back to Cruise                       [X]  │
├─────────────────────────────────────────────┤
│ Customize Your Experience                   │
│                                             │
│ 🍽️ Dining Preference                        │
│ ○ Traditional Dining                        │
│   First seating (6:00 PM) or               │
│   Second seating (8:30 PM)                 │
│                                             │
│ ● Anytime Dining ✓                          │
│   Dine when you want, 5:30 PM - 9:30 PM   │
│                                             │
│ 📝 Special Requests (Optional)              │
│ ┌─────────────────────────────────────┐    │
│ │ Celebrating our anniversary!        │    │
│ │                                     │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ Note: We'll do our best to accommodate     │
│ your requests, but they are not guaranteed.│
│                                             │
│                  [Continue to Passengers] ←─│
└─────────────────────────────────────────────┘
```

**Sidebar (Desktop) / Bottom Sheet (Mobile):**
```
┌─────────────────────────┐
│ Your Booking            │
├─────────────────────────┤
│ 7-Night Alaska          │
│ Jun 1 - Jun 8, 2026     │
│                         │
│ Cabin:                  │
│ Interior - Guaranteed   │
│ (or "Cabin 7003 Deck 7")│
│                         │
│ Passengers: 2 Adults    │
│                         │
│ ───────────────────     │
│ Cruise Fare  $1,750.00  │
│ Taxes & Fees $  598.36  │
│ Gratuities   $  259.00  │
│ ───────────────────     │
│ Total        $2,487.36  │
│              USD        │
└─────────────────────────┘
```

**Backend Data:**
- Dining codes retrieved from basket response
- Options stored temporarily (not sent to API yet)
- No API call on this page - just collecting data

**Future Additions:**
- Travel insurance toggle
- Shore excursions
- Beverage packages
- Spa packages

---

### 4️⃣ Step 2: Passenger Details

```
┌─────────────────────────────────────────────┐
│ ← Back to Options                      [X]  │
├─────────────────────────────────────────────┤
│ Passenger Information                        │
│                                             │
│ 👤 Lead Passenger (You)                     │
│                                             │
│ First Name      [John            ]          │
│ Last Name       [Smith           ]          │
│                                             │
│ Email           [john@email.com  ] ← Prefill if logged in
│ Phone           [+1 206-555-0123 ]          │
│                                             │
│ Date of Birth   [01/15/1985      ]          │
│ Gender          [Male          ▼]           │
│                                             │
│ 🏠 Address                                  │
│ Street Address  [123 Main Street ]          │
│ City            [Seattle         ]          │
│ State           [WA            ▼]           │
│ ZIP Code        [98101           ]          │
│ Country         [United States ▼]           │
│                                             │
│ ─────────────────────────────────────       │
│                                             │
│ 👤 Passenger 2                              │
│                                             │
│ First Name      [Jane            ]          │
│ Last Name       [Smith           ]          │
│ Date of Birth   [03/20/1987      ]          │
│ Gender          [Female        ▼]           │
│                                             │
│ ─────────────────────────────────────       │
│                                             │
│                    [Continue to Payment] ←──│
└─────────────────────────────────────────────┘
```

**Field Requirements:**

**Lead Passenger (9 fields):**
- ✅ First name, last name
- ✅ Email, phone
- ✅ Date of birth, gender
- ✅ Address (street, city, state, zip, country)

**Additional Passengers (4 fields each):**
- ✅ First name, last name
- ✅ Date of birth, gender

**Field Validation:**
- Email: Valid email format
- Phone: Valid phone number (various formats accepted)
- DOB: Must be 18+ for adults, <18 for children
- All text fields: No special characters except hyphens, apostrophes

**Smart Features:**
- Prefill from user account if logged in
- Gender dropdown: Male, Female, Other
- State/Country dropdowns with search
- Age validation against passenger type (adult vs child)

**Backend Storage:**
- Data stored temporarily in session
- Not sent to API until final payment step

---

### 5️⃣ Step 3: Payment & Confirmation

```
┌─────────────────────────────────────────────┐
│ ← Back to Passengers                   [X]  │
├─────────────────────────────────────────────┤
│ Payment Information                          │
│                                             │
│ 💳 Card Details                             │
│                                             │
│ Card Number                                 │
│ [4532 1234 5678 9010     ] [VISA]          │
│                                             │
│ Name on Card                                │
│ [John Smith              ]                  │
│                                             │
│ Expiration        Security Code             │
│ [12 ▼] [2027 ▼]  [123  ]                   │
│                                             │
│ Billing ZIP Code                            │
│ [98101           ]                          │
│                                             │
│ ─────────────────────────────────────       │
│                                             │
│ 📋 Review Your Booking                      │
│                                             │
│ 7-Night Alaska                              │
│ Royal Caribbean • Ovation of the Seas       │
│ Jun 1 - Jun 8, 2026                         │
│ Seattle → Seattle                           │
│                                             │
│ Cabin: Interior Stateroom - Guaranteed      │
│ Dining: Anytime Dining                      │
│                                             │
│ Passengers:                                 │
│ • John Smith (Adult)                        │
│ • Jane Smith (Adult)                        │
│                                             │
│ ─────────────────────────────────────       │
│ Cruise Fare            $1,750.00 USD        │
│ Taxes & Fees           $  598.36 USD        │
│ Gratuities             $  259.00 USD        │
│ ─────────────────────────────────────       │
│ Total                  $2,487.36 USD        │
│                                             │
│ ☐ I agree to the Terms & Conditions         │
│                                             │
│       [Confirm and Pay $2,487.36] ←─────────│
│                                             │
│ 🔒 Secure payment powered by Traveltek      │
└─────────────────────────────────────────────┘
```

**Payment Fields:**
- Card number (auto-detect type: Visa, MC, Amex, Discover)
- Name on card
- Expiration month/year (dropdowns)
- CVV/Security code (3-4 digits)
- Billing ZIP code

**Security:**
- Card number masked as typed: `4532 •••• •••• 9010`
- CVV field masked
- SSL/HTTPS only
- PCI compliance (card data sent directly to Traveltek, not stored)

**Backend Action:**
When "Confirm and Pay" clicked:
1. Validate all form data
2. Create booking via Traveltek API:
   - POST `/api/v1/booking/:sessionId/create`
   - Sends passenger details + payment info
   - Traveltek processes payment
3. Store booking in our database
4. Return booking confirmation

**Loading State:**
```
┌─────────────────────────────────────────────┐
│ Processing Your Booking...                  │
│                                             │
│ ⏳ Please wait while we confirm your        │
│    reservation with Royal Caribbean.        │
│                                             │
│ This may take up to 30 seconds.            │
│                                             │
│ Do not close this window.                  │
└─────────────────────────────────────────────┘
```

---

### 6️⃣ Success Page

```
┌─────────────────────────────────────────────┐
│ 🎉 Booking Confirmed!                       │
├─────────────────────────────────────────────┤
│ Your cruise has been successfully booked.   │
│                                             │
│ Booking Reference: RC-2026-123456           │
│                                             │
│ ✅ Confirmation email sent to:              │
│    john@email.com                           │
│                                             │
│ ─────────────────────────────────────       │
│                                             │
│ 7-Night Alaska                              │
│ Royal Caribbean • Ovation of the Seas       │
│ Jun 1 - Jun 8, 2026                         │
│                                             │
│ Passengers: John Smith, Jane Smith          │
│ Cabin: Interior Stateroom - Guaranteed      │
│                                             │
│ Total Paid: $2,487.36 USD                   │
│                                             │
│ ─────────────────────────────────────       │
│                                             │
│ 📧 What's Next?                             │
│ • Check your email for full details         │
│ • Complete online check-in 30 days before  │
│ • Arrive at port 2 hours before departure  │
│                                             │
│ [View Booking Details]  [Search More Cruises]│
└─────────────────────────────────────────────┘
```

**Success Page Features:**
- Booking reference number (from Traveltek)
- Summary of booking
- Email confirmation notice
- Next steps
- CTAs: View details, book another cruise

**Backend:**
- Booking stored in `bookings` table
- Passengers stored in `booking_passengers` table
- Payment record in `booking_payments` table
- Session marked as completed

---

## Technical Implementation Notes

### Session Management

**Session Lifecycle:**
1. Created: When user enters passenger count
2. Active: User browsing cabins and booking
3. Expires: 2 hours from creation
4. Completed: Payment successful

**Session Storage:**
- Backend: Redis (fast access) + PostgreSQL (persistence)
- Frontend: URL parameter + localStorage (backup)
- Format: `sessionId=a1b2c3d4-e5f6-...`

**Session Data:**
```typescript
{
  sessionId: string;
  traveltekSessionKey: string;
  traveltekSid: string;
  cruiseId: string;
  passengerCount: {
    adults: number;
    children: number;
    childAges: number[];
  };
  selectedCabin?: {
    gradeNo: string;
    rateCode: string;
    resultNo: string;
    cabinNo?: string; // If specific cabin selected
  };
  expiresAt: Date;
}
```

### API Endpoints (Backend)

**Already Implemented:**
- `POST /api/v1/booking/session` - Create session
- `GET /api/v1/booking/:sessionId/pricing` - Get cabin grades
- `POST /api/v1/booking/:sessionId/select-cabin` - Add to basket
- `GET /api/v1/booking/:sessionId/basket` - Get basket
- `POST /api/v1/booking/:sessionId/create` - Create booking

**Need to Implement:**
- `GET /api/v1/booking/:sessionId/cabins` - Get specific cabin availability (for modal)
  - Calls Traveltek cabin selection API
  - Returns available cabins by deck/position

### Frontend Components Needed

**New Components:**
1. `PassengerSelector` - Homepage widget
2. `CabinTypeTabsç` - Interior/Oceanview/Balcony/Suite tabs
3. `CabinCard` - Individual cabin display
4. `CabinSelectionModal` - Deck/cabin picker
5. `BookingProgress` - Step indicator (1 of 3, 2 of 3, etc.)
6. `BookingSummary` - Sidebar with pricing
7. `PassengerForm` - Multi-passenger form
8. `PaymentForm` - Card details input
9. `BookingReview` - Final review before payment
10. `BookingSuccess` - Confirmation page

**Shared/Modified:**
- `CruiseDetail` - Add cabin selection section
- `PriceDisplay` - Show live pricing with breakdown
- `LoadingSpinner` - For API calls
- `ErrorBoundary` - Handle errors gracefully

### State Management

**Option 1: React Context (Simpler)**
```typescript
<BookingProvider>
  <CruiseDetail />
  <OptionsPage />
  <PassengersPage />
  <PaymentPage />
</BookingProvider>
```

**Option 2: Zustand (More scalable)**
```typescript
const useBookingStore = create((set) => ({
  sessionId: null,
  selectedCabin: null,
  passengers: [],
  options: {},
  setSessionId: (id) => set({ sessionId: id }),
  // ... other actions
}));
```

### Mobile Responsiveness

**Key Considerations:**
- Passenger selector: Overlay/modal on mobile
- Cabin tabs: Horizontal scroll on mobile
- Forms: Stack fields vertically, larger touch targets
- Booking summary: Sticky bottom sheet on mobile
- Modal: Full-screen on mobile

---

## User Experience Principles

### Speed Optimization
- Prefetch cabin pricing when cruise detail loads
- Optimistic UI updates
- Show loading states for all async operations
- Cache session data in localStorage

### Error Handling
- Session expired → Prompt to restart with same selections
- Payment failed → Allow retry without re-entering data
- Cabin unavailable → Show alternative similar cabins
- Network error → Retry with backoff

### Accessibility
- Keyboard navigation for all flows
- Screen reader labels on all form fields
- Color contrast compliance (WCAG AA)
- Focus management in modals
- Error messages clearly associated with fields

### Trust & Transparency
- Show all pricing components clearly
- Secure payment badges
- Privacy policy links
- Terms & conditions checkbox
- "Why we need this" tooltips for sensitive fields

---

## Success Metrics

**Conversion Rate:**
- Homepage → Cruise Detail: 40%
- Cruise Detail → Reserve: 15%
- Reserve → Payment: 60%
- Payment → Confirmation: 85%
- Overall: ~5% homepage to booking

**Time to Book:**
- Target: < 3 minutes from Reserve to Confirmation
- Passenger details: < 60 seconds
- Payment: < 30 seconds

**Error Rates:**
- Payment failures: < 5%
- Session expirations: < 2%
- Form validation errors: < 10%

---

## Future Enhancements

**Phase 6+:**
- Travel insurance upsell
- Shore excursions during booking
- Beverage/dining packages
- Room upgrades after booking
- Group bookings (>8 passengers)
- Multi-cabin bookings
- Gift bookings
- Payment plans/deposits

---

## Appendix: API Response Examples

### Cabin Pricing Response
```json
{
  "cabinGrades": [
    {
      "id": "ZI",
      "name": "Interior Stateroom - Guaranteed",
      "codtype": "inside",
      "cheapestprice": "2487.36",
      "currency": "USD",
      "gridpricing": [
        {
          "available": "Y",
          "resultNo": "201_0.139522",
          "gradeNo": "201:CU286197:5",
          "rateCode": "CU286197",
          "fare": 1349,
          "taxes": 598.36,
          "gratuity": 259,
          "fees": 540,
          "price": 2487.36
        }
      ]
    }
  ]
}
```

### Booking Creation Request
```json
{
  "passengers": [
    {
      "firstname": "John",
      "lastname": "Smith",
      "dob": "1985-01-15",
      "gender": "M",
      "paxtype": "adult",
      "age": 40
    },
    {
      "firstname": "Jane",
      "lastname": "Smith",
      "dob": "1987-03-20",
      "gender": "F",
      "paxtype": "adult",
      "age": 38
    }
  ],
  "contact": {
    "firstname": "John",
    "lastname": "Smith",
    "email": "john@email.com",
    "telephone": "+1-206-555-0123",
    "address1": "123 Main Street",
    "city": "Seattle",
    "county": "WA",
    "postcode": "98101",
    "country": "US"
  },
  "payment": {
    "cardNumber": "4532123456789010",
    "cardholderName": "John Smith",
    "expiryMonth": "12",
    "expiryYear": "2027",
    "cvv": "123",
    "billingZip": "98101"
  },
  "dining": "anytime"
}
```

---

**Document Version:** 1.0  
**Last Updated:** October 18, 2025  
**Status:** ✅ Approved - Ready for Implementation
