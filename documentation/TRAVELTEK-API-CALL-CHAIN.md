# Traveltek API Call Chain - Current Implementation

**Date:** October 23, 2025  
**Status:** In Development - Step 3 Complete, Investigating Zero Pricing Issue

---

## Overview

This document traces the exact Traveltek API calls we're making in our booking flow, in the order they're executed.

---

## Complete API Call Chain

### **STEP 1: Authentication & Session Creation**

#### 1.1 Frontend: User clicks "Book Now" on a cruise
- **Frontend Endpoint:** `POST /api/v1/booking/session`
- **Request Body:**
  ```json
  {
    "cruiseId": "22-2025-12-15-1234",
    "passengerCount": {
      "adults": 2,
      "children": 0,
      "childAges": []
    }
  }
  ```

#### 1.2 Backend: Get OAuth Token
- **Traveltek API:** `POST /token.pl`
- **Method:** `traveltekApiService.getAccessToken()`
- **Location:** `backend/src/services/traveltek-api.service.ts:185-210`
- **Headers:**
  ```
  Authorization: Basic Y3J1aXNlcGFzc2pzb246Y3IxMWZkNzU=
  Content-Type: application/x-www-form-urlencoded
  ```
- **Body:**
  ```
  grant_type=client_credentials&scope=portal
  ```
- **Response:**
  ```json
  {
    "access_token": "eyJhbGc...",
    "token_type": "bearer",
    "expires_in": 3600
  }
  ```
- **Cached:** Yes, in Redis with 55-minute TTL

#### 1.3 Backend: Initialize Traveltek Session (via cruise search)
- **Traveltek API:** `GET /cruiseresults.pl`
- **Method:** `traveltekApiService.getCruiseById()`
- **Location:** `backend/src/services/traveltek-api.service.ts:327-372`
- **Parameters:**
  ```
  requestid={access_token}
  codetocruiseid={cruiseId}
  adults={adults}
  children={children}
  ```
- **Response:**
  ```json
  {
    "sessionkey": "AB12CD34-EF56-GH78-IJ90-KL12MN34OP56",
    "sid": "default",
    "results": [
      {
        "resultno": "1",
        "cruiseid": "22-2025-12-15-1234",
        // ... cruise data
      }
    ]
  }
  ```
- **Key Data Extracted:**
  - `sessionkey` - Stored in Redis session
  - `sid` - Stored in Redis session
- **Cached:** Session stored in Redis with 2-hour TTL

#### 1.4 Backend: Return Session ID to Frontend
- **Response:**
  ```json
  {
    "sessionId": "uuid-generated-by-us",
    "expiresAt": "2025-10-23T21:00:00Z",
    "passengerCount": { "adults": 2, "children": 0 }
  }
  ```

---

### **STEP 2: Get Live Cabin Pricing**

#### 2.1 Frontend: User on cabin selection page
- **Frontend Endpoint:** `GET /api/v1/booking/{sessionId}/pricing?cruiseId={cruiseId}`

#### 2.2 Backend: Get Live Cabin Grades
- **Traveltek API:** `GET /cruisecabingrades.pl`
- **Method:** `traveltekApiService.getCabinGrades()`
- **Location:** `backend/src/services/traveltek-api.service.ts:374-428`
- **Parameters:**
  ```
  requestid={access_token}
  sessionkey={sessionkey}
  sid={sid}
  type=cruise
  codetocruiseid={cruiseId}
  adults={adults}
  children={children}
  paxtype-1=child&dob-1=2015-06-15  (if children > 0)
  ```
- **Response:**
  ```json
  {
    "results": [
      {
        "resultno": "201",
        "gradeno": "201:DM996596:5",
        "ratecode": "DM996596",
        "cabincode": "4N",
        "cabintype": "Inside",
        "description": "Interior Stateroom",
        "price": 2380,
        "gridpricing": [
          {
            "ratecode": "DM996596",
            "description": "Best Rate",
            "cruiseinside": 2380,
            "cruiseoutside": 2831,
            "cruisebalcony": 2866,
            "cruisesuite": 4336
          }
        ]
      }
    ]
  }
  ```
