# Price Alert Feature - Testing Checklist

## Environment
- **Staging Frontend**: https://zipsea-frontend-staging.onrender.com
- **Production Backend**: https://api.zipsea.com (already deployed)
- **Database**: Production database (migrations already applied)

## Pre-Testing Setup

1. Ensure staging frontend is deployed (check Render dashboard)
2. Verify backend API is running: https://api.zipsea.com/health
3. Have Clerk test account ready for authentication

## Test Cases

### 1. Alert Creation Flow (Public → Auth)

#### Test 1.1: Create Alert from /alerts/new
1. Go to https://zipsea-frontend-staging.onrender.com/alerts/new
2. **Expected**: Page loads with alert form
3. Fill in form:
   - Alert Name: Leave blank (should auto-generate)
   - Cruise Lines: Select "Royal Caribbean" 
   - Departure Months: Select "Jan 2025", "Feb 2025", "Mar 2025"
   - Max Budget: Enter "2000"
   - Cabin Types: Select "Interior" and "Oceanview"
4. Click "Create Alert"
5. **Expected**: Redirected to sign-in page with return URL
6. Sign in with Clerk account
7. **Expected**: Redirected back to alert creation, alert is saved
8. **Expected**: Redirected to /alerts/[id]/matches page

**Success Criteria**:
- ✅ Form loads correctly
- ✅ All filters work (multi-select)
- ✅ Sign-in redirect preserves form data
- ✅ Alert created successfully
- ✅ Redirected to matches page

#### Test 1.2: Create Alert from /cruises Page
1. Go to https://zipsea-frontend-staging.onrender.com/cruises
2. Select filters:
   - Cruise Line: Celebrity Cruises
   - Months: Apr 2025, May 2025
3. Scroll down sidebar
4. **Expected**: See "🔔 Create Price Alert" button
5. Click "Create Price Alert"
6. **Expected**: Redirected to /alerts/new with pre-populated filters
7. Verify Celebrity and Apr/May are pre-selected
8. Complete alert creation (budget $3000, all cabin types)
9. Sign in if needed
10. **Expected**: Alert created successfully

**Success Criteria**:
- ✅ Create Alert button visible in sidebar
- ✅ Filters pre-populate correctly
- ✅ Alert created with correct criteria

### 2. Alert Management

#### Test 2.1: View All Alerts
1. Go to https://zipsea-frontend-staging.onrender.com/alerts
2. **Expected**: Redirected to sign-in if not authenticated
3. Sign in
4. **Expected**: Dashboard shows all created alerts
5. Verify alert cards show:
   - Alert name
   - Budget
   - Cabin types
   - Last checked date
   - Last notified date
   - Active/Paused status
   - Result count

**Success Criteria**:
- ✅ Dashboard loads
- ✅ All alerts displayed correctly
- ✅ Proper formatting and styling

#### Test 2.2: Pause/Resume Alert
1. On /alerts dashboard
2. Find an active alert
3. Click "Pause Alert"
4. **Expected**: Status changes to "Paused"
5. **Expected**: Badge changes from green to gray
6. Click "Resume Alert"
7. **Expected**: Status changes back to "Active"

**Success Criteria**:
- ✅ Toggle works without page reload
- ✅ Status updates immediately
- ✅ Visual indicator changes correctly

#### Test 2.3: Delete Alert
1. On /alerts dashboard
2. Find an alert to delete
3. Click "Delete"
4. **Expected**: Confirmation dialog appears
5. Confirm deletion
6. **Expected**: Alert removed from list
7. **Expected**: No errors

**Success Criteria**:
- ✅ Confirmation prompt works
- ✅ Alert deleted successfully
- ✅ List updates immediately

### 3. View Matches

#### Test 3.1: View Alert Matches
1. On /alerts dashboard
2. Click "View Matches" on an alert
3. **Expected**: Navigate to /alerts/[id]/matches
4. **Expected**: See alert name and criteria at top
5. **Expected**: List of matching cruises displayed (or "No matches yet")

**Success Criteria**:
- ✅ Matches page loads
- ✅ Alert details displayed
- ✅ Cruise cards formatted correctly
- ✅ Green "Alert Match" badge shows cabin type and price

#### Test 3.2: Navigate to Cruise Details
1. On /alerts/[id]/matches page
2. Click on a cruise card
3. **Expected**: Navigate to cruise detail page
4. **Expected**: Can return to matches page

