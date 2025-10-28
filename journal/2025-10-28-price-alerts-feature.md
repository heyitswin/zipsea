# Price Alerts Feature - Implementation & Reactivation Guide

**Date:** October 28, 2025  
**Status:** Implemented but temporarily hidden  
**Reason:** Clerk authentication configuration issues between staging and production environments

---

## Feature Overview

The price alerts feature allows users to create automated alerts that monitor cruise prices matching their criteria. Users receive notifications when cruises fall below their specified budget.

### Key Capabilities:
- Create custom alerts with cruise line, departure month, region filters
- Set maximum budget threshold per person
- Specify cabin type preferences (interior, oceanview, balcony, suite)
- Define passenger information (adults, children with ages, infants) for accurate Traveltek pricing
- Daily automated monitoring via cron job
- Email notifications when matching cruises are found
- View and manage active alerts
- See matching cruises for each alert

---

## Implementation Details

### Backend Components

#### Database Schema
**File:** `backend/src/db/schema/saved-searches.ts`

```typescript
export const savedSearches = pgTable('saved_searches', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  searchCriteria: jsonb('search_criteria').notNull(),
  alertEnabled: boolean('alert_enabled').default(false),
  alertFrequency: varchar('alert_frequency', { length: 20 }).default('daily'),
  lastChecked: timestamp('last_checked'),
  lastNotified: timestamp('last_notified'),
  resultsCount: integer('results_count').default(0),
  isActive: boolean('is_active').default(true),
  
  // Price Alert specific fields
  maxBudget: decimal('max_budget', { precision: 10, scale: 2 }),
  cabinTypes: text('cabin_types').array(),
  
  // Passenger information for Traveltek pricing
  adults: integer('adults').default(2).notNull(),
  children: integer('children').default(0).notNull(),
  childAges: integer('child_ages').array(),
  infants: integer('infants').default(0).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Migration:** `backend/src/db/migrations/0017_add_passenger_fields_to_alerts.sql`

#### API Routes
**File:** `backend/src/routes/alert.routes.ts`

- `POST /api/v1/alerts` - Create new alert (authenticated)
- `GET /api/v1/alerts` - Get user's alerts (authenticated)
- `GET /api/v1/alerts/:id/matches` - Get matching cruises for an alert (authenticated)
- `PUT /api/v1/alerts/:id` - Update alert (authenticated)
- `DELETE /api/v1/alerts/:id` - Delete alert (authenticated)
- `POST /api/v1/alerts/:id/process` - Manually trigger alert processing (authenticated)

**Validation:** Zod schemas with passenger count validation (1-9 adults, 0-9 children/infants, child ages 2-17)

#### Controller
**File:** `backend/src/controllers/alert.controller.ts`

Handles CRUD operations for alerts, uses Clerk JWT authentication, integrates with alert matching and notification services.

#### Services

**Alert Matching Service:** `backend/src/services/alert-matching.service.ts`
- Finds cruises matching alert criteria
- Checks prices against budget threshold
- Records new matches in `alert_matches` table
- Filters by cabin types and passenger requirements

**Alert Cron Service:** `backend/src/services/alert-cron.service.ts`
- Scheduled to run daily
- Processes all active alerts
- Sends notifications for new matches
- Updates alert metadata (lastChecked, lastNotified, resultsCount)

**Alert Notification Service:** `backend/src/services/alert-notification.service.ts`
- Sends email notifications via Resend
- Includes alert details and matching cruise information
- Styled HTML emails with cruise cards

#### Authentication
**File:** `backend/src/middleware/auth.ts`

Uses Clerk JWT verification with:
- `secretKey` - For Clerk API calls
- `jwtKey` (publishableKey) - For JWK resolution and JWT signature verification
- `issuer` validation - Accepts any HTTPS issuer from Clerk

### Frontend Components

#### Alert Creation Page
**File:** `frontend/app/alerts/new/page.tsx`

Features:
- Pre-populate from cruise search filters via URL params
- Cruise line multi-select
- Departure month multi-select (next 24 months)
- Budget input with currency formatting
- Cabin type multi-select
- Passenger information section:
  - Adults (1-9, default 2)
  - Children (0-9, default 0)
  - Dynamic child age inputs (2-17 years)
  - Infants (0-9, default 0)
- Branded login modal if not authenticated
- Auto-generated alert name if not provided

#### Alert Dashboard
**File:** `frontend/app/alerts/page.tsx`

Features:
- List all user alerts
- Toggle alert enabled/disabled status
- Delete alerts with confirmation
- View matching cruises for each alert
- Empty state with call-to-action

#### Alert Matches Page
**File:** `frontend/app/alerts/[id]/matches/page.tsx`

Features:
- Display alert criteria and details
- List all matching cruises with pricing
- Filter by cabin types
- Book cruise directly from matches

#### Entry Point (Currently Hidden)
**File:** `frontend/app/cruises/CruisesContent.tsx` (Line ~1170)

"🔔 Create Price Alert" button - passes current search filters to alert creation page

---

## How to Reactivate

### Prerequisites

1. **Clerk Authentication Setup**
   - Decide on environment strategy:
     - **Option A:** Use test keys for staging, live keys for production (recommended)
     - **Option B:** Upgrade Clerk plan to allow multiple domains for live keys
   
2. **Environment Variables**

   **For Staging (if using test keys):**
   
   Staging Frontend (`srv-d2l0rkv5r7bs73d74dkg`):
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```
   
   Production Backend (`srv-d2idrj3ipnbc73abnee0`):
   ```
   CLERK_PUBLISHABLE_KEY=pk_test_...  (same as frontend)
   CLERK_SECRET_KEY=sk_test_...        (same as frontend)
   ```
   
   **For Production (using live keys):**
   
   Production Frontend (`srv-d2l0rkv5r7bs73d74dk0`):
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   CLERK_SECRET_KEY=sk_live_...
   ```
   
   Production Backend (`srv-d2idrj3ipnbc73abnee0`):
   ```
   CLERK_PUBLISHABLE_KEY=pk_live_...  (same as frontend)
   CLERK_SECRET_KEY=sk_live_...        (same as frontend)
   ```

   **IMPORTANT:** Frontend and backend MUST use matching key pairs (both test or both live) for JWT verification to work.

3. **Verify Middleware Configuration**
   
   **File:** `frontend/middleware.ts`
   
   Ensure `/alerts/new` is in public routes:
   ```typescript
   const isPublicRoute = createRouteMatcher([
     "/",
     "/cruises",
     "/cruises/(.*)",
     "/cruise/(.*)",
     "/booking/(.*)",
     "/alerts/new",  // ← Must be present
     // ...
   ]);
   ```

### Reactivation Steps

#### 1. Verify Authentication is Working

Test that Clerk authentication works properly:

a. **Test Login Flow:**
   - Visit any authenticated page (e.g., `/alerts`)
   - Should redirect to sign-in
   - Complete sign-in
   - Should redirect back successfully

b. **Test API Authentication:**
   - Open browser console on staging
   - Check for "Clerk Debug:" message showing `hasKey: true` and correct `keyPrefix`
   - Try creating a test alert
   - Check backend logs for any JWT verification errors

c. **Backend Logs Check:**
   ```bash
   # Via Render dashboard or CLI
   # Look for these errors:
   # ❌ "JWT signature is invalid" - Keys don't match
   # ❌ "Failed to resolve JWK" - Missing CLERK_PUBLISHABLE_KEY
   # ✅ "Created alert [id] for user [id]" - Success
   ```

#### 2. Uncomment Frontend UI

**File:** `frontend/app/cruises/CruisesContent.tsx` (Line ~1169)

Change:
```typescript
{/* TEMPORARILY HIDDEN - Price Alerts Feature 
<button onClick={() => { ... }}>
  🔔 Create Price Alert
</button>
*/}
```

To:
```typescript
<button onClick={() => { ... }}>
  🔔 Create Price Alert