- **Key Data:** Live pricing with `resultno`, `gradeno`, `ratecode` needed for next step
- **Cached:** Yes, in Redis for 5 minutes per cruise

---

### **STEP 3: Select Cabin & Add to Basket**

#### 3.1 Frontend: User clicks "Reserve" on a cabin
- **Frontend Endpoint:** `POST /api/v1/booking/{sessionId}/select-cabin`
- **Request Body:**
  ```json
  {
    "resultNo": "201",
    "gradeNo": "201:DM996596:5",
    "rateCode": "DM996596",
    "cabinResult": null  // null for guaranteed, set for specific cabin
  }
  ```

#### 3.2 Backend: Refresh Pricing (Critical Step)
- **Traveltek API:** `GET /cruisecabingrades.pl` (AGAIN!)
- **Method:** `traveltekApiService.getCabinGrades()`
- **Location:** `backend/src/services/traveltek-booking.service.ts:461-484`
- **Why:** Per Traveltek docs: "The price of a cruise will be up-to-date once you retrieve it using the cabingrades endpoint"
- **Purpose:** Prevents basket from showing `price: 0` due to stale pricing
- **Same Parameters as Step 2.2**

#### 3.3 Backend: Add Cabin to Basket
- **Traveltek API:** `GET /basketadd.pl`
- **Method:** `traveltekApiService.addToBasket()`
- **Location:** `backend/src/services/traveltek-api.service.ts:540-592`
- **Parameters:**
  ```
  sessionkey={sessionkey}
  requestid={access_token}
  type=cruise
  resultno=201
  gradeno=201:DM996596:5
  ratecode=DM996596
  resultkey=default
  cabinresult={cabinResult}  (optional - for specific cabin)
  cabinno={cabinNo}  (optional - for specific cabin number)
  ```

#### 3.4 Current Issue: Response Has Zero Pricing
- **Actual Response:**
  ```json
  {
    "results": [
      {
        "basketitems": [
          {
            "itemkey": "1398110114",
            "type": "cruise",
            "price": 0,  // ❌ ZERO!
            "searchprice": 2380,  // ✅ Has original price
            "paymentoption": "none",  // ❌ SUSPICIOUS!
            "cruisedetail": {
              "cruiseid": "22-2025-12-15-1234",
              "price": 2380,  // ✅ Has price here too
              "cruiseinside": 2380,
              "cruiseoutside": 2831,
              "cruisebalcony": 2866,
              "cruisesuite": 4336
            }
          }
        ],
        "totalprice": 0,  // ❌ ZERO!
        "totaldeposit": 0  // ❌ ZERO!
      }
    ]
  }
  ```

#### 3.5 Backend: Store Basket in Session
- **Location:** `backend/src/services/traveltek-booking.service.ts:575-577`
- **Stored Data:**
  - Full `basketData` response (with zero pricing)
  - `itemkey` extracted from `basketData.results[0].basketitems[0].itemkey`

---

### **STEP 4: Get Basket (Retrieval)**

#### 4.1 Frontend: Navigate to pricing summary page
- **Frontend Endpoint:** `GET /api/v1/booking/{sessionId}/basket`

#### 4.2 Backend: First Try Live Basket
- **Traveltek API:** `GET /basket.pl`
- **Method:** `traveltekApiService.getBasket()`
- **Location:** `backend/src/services/traveltek-api.service.ts:594-634`
- **Parameters:**
  ```
  sessionkey={sessionkey}
  requestid={access_token}
  resultkey=default
  ```
- **Expected Response:**
  ```json
  {
    "results": [
      {
        "basketitems": [...],
        "totalprice": 2428.00,
        "totaldeposit": 500.00
      }
    ]
  }
  ```