**Success Criteria**:
- ✅ Links work correctly
- ✅ Navigation smooth

### 4. API Integration Tests

#### Test 4.1: Check Backend Endpoints
Using browser console or Postman:

1. **GET /api/v1/alerts** (with auth token)
   - Should return user's alerts array
   
2. **POST /api/v1/alerts** (with auth token)
   ```json
   {
     "name": "Test Alert",
     "searchCriteria": {
       "cruiseLineId": [22],
       "departureMonth": ["2025-01"]
     },
     "maxBudget": 1500,
     "cabinTypes": ["interior"]
   }
   ```
   - Should return created alert object

3. **GET /api/v1/alerts/:id/matches** (with auth token)
   - Should return array of matching cruises

4. **PUT /api/v1/alerts/:id** (with auth token)
   ```json
   {
     "alertEnabled": false
   }
   ```
   - Should update alert

5. **DELETE /api/v1/alerts/:id** (with auth token)
   - Should delete alert

**Success Criteria**:
- ✅ All endpoints return 200/201
- ✅ Data structure correct
- ✅ Auth validation working

### 5. Error Handling

#### Test 5.1: Invalid Form Submission
1. Go to /alerts/new
2. Leave required fields empty
3. Click "Create Alert"
4. **Expected**: Error message displayed
5. **Expected**: No API call made

**Success Criteria**:
- ✅ Validation errors shown
- ✅ User can correct and resubmit

#### Test 5.2: Unauthorized Access
1. Sign out
2. Try to access /alerts directly
3. **Expected**: Redirected to sign-in
4. Try to access /alerts/[id]/matches
5. **Expected**: Redirected to sign-in

**Success Criteria**:
- ✅ Auth protection working
- ✅ Redirect URLs preserve destination

### 6. Email Testing (Manual Backend Test)

#### Test 6.1: Trigger Manual Alert Processing
Using backend API:

```bash
curl -X POST https://api.zipsea.com/api/v1/alerts/:alertId/process \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected**:
- Alert processing runs
- If matches found, email sent
- Check email for:
  - Correct alert name
  - Matching cruises listed
  - OBC green boxes displayed
  - Links work (cruise details, alert dashboard)

**Success Criteria**:
- ✅ Email received
- ✅ Formatting matches quote emails
- ✅ All links functional
- ✅ OBC calculation correct (20% of price)

### 7. Performance & UX

#### Test 7.1: Loading States
1. Check all pages show loading indicators
2. Verify smooth transitions
3. No layout shifts

#### Test 7.2: Mobile Responsiveness
1. Test on mobile viewport
2. All buttons accessible
3. Forms usable
4. Cards stack properly

#### Test 7.3: Error Recovery
1. Disconnect internet
2. Try to create alert
3. **Expected**: Graceful error message
4. Reconnect
5. **Expected**: Can retry

## Known Issues / Limitations

- [ ] Auto-generated alert names might need refinement
- [ ] No region filter in alert form yet (optional feature)
- [ ] Email templates need final review
- [ ] Cron job runs at 9 AM UTC only (not configurable yet)

## Post-Testing Actions

After successful testing:
1. ✅ Mark feature as ready for user testing
2. ✅ Document any bugs found
3. ✅ Update production deployment plan
4. ⚠️ DO NOT deploy frontend to production yet (staging only)
5. ✅ Backend already in production (safe to use)

## Test Results

| Test Case | Status | Notes |
|-----------|--------|-------|
| 1.1 Alert Creation | ⏳ Pending | |
| 1.2 Create from Cruises | ⏳ Pending | |
| 2.1 View Alerts | ⏳ Pending | |
| 2.2 Pause/Resume | ⏳ Pending | |
| 2.3 Delete Alert | ⏳ Pending | |
| 3.1 View Matches | ⏳ Pending | |
| 3.2 Cruise Navigation | ⏳ Pending | |
| 4.1 API Endpoints | ⏳ Pending | |
| 5.1 Form Validation | ⏳ Pending | |
| 5.2 Auth Protection | ⏳ Pending | |
| 6.1 Email Testing | ⏳ Pending | |
| 7.1 Loading States | ⏳ Pending | |
| 7.2 Mobile Responsive | ⏳ Pending | |
| 7.3 Error Recovery | ⏳ Pending | |

## Contact
Questions or issues during testing? Check backend logs in Render dashboard.