</button>
```

#### 3. Test Complete Flow

a. **Create Alert:**
   - Go to `/cruises` and search for cruises
   - Click "🔔 Create Price Alert" button
   - Fill in alert details including passenger information
   - Submit and verify success redirect to matches page

b. **View Alerts:**
   - Navigate to `/alerts`
   - Verify alert appears in dashboard
   - Test toggle enabled/disabled

c. **View Matches:**
   - Click "View Matches" on an alert
   - Verify matching cruises display correctly
   - Check that pricing reflects passenger counts

d. **Test Notifications:**
   - Manually trigger alert processing via API:
     ```bash
     POST /api/v1/alerts/:id/process
     Authorization: Bearer <clerk_jwt_token>
     ```
   - Check email delivery (via Resend dashboard)
   - Verify email content and formatting

#### 4. Enable Automated Processing

The alert cron service is already implemented but may need scheduling:

**Cron Job Configuration:**
- Service: `price-alert-processor` (or similar)
- Schedule: `0 6 * * *` (daily at 6 AM)
- Command: `node scripts/process-alerts.js`

**Verify cron service exists in Render:**
- Check Render dashboard for existing cron job
- If missing, create new cron job:
  - Branch: `production`
  - Schedule: Daily
  - Command: Process all active alerts

#### 5. Deploy Changes

```bash
# Frontend
cd /Users/winlin/Desktop/sites/zipsea/frontend
git add app/cruises/CruisesContent.tsx
git commit -m "Reactivate price alerts feature - uncomment UI button"
git push origin main  # For staging
git push origin production  # For production