#### 4.3 Backend: Fallback to Cached Basket
- **Location:** `backend/src/services/traveltek-booking.service.ts:668-693`
- **Why:** Traveltek sometimes returns empty basket (race condition)
- **Fallback:** Returns cached `basketData` from session (stored in Step 3.5)
- **Current Problem:** Fallback returns zero pricing because that's what was cached

---

### **STEP 5: Create Booking (NOT YET IMPLEMENTED)**

#### 5.1 Frontend: User fills passenger details and submits
- **Frontend Endpoint:** `POST /api/v1/booking/{sessionId}/create`
- **Expected Request Body:**
  ```json
  {
    "passengers": [...],
    "contact": {...},
    "payment": {...},
    "dining": "MT"
  }
  ```

#### 5.2 Backend: Create Booking with Traveltek
- **Traveltek API:** `POST /book.pl`
- **Method:** `traveltekApiService.createBooking()`
- **Location:** `backend/src/services/traveltek-api.service.ts:636-796`
- **Headers:**
  ```
  requestid: {access_token}
  Content-Type: application/x-www-form-urlencoded
  ```
- **Body (URL-encoded):**
  ```
  sessionkey={sessionkey}
  &sid={sid}
  &itemkey={itemkey}  // From basket response
  &contact[firstname]=John
  &contact[lastname]=Doe
  &contact[email]=john@example.com
  &contact[telephone]=555-1234
  &contact[address1]=123 Main St
  &contact[city]=Miami
  &contact[postcode]=33101
  &contact[country]=US
  &pax-1[firstname]=John
  &pax-1[lastname]=Doe
  &pax-1[dob]=1980-01-15
  &pax-1[gender]=M
  &pax-1[paxtype]=adult
  &dining=MT
  ```
- **Expected Response:**
  ```json
  {
    "bookingid": "14405244",
    "portfolioid": "PORT-456789",
    "status": "Confirmed",
    "totalcost": 2428.00,
    "totaldeposit": 500.00
  }
  ```

---

### **STEP 6: Process Payment (NOT YET IMPLEMENTED)**

#### 6.1 Backend: Process Payment
- **Traveltek API:** `POST /payment.pl`
- **Method:** `traveltekApiService.processPayment()`
- **Location:** `backend/src/services/traveltek-api.service.ts:798-853`
- **Headers:**
  ```
  requestid: {access_token}
  Content-Type: application/x-www-form-urlencoded
  ```
- **Body (URL-encoded):**
  ```
  sessionkey={sessionkey}
  &cardtype=VIS
  &cardnumber=4111111111111111
  &expirymonth=12
  &expiryyear=2027
  &nameoncard=John Doe
  &cvv=123
  &amount=500.00
  &address1=123 Main St
  &city=Miami
  &postcode=33101
  &country=US
  ```
- **Expected Response:**
  ```json
  {
    "status": "success",
    "transactionid": "TXN-987654",
    "amount": 500.00,
    "approval": "APPROVED"
  }
  ```

---

## Current Problem Analysis

### What's Working ✅
1. **Authentication** - OAuth token retrieved successfully
2. **Session Creation** - Traveltek sessionkey and sid obtained
3. **Live Pricing** - getCabinGrades returns correct pricing ($2380)
4. **Basket Addition** - addToBasket succeeds (no errors)
5. **Basket Retrieval** - getBasket endpoint working with fallback

### What's Broken ❌
1. **Basket Pricing** - addToBasket returns `price: 0`, `totalprice: 0`, `totaldeposit: 0`
2. **Payment Option** - Basket item has `paymentoption: "none"` instead of a valid option

### Root Cause Hypotheses

#### Hypothesis 1: Missing Parameter in addToBasket
- **Evidence:** `paymentoption: "none"` suggests we might need to specify a payment option
- **Investigation Needed:** Check if getCabinGrades response includes a `paymentoption` field we should pass to addToBasket
- **Status:** Added logging to check getCabinGrades response (commit 76ae4bd, 1195fc2)

