# Postman Testing Guide - Live Booking API

**Last Updated:** October 17, 2025  
**Environment:** Staging  
**Base URL:** `https://zipsea-backend.onrender.com/api/v1`

---

## Quick Start

### Prerequisites
- Postman installed
- Staging backend deployed with Traveltek credentials
- Valid cruise ID from the database

### Test Flow Overview
```
1. Create Session → Get sessionId
2. Get Cabin Pricing → Get resultNo, gradeNo, rateCode
3. Select Cabin → Confirm basket
4. Get Basket → Verify contents
5. (Optional) Create Booking → Full booking test
```

---

## Step 1: Create Booking Session

**Purpose:** Start a new booking session with passenger counts

**Endpoint:** `POST {{baseUrl}}/booking/session`

**Request Body:**
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

**With Children Example:**
```json
{
  "cruiseId": "22-2025-12-15-1234",
  "passengerCount": {
    "adults": 2,
    "children": 2,
    "childAges": [8, 12]
  }
}
```

**Expected Response (201 Created):**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "expiresAt": "2025-10-17T18:30:00.000Z",
  "passengerCount": {
    "adults": 2,
    "children": 0,
    "childAges": []
  }
}
```

**Save for Later Steps:**
- ✅ Copy `sessionId` - You'll need this for all subsequent requests
- ✅ Note the `expiresAt` time (2 hours from now)

**Common Errors:**
- `400`: Missing cruiseId or passengerCount
- `500`: Failed to create Traveltek session (check API credentials)

---

## Step 2: Get Live Cabin Pricing

**Purpose:** Retrieve real-time pricing for all cabin grades

**Endpoint:** `GET {{baseUrl}}/booking/:sessionId/pricing?cruiseId=22-2025-12-15-1234`

**URL Parameters:**
- `sessionId`: The session ID from Step 1
- `cruiseId`: Query parameter with the cruise ID

**Example:**
```
GET https://zipsea-backend.onrender.com/api/v1/booking/550e8400-e29b-41d4-a716-446655440000/pricing?cruiseId=22-2025-12-15-1234
```

**Expected Response (200 OK):**
```json
{
  "errors": [],
  "results": [
    {
      "resultno": "1",
      "gradeno": "1",
      "ratecode": "BESTFARE",
      "cabincode": "4N",
      "cabintype": "Inside",
      "description": "Interior Stateroom",
      "prices": {
        "fare": 899.00,
        "taxes": 150.00,
        "ncf": 25.00,
        "gratuity": 140.00,
        "total": 1214.00
      },
      "availability": "available"
    },
    {
      "resultno": "2",
      "gradeno": "2",
      "ratecode": "BESTFARE",
      "cabincode": "2C",
      "cabintype": "Oceanview",
      "description": "Oceanview Stateroom",
      "prices": {
        "fare": 1099.00,
        "taxes": 150.00,
        "ncf": 25.00,
        "gratuity": 140.00,
        "total": 1414.00
      },
      "availability": "available"
    }
  ]
}
```

**Save for Later Steps:**
- ✅ Copy `resultno` from your preferred cabin (e.g., "1")
- ✅ Copy `gradeno` (e.g., "1")
- ✅ Copy `ratecode` (e.g., "BESTFARE")
- ✅ Note the `total` price

**Common Errors:**
- `400`: Missing cruiseId query parameter
- `401`: Session expired or invalid
- `404`: Cruise not found
- `500`: Traveltek API error (check credentials)

**Troubleshooting:**
If you get an empty `results` array:
- The cruise may not be available on Traveltek
- Try a different `cruiseId` (use Royal Caribbean or Celebrity only)
- Check if the cruise exists in the database: `GET /api/v1/cruises/:cruiseId`

---

## Step 3: Select Cabin and Add to Basket

**Purpose:** Choose a specific cabin grade and add it to the booking basket

**Endpoint:** `POST {{baseUrl}}/booking/:sessionId/select-cabin`

**URL Parameters:**
- `sessionId`: The session ID from Step 1

**Request Body:**
```json
{
  "resultNo": "1",
  "gradeNo": "1",
  "rateCode": "BESTFARE",
  "cabinResult": null
}
```

**Note:** Use the exact values from Step 2's pricing response. `cabinResult` is optional (for specific cabin numbers).

**Expected Response (200 OK):**
```json
{
  "basketitems": [
    {
      "itemkey": "ITEM-123456",
      "type": "cruise",
      "totalprice": 2428.00,
      "cruisedetail": {
        "cruiseid": "22-2025-12-15-1234",
        "diningcodes": ["FD", "SD", "MT"],
        "cabin": "4N",
        "grade": "Interior Stateroom"
      }
    }
  ],
  "totalprice": 2428.00,
  "totaldeposit": 500.00,
  "duedate": "2025-11-15"
}
```

**Save for Later Steps:**
- ✅ Note `itemkey` (confirms cabin is reserved)
- ✅ Note `diningcodes` (you'll need one for booking)
- ✅ Note `totalprice` and `totaldeposit`

**Common Errors:**
- `400`: Missing required fields (resultNo, gradeNo, rateCode)
- `401`: Session expired
- `500`: Cabin no longer available / Traveltek basket error

**Important:** Cabin is now on hold in Traveltek's system (typically held for ~15 minutes)

---

## Step 4: Get Basket Contents

**Purpose:** Verify the basket and get dining options

**Endpoint:** `GET {{baseUrl}}/booking/:sessionId/basket`

**URL Parameters:**
- `sessionId`: The session ID from Step 1

**Example:**
```
GET https://zipsea-backend.onrender.com/api/v1/booking/550e8400-e29b-41d4-a716-446655440000/basket
```

**Expected Response (200 OK):**
Same as Step 3 response - confirms basket contents

**Common Errors:**
- `401`: Session expired
- `500`: Basket error

---

## Step 5: Create Booking (Full Test - Optional)

**⚠️ WARNING:** This will create a REAL booking with Traveltek and charge a real card. Only proceed if you're ready to complete a test booking that you'll need to cancel with Royal Caribbean.

**Endpoint:** `POST {{baseUrl}}/booking/:sessionId/create`

**URL Parameters:**
- `sessionId`: The session ID from Step 1

**Request Body:**
```json
{
  "passengers": [
    {
      "passengerNumber": 1,
      "passengerType": "adult",
      "firstName": "Test",
      "lastName": "Passenger",
      "dateOfBirth": "1980-01-15",
      "gender": "M",
      "citizenship": "US",
      "email": "test@zipsea.com",
      "phone": "555-1234",
      "isLeadPassenger": true
    },
    {
      "passengerNumber": 2,
      "passengerType": "adult",
      "firstName": "Jane",
      "lastName": "Passenger",
      "dateOfBirth": "1982-05-20",
      "gender": "F",
      "citizenship": "US",
      "isLeadPassenger": false
    }
  ],
  "contact": {
    "firstName": "Test",
    "lastName": "Passenger",
    "email": "test@zipsea.com",
    "phone": "555-1234",
    "address": "123 Main St",
    "city": "Miami",
    "state": "FL",
    "postalCode": "33101",
    "country": "US"
  },
  "payment": {
    "cardNumber": "4111111111111111",
    "expiryMonth": "12",
    "expiryYear": "2027",
    "cvv": "123",
    "cardholderName": "Test Passenger",
    "amount": 500.00,
    "paymentType": "deposit"
  },
  "dining": "MT"
}
```

**Note on Payment:**
- Use the `totaldeposit` from Step 3 as the `amount`
- `dining` must be one of the codes from Step 3 (e.g., "MT", "FD", "SD")
- Card number `4111111111111111` is a test card (if Traveltek accepts test cards in staging)

**Expected Response (201 Created):**
```json
{
  "bookingId": "uuid-generated-by-our-system",
  "traveltekBookingId": "TRV-789012",
  "status": "confirmed",
  "totalAmount": 2428.00,
  "depositAmount": 500.00,
  "paidAmount": 500.00,
  "balanceDueDate": "2025-11-15",
  "confirmationNumber": "RCL-12345-ABCD",
  "bookingDetails": {
    "portfolioid": "PORT-456789",
    "passengers": [...],
    ...
  }
}
```

**Save for Later:**
- ✅ Copy `traveltekBookingId` (to cancel with Royal Caribbean)
- ✅ Copy `confirmationNumber`

**Common Errors:**
- `400`: Missing required fields / Passenger count mismatch
- `401`: Session expired
- `500`: Payment declined / Booking failed

**After Test Booking:**
1. ✅ Verify booking in our database: `GET /api/v1/booking/:bookingId` (requires auth)
2. ✅ Contact Royal Caribbean to cancel: Reference `traveltekBookingId`
3. ✅ Check for confirmation email

---

## Getting Valid Cruise IDs

**Endpoint:** `GET {{baseUrl}}/search?cruiseLine=22&startDate=2025-12-01&endDate=2026-03-31`

**Purpose:** Find Royal Caribbean cruises to test with

**Parameters:**
- `cruiseLine=22` (Royal Caribbean)
- `cruiseLine=3` (Celebrity)
- `startDate=2025-12-01` (future date)
- `endDate=2026-03-31` (3-4 months out)

**Expected Response:**
```json
{
  "cruises": [
    {
      "id": "22-2025-12-15-1234",
      "name": "Caribbean Explorer",
      "cruiseLineName": "Royal Caribbean",
      "shipName": "Symphony of the Seas",
      "sailingDate": "2025-12-15",
      ...
    }
  ]
}
```

**Select a Cruise:**
- ✅ Look for `cruiseLineName: "Royal Caribbean"` or `"Celebrity Cruises"`
- ✅ Choose a cruise 2-3 months in the future
- ✅ Copy the `id` field (e.g., "22-2025-12-15-1234")

---

## Postman Collection Setup

### Environment Variables

Create a Postman environment called "Zipsea Staging" with these variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `baseUrl` | `https://zipsea-backend.onrender.com/api/v1` | Staging API base URL |
| `sessionId` | *(set after Step 1)* | Current booking session |
| `cruiseId` | `22-2025-12-15-1234` | Test cruise ID |
| `resultNo` | *(set after Step 2)* | From pricing response |
| `gradeNo` | *(set after Step 2)* | From pricing response |
| `rateCode` | *(set after Step 2)* | From pricing response |
| `authToken` | *(optional)* | Clerk JWT for authenticated routes |