# Monitor deployment
# Check Render dashboard for successful deployment
# Test on staging first, then production
```

---

## Troubleshooting

### Issue: "Authentication service is not available"

**Cause:** Clerk keys not properly configured or domain mismatch

**Solutions:**
1. Check `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set in frontend environment
2. Verify key starts with `pk_test_` or `pk_live_`
3. For live keys, ensure domain is added in Clerk dashboard (or use test keys)
4. Check browser console for "Clerk Debug:" message

### Issue: 401 Unauthorized when creating alert

**Cause:** Backend can't verify JWT token

**Solutions:**
1. Verify frontend and backend use matching Clerk key pairs
2. Check `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are set in backend environment
3. Check backend logs for specific error:
   - "JWT signature is invalid" → Keys don't match
   - "Failed to resolve JWK" → Missing publishable key
4. Force redeploy backend after adding environment variables

### Issue: No matching cruises found

**Cause:** Alert criteria too restrictive or database doesn't have matching data

**Solutions:**
1. Check alert criteria (cruise lines, months, regions, budget)
2. Verify `cruises` table has data for selected criteria
3. Test search on `/cruises` page with same filters
4. Check `alert_matches` table for debugging:
   ```sql
   SELECT * FROM alert_matches WHERE alert_id = '<alert_id>';
   ```

### Issue: Email notifications not sending

**Cause:** Resend API issues or service not configured

**Solutions:**
1. Check `RESEND_API_KEY` is set in backend environment
2. Verify sender email is verified in Resend dashboard
3. Check Resend dashboard for delivery logs
4. Test email sending manually via API
5. Check backend logs for Resend API errors

---

## Database Schema Reference

### Tables

**saved_searches** - Stores alert configurations
- Primary table for alerts
- Includes search criteria, budget, cabin types, passenger info

**alert_matches** - Tracks matching cruises
- Records which cruises match which alerts
- Prevents duplicate notifications
- Schema:
  ```sql
  CREATE TABLE alert_matches (
    id UUID PRIMARY KEY,
    alert_id UUID REFERENCES saved_searches(id),
    cruise_id INTEGER REFERENCES cruises(id),
    matched_at TIMESTAMP,
    notified BOOLEAN,
    price DECIMAL(10, 2),
    cabin_type VARCHAR(50)
  );
  ```

**users** - Clerk user mapping
- Links Clerk user IDs to internal user records

---

## API Documentation

### Create Alert

```http
POST /api/v1/alerts
Authorization: Bearer <clerk_jwt_token>
Content-Type: application/json

{
  "name": "Caribbean Cruises under $2000",
  "searchCriteria": {
    "cruiseLineId": [1, 5, 22],
    "departureMonth": ["2026-07", "2026-08"],
    "regionId": [3]
  },
  "maxBudget": 2000,
  "cabinTypes": ["balcony", "suite"],
  "adults": 2,
  "children": 1,
  "childAges": [10],
  "infants": 0
}
```

### Get User Alerts

```http
GET /api/v1/alerts
Authorization: Bearer <clerk_jwt_token>
```

### Get Alert Matches

```http
GET /api/v1/alerts/:id/matches
Authorization: Bearer <clerk_jwt_token>
```

### Update Alert

```http
PUT /api/v1/alerts/:id
Authorization: Bearer <clerk_jwt_token>
Content-Type: application/json