#### Hypothesis 2: Traveltek Fraud Detection (From Journal)
- **Evidence:** Previous journal entry showed bookings failing with:
  - `fraudcategory: "Yellow"`
  - `status: "Failed"`
  - `totalprice: 0`
- **However:** That was at booking stage, not basket stage
- **Status:** Less likely but possible

#### Hypothesis 3: Missing getCabinGrades Call
- **Evidence:** We ARE calling getCabinGrades before addToBasket (Step 3.2)
- **Status:** ❌ Not the issue

#### Hypothesis 4: Wrong Parameter Format
- **Evidence:** We're sending:
  - `resultno: "201"` (from pricing response)
  - `gradeno: "201:DM996596:5"` (from pricing response)
  - `ratecode: "DM996596"` (from pricing response)
- **These match the docs and getCabinGrades response**
- **Status:** Parameters appear correct

#### Hypothesis 5: API Call Chain Break
- **Evidence:** Checking the chain:
  1. ✅ token.pl → Get OAuth token
  2. ✅ cruiseresults.pl → Get sessionkey + sid
  3. ✅ cruisecabingrades.pl → Get fresh pricing
  4. ❌ basketadd.pl → Returns zero pricing
- **The chain is NOT broken - all calls succeed**
- **But:** basketadd.pl is receiving data but not calculating pricing

---

## Missing API Calls (Potential Issues)

### Are We Missing Any Traveltek Endpoints?

Looking at Traveltek docs from `TRAVELTEK-LIVE-BOOKING-API.md`:

1. **cruiseresults.pl** - ✅ Used in Step 1.3
2. **cruisecabingrades.pl** - ✅ Used in Step 2.2 and 3.2
3. **cruisecabins.pl** - ⚠️ Used only for specific cabin selection (not guaranteed)
4. **basketadd.pl** - ✅ Used in Step 3.3
5. **basket.pl** - ✅ Used in Step 4.2
6. **book.pl** - ⏳ Not yet reached (Step 5)
7. **payment.pl** - ⏳ Not yet reached (Step 6)

**Conclusion:** We're not missing any API calls for guaranteed cabin selection up to Step 3.

---

## Next Steps

### Immediate Investigation
1. **✅ DONE:** Added logging to see getCabinGrades response before addToBasket
2. **⏳ WAITING:** User to test and provide logs
3. **TODO:** Analyze getCabinGrades response for `paymentoption` or other pricing fields
4. **TODO:** Check if we need to pass additional parameters to addToBasket

### If Logging Shows Missing Parameter
- Extract the parameter from getCabinGrades response
- Pass it to addToBasket
- Test if pricing is calculated correctly

### If Logging Shows No Additional Fields
- Contact Traveltek support
- Ask about `paymentoption: "none"` and zero pricing
- Verify account configuration for live bookings

---

## Code Locations

### Controllers
- **booking.controller.ts** - HTTP request handlers
  - `createSession()` - Step 1.1-1.4
  - `getCabinPricing()` - Step 2.1-2.2
  - `selectCabin()` - Step 3.1-3.5
  - `getBasket()` - Step 4.1-4.3

### Services
- **traveltek-api.service.ts** - Direct Traveltek API calls
  - `getAccessToken()` - Step 1.2
  - `getCruiseById()` - Step 1.3
  - `getCabinGrades()` - Steps 2.2, 3.2
  - `addToBasket()` - Step 3.3
  - `getBasket()` - Step 4.2
  
- **traveltek-booking.service.ts** - Business logic
  - `getCabinPricing()` - Coordinates Steps 2.2 + caching
  - `selectCabin()` - Coordinates Steps 3.2-3.5
  - `getBasket()` - Coordinates Step 4.2-4.3 + fallback

- **traveltek-session.service.ts** - Session management
  - `createSession()` - Step 1.4
  - `getSession()` - Used in all steps
  - `updateSession()` - Step 3.5

---

**Last Updated:** October 23, 2025  
**Author:** Claude Code Analysis  
**Related Issues:** Zero pricing in basket (#current)