### Collection Structure

```
📁 Zipsea Live Booking
├── 📂 1. Session Management
│   ├── Create Session (POST)
│   └── Get Session (GET)
├── 📂 2. Cabin Selection
│   ├── Get Cabin Pricing (GET)
│   ├── Select Cabin (POST)
│   └── Get Basket (GET)
├── 📂 3. Booking (Authenticated)
│   ├── Create Booking (POST)
│   ├── Get Booking (GET)
│   └── Cancel Booking (POST)
└── 📂 Helper Endpoints
    └── Search Cruises (GET)
```

---

## Testing Checklist

### Basic Flow (No Booking Creation)
- [ ] **Step 1:** Create session → Get `sessionId`
- [ ] **Step 2:** Get pricing → Get `resultNo`, `gradeNo`, `rateCode`
- [ ] **Step 3:** Select cabin → Verify basket
- [ ] **Step 4:** Get basket → Confirm contents
- [ ] ✅ **Verify:** Session persists across calls
- [ ] ✅ **Verify:** Traveltek API responds correctly
- [ ] ✅ **Verify:** No server errors

### Session Expiry Test
- [ ] Create session
- [ ] Wait 10 minutes
- [ ] Try to get pricing (should still work within 2 hours)
- [ ] Check session in database

### Error Handling Test
- [ ] Try creating session without `cruiseId` → Expect 400
- [ ] Try getting pricing with invalid `sessionId` → Expect 401
- [ ] Try selecting cabin without required fields → Expect 400
- [ ] Try using expired session → Expect 401