{
  "alertEnabled": false,
  "maxBudget": 1500
}
```

### Delete Alert

```http
DELETE /api/v1/alerts/:id
Authorization: Bearer <clerk_jwt_token>
```

---

## Testing Checklist

Before going live:

- [ ] Clerk authentication works on staging
- [ ] Clerk authentication works on production
- [ ] JWT verification works between frontend and backend
- [ ] Alert creation succeeds
- [ ] Alert list page displays alerts
- [ ] Alert matches page shows cruises
- [ ] Alert toggle (enable/disable) works
- [ ] Alert deletion works
- [ ] Passenger information is captured and stored
- [ ] Price filtering uses passenger counts
- [ ] Manual alert processing works
- [ ] Email notifications send successfully
- [ ] Email content is correct and styled
- [ ] Cron job is scheduled
- [ ] Automated daily processing works
- [ ] New matches are detected correctly
- [ ] Duplicate notifications are prevented
- [ ] All API endpoints require authentication
- [ ] Public routes work without login
- [ ] Branded login modal appears on create alert

---

## Future Enhancements

Potential improvements for the price alerts feature:

1. **Notification Preferences**
   - SMS notifications via Twilio
   - Push notifications
   - Slack/Discord webhooks
   - Notification frequency settings (instant, daily digest, weekly)

2. **Advanced Filtering**
   - Port preferences
   - Ship preferences
   - Cruise duration ranges
   - Specific date ranges
   - Exclude specific dates/ports

3. **Price Tracking**
   - Historical price charts
   - Price drop percentage alerts
   - Best time to book recommendations
   - Price predictions using ML

4. **Alert Management**
   - Alert templates/presets
   - Duplicate/clone alerts
   - Bulk operations
   - Export alert results

5. **Social Features**
   - Share alerts with friends/family
   - Collaborative alerts for group bookings
   - Public alert feeds

6. **Analytics**
   - Alert performance metrics
   - User engagement tracking
   - Notification open rates
   - Conversion tracking (alert → booking)

---

## Files Modified/Created

### Backend Files
- `src/db/schema/saved-searches.ts` - Alert schema with passenger fields
- `src/db/migrations/0017_add_passenger_fields_to_alerts.sql` - Migration
- `src/routes/alert.routes.ts` - API routes and validation
- `src/controllers/alert.controller.ts` - Alert CRUD operations
- `src/services/alert-matching.service.ts` - Match finding logic
- `src/services/alert-cron.service.ts` - Scheduled processing
- `src/services/alert-notification.service.ts` - Email notifications
- `src/middleware/auth.ts` - JWT verification with JWK resolution
- `src/config/environment.ts` - Added CLERK_PUBLISHABLE_KEY

### Frontend Files
- `app/alerts/page.tsx` - Alert dashboard
- `app/alerts/new/page.tsx` - Alert creation form
- `app/alerts/[id]/matches/page.tsx` - Alert matches view
- `app/cruises/CruisesContent.tsx` - Entry point (button hidden)
- `middleware.ts` - Public route configuration

### Configuration
- Backend environment variables (Clerk keys)
- Frontend environment variables (Clerk keys)
- Render cron job configuration (if created)

---

## Commit History

Key commits related to this feature:

```
cd1efb3 Add passenger fields to price alerts for Traveltek API pricing
214e6b8 Fix: Add Clerk publishable key for JWK resolution in JWT verification
5f6d922 Fix: Update backend auth to verify JWT tokens and protect alert routes
e04aa1e Fix: Add /alerts/new to public routes to allow unauthenticated access
ee68d76 Fix: Use branded LoginSignupModal for alert creation authentication
```

---

## Support & Maintenance

**Last Updated:** October 28, 2025  
**Last Updated By:** Claude (AI Assistant)  
**Next Review Date:** When Clerk auth is properly configured

For questions or issues, refer to:
- Clerk Documentation: https://clerk.com/docs
- Render Documentation: https://render.com/docs
- Resend Documentation: https://resend.com/docs