### Authentication Test (If you have Clerk access)
- [ ] Get Clerk JWT token
- [ ] Add `Authorization: Bearer <token>` header
- [ ] Test authenticated endpoints

---

## Common Issues & Solutions

### Issue: "Failed to create Traveltek session"
**Cause:** API credentials not set or incorrect  
**Solution:**
1. Check Render environment variables:
   - `TRAVELTEK_API_USERNAME=cruisepassjson`
   - `TRAVELTEK_API_PASSWORD=cr11fd75`
2. Restart staging backend service
3. Check backend logs for auth errors

### Issue: "Cruise not found"
**Cause:** Using a cruise ID that doesn't exist or isn't in database  
**Solution:**
1. Use the search endpoint to get valid cruise IDs
2. Only use Royal Caribbean (22) or Celebrity (3) cruises
3. Check database: `SELECT id FROM cruises WHERE cruise_line_id IN (22, 3) LIMIT 10;`

### Issue: Empty pricing results
**Cause:** Cruise not available on Traveltek or outside booking window  
**Solution:**
1. Try a different cruise (2-3 months in future)
2. Verify cruise exists on Royal Caribbean website
3. Check if cruise is for sale (not past departure date)

### Issue: "Session expired" immediately
**Cause:** Redis connection issues or wrong session ID  
**Solution:**
1. Check Redis is running (on Render or locally)
2. Verify `REDIS_URL` environment variable
3. Check backend logs for Redis errors

### Issue: Basket returns empty after selecting cabin
**Cause:** Cabin selection may have failed silently  
**Solution:**
1. Check Step 3 response for errors
2. Try selecting a different cabin grade
3. Verify the pricing response had available cabins

---

## Success Criteria

Your testing is successful when:

✅ **Step 1-4 complete without errors**  
✅ **Pricing data returns from Traveltek**  
✅ **Cabin successfully added to basket**  
✅ **Basket persists across requests**  
✅ **Session doesn't expire prematurely**  
✅ **All error cases handled gracefully**  

---

## Next Steps After Successful Testing

Once Steps 1-4 work reliably:

1. **Test with different cruise lines**
   - Try Celebrity Cruises (cruiseLine=3)
   - Try different cabin types (Interior, Oceanview, Balcony, Suite)

2. **Test with children**
   - Create session with `children: 2, childAges: [8, 12]`
   - Verify pricing includes children

3. **(Optional) Complete full booking**
   - Use refundable rate
   - Cancel immediately with Royal Caribbean
   - Verify booking stored in database

4. **Begin frontend implementation**
   - Passenger selector component
   - Cabin selection UI
   - Booking flow pages

---

## Support

If you encounter issues:
1. Check backend logs on Render
2. Verify environment variables are set
3. Review `/documentation/TRAVELTEK-LIVE-BOOKING-API.md`
4. Check journal entries for previous solutions

---

**Last Updated:** October 17, 2025  
**Tested By:** Pending  
**Test Status:** Ready for testing
