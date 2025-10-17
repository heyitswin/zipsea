# Traveltek Fusion API - Live Booking Integration Guide

**Version:** 1.0  
**Date:** October 17, 2025  
**Integration:** Zipsea Live Booking System

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Session Management](#session-management)
4. [Booking Flow](#booking-flow)
5. [API Endpoints](#api-endpoints)
6. [Error Handling](#error-handling)
7. [Testing Guide](#testing-guide)
8. [Security Considerations](#security-considerations)

---

## Overview

### Purpose
The Traveltek Fusion API enables live cruise booking for Royal Caribbean and Celebrity Cruises. This document covers the complete integration for the Zipsea platform.

### API Details
- **Base URL:** `https://fusionapi.traveltek.net/2.1/json`
- **Protocol:** HTTPS only
- **Format:** JSON
- **Authentication:** OAuth 2.0 Client Credentials
- **Session Duration:** 2 hours

### Supported Cruise Lines
- **Royal Caribbean** - Line ID: 22
- **Celebrity Cruises** - Line ID: 3

### Credentials
```
Username: cruisepassjson
Password: cr11fd75
```

**⚠️ IMPORTANT:** Store credentials in environment variables, never commit to code.

---

## Authentication

### OAuth 2.0 Flow

#### Step 1: Request Access Token

**Endpoint:** `POST /token.pl`

**Headers:**
```http
Authorization: Basic Y3J1aXNlcGFzc2pzb246Y3IxMWZkNzU=
Content-Type: application/x-www-form-urlencoded
```

**Note:** The Authorization header is Base64 encoded: `base64(username:password)`

**Body:**
```
grant_type=client_credentials&scope=portal
```

**Request Example:**
```bash
curl -X POST https://fusionapi.traveltek.net/2.1/json/token.pl \
  -H "Authorization: Basic Y3J1aXNlcGFzc2pzb246Y3IxMWZkNzU=" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&scope=portal"
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

#### Step 2: Use Access Token

All subsequent API requests require the `access_token` as `requestid` parameter:

**GET requests:**
```
?requestid=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**POST requests:**
```http
requestid: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Management

**Token Expiry:**
- Tokens expire after `expires_in` seconds (typically 3600 = 1 hour)
- Request new token before expiration
- Expired tokens return 401 Unauthorized

**Best Practices:**
- Store token in Redis with TTL matching `expires_in`
- Auto-refresh tokens 5 minutes before expiry
- Handle 401 errors by requesting new token

---

## Session Management

### Session Keys

After obtaining an access token, the API maintains stateful sessions using a `sessionkey` identifier.

**Session Properties:**
- **Duration:** Valid for at least 2 hours
- **Format:** UUID (e.g., `AB12CD34-EF56-GH78-IJ90-KL12MN34OP56`)
- **Generated:** First API call (e.g., cruise search)
- **Persistence:** Required for all subsequent calls in booking flow

### SID (Search ID)

The `sid` parameter defines enabled suppliers and credentials.

**Format:** String identifier from initial search
**Usage:** Pass through entire booking flow
**Example:** `sid=ABC123DEF456`

### Session Storage Strategy (Recommended)

**Backend Session Store (Redis):**
```typescript
interface BookingSession {
  id: string; // Our UUID
  traveltekSessionKey: string; // Traveltek sessionkey
  traveltekSid: string; // Traveltek sid
  traveltekAccessToken: string; // OAuth token
  cruiseId: string;
  passengerCount: {
    adults: number;
    children: number;
    childAges: number[];
  };
  expiresAt: Date; // 2 hours from creation
  createdAt: Date;
}
```

**Storage Pattern:**
1. User starts booking → Backend requests token
2. Backend stores token in Redis (TTL: 1 hour)
3. Backend creates booking session in Redis (TTL: 2 hours)
4. Frontend gets `bookingSessionId` (our UUID)
5. Backend maps `bookingSessionId` → Traveltek session data
6. Auto-refresh token before expiry

---

## Booking Flow

### Complete Booking Journey

```
1. Authentication → Get OAuth token
2. Create Session → Get sessionkey and sid
3. Search Cruises → Find cruise by ID
4. Get Cabin Grades → Live pricing and availability
5. Select Cabin → Choose specific cabin (optional)
6. Add to Basket → Hold cabin reservation
7. Create Booking → Submit passenger details
8. Process Payment → Complete transaction
9. Confirmation → Booking confirmed
```

### Detailed Flow

#### 1. Authentication
```typescript
// Get OAuth token (backend only)
const token = await getAccessToken();
// Store in Redis with 1hr TTL
```

#### 2. Create Session (via Cruise Search)
```http
GET /cruiseresults.pl?requestid={token}&startdate=2025-12-01&enddate=2025-12-31&lineid=22,3&adults=2
```

**Response includes:**
- `sessionkey`: UUID for this session
- `sid`: Search ID
- Results array

**Store these for subsequent calls.**

#### 3. Get Cabin Grades
```http
POST /cabingrades.pl

Headers:
requestid: {access_token}

Body:
sessionkey={sessionkey}
&type=cruise
&codetocruiseid={cruise_id}
&adults=2
&children=0
```

**Response:**
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
    }
  ]
}
```

#### 4. Get Specific Cabins (Optional)
```http
POST /cruisecabins.pl

Body:
sessionkey={sessionkey}
&resultno={resultno_from_cabin_grades}
&gradeno={gradeno}
&ratecode={ratecode}
&requestid={access_token}
&sid={sid}
```

**Response:**
```json
{
  "results": [
    {
      "resultno": "1",
      "cabinno": "7001",
      "deck": "7",
      "position": "Forward",
      "features": ["Bathroom", "TV"],
      "obstructed": false
    }
  ]
}
```

#### 5. Add to Basket
```http
GET /basketadd.pl?sessionkey={sessionkey}&type=cruise&resultno={resultno}&gradeno={gradeno}&ratecode={ratecode}&cabinresult={cabinno_resultno}&requestid={access_token}
```

**Response:**
```json
{
  "basketitems": [
    {
      "itemkey": "ITEM-123456",
      "type": "cruise",
      "totalprice": 2428.00,
      "cruisedetail": {
        "cruiseid": "22-2025-12-15-1234",
        "diningcodes": ["FD", "SD", "MT"]
      }
    }
  ],
  "totalprice": 2428.00,
  "totaldeposit": 500.00,
  "duedate": "2025-11-15"
}
```

**IMPORTANT:** Cabin is now on hold. Complete booking promptly.

#### 6. Create Booking
```http
POST /book.pl

Headers:
requestid: {access_token}

Body (URL-encoded):
sessionkey={sessionkey}
&sid={sid}
&contact[firstname]=John
&contact[lastname]=Doe
&contact[email]=john@example.com
&contact[telephone]=555-1234
&contact[address1]=123 Main St
&contact[city]=Miami
&contact[county]=FL
&contact[postcode]=33101
&contact[country]=US
&pax-1[firstname]=John
&pax-1[lastname]=Doe
&pax-1[dob]=1980-01-15
&pax-1[gender]=M
&pax-1[paxtype]=adult
&pax-1[age]=45
&pax-2[firstname]=Jane
&pax-2[lastname]=Doe
&pax-2[dob]=1982-05-20
&pax-2[gender]=F
&pax-2[paxtype]=adult
&pax-2[age]=43
&dining=MT
```

**Response:**
```json
{
  "bookingid": "TRV-789012",
  "portfolioid": "PORT-456789",
  "status": "Confirmed",
  "bookingdetails": {
    "confirmation": "RCL-12345-ABCD",
    "cruiseid": "22-2025-12-15-1234",
    "passengers": [...]
  }
}
```

#### 7. Process Payment
```http
POST /payment.pl

Headers:
requestid: {access_token}

Body:
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

**Response:**
```json
{
  "status": "success",
  "transactionid": "TXN-987654",
  "amount": 500.00,
  "approval": "APPROVED"
}
```

---

## API Endpoints Reference

### Authentication

#### POST /token.pl
Get OAuth access token

**Parameters:**
- `grant_type`: `client_credentials` (required)
- `scope`: `portal` (required)

**Headers:**
- `Authorization`: Basic Auth (username:password)
- `Content-Type`: `application/x-www-form-urlencoded`

**Response:** Access token with expiry

---

### Cruise Search

#### GET /cruiseresults.pl
Search for available cruises

**Parameters:**
- `requestid`: Access token (required)
- `startdate`: YYYY-MM-DD (required)
- `enddate`: YYYY-MM-DD (required)
- `lineid`: Comma-separated line IDs (optional, e.g., `22,3`)
- `adults`: Number of adults (default: 2)
- `children`: Number of children (default: 0)
- `shipid`: Comma-separated ship IDs (optional)
- `regionid`: Region ID (optional)
- `currency`: Currency code (optional, default: GBP)

**Response:** Cruise results with sessionkey and sid

---

### Cabin Pricing

#### POST /cabingrades.pl
Get live cabin grades and pricing

**Parameters:**
- `requestid`: Access token (required)
- `sessionkey`: Session UUID (required)
- `type`: Must be `cruise` (required)
- `codetocruiseid`: Cruise ID (required)
- `adults`: Number of adults (required)
- `children`: Number of children (optional)
- `paxtype-{n}`: `child` for each child (required if children > 0)
- `dob-{n}`: YYYY-MM-DD for each child (required if children > 0)

**Example with children:**
```
adults=2&children=2&paxtype-1=child&dob-1=2015-03-15&paxtype-2=child&dob-2=2017-08-22
```

**Response:** Cabin grades with pricing breakdown

---

### Specific Cabins

#### POST /cruisecabins.pl
Get specific cabin numbers and details

**Parameters:**
- `requestid`: Access token (required)
- `sessionkey`: Session UUID (required)
- `sid`: Search ID (required)
- `resultno`: Result number from cabin grades (required)
- `gradeno`: Grade number from cabin grades (required)
- `ratecode`: Rate code from cabin grades (required)

**Response:** List of available cabin numbers

---

### Basket Management

#### GET /basketadd.pl
Add cruise to basket

**Parameters:**
- `sessionkey`: Session UUID (required)
- `requestid`: Access token (required)
- `type`: `cruise` (required)
- `resultno`: Result number from cabin grades (required)
- `gradeno`: Grade number (required)
- `ratecode`: Rate code (required)
- `cabinresult`: Cabin result number (optional - for specific cabin)

**Response:** Updated basket with itemkey

#### GET /basket.pl
Retrieve current basket contents

**Parameters:**
- `sessionkey`: Session UUID (required)
- `requestid`: Access token (required)

**Response:** Basket items and totals

---

### Booking

#### POST /book.pl
Create booking with passenger details

**Parameters:**
- `sessionkey`: Session UUID (required)
- `requestid`: Access token (required)
- `sid`: Search ID (required)
- `contact[...]`: Booker contact details (required)
- `pax-{n}[...]`: Passenger details for each passenger (required)
- `dining`: Dining code from basket (required)

**Contact Fields:**
- `firstname`, `lastname`, `email`, `telephone`
- `address1`, `city`, `county`, `postcode`, `country`

**Passenger Fields:**
- `firstname`, `lastname`, `dob`, `gender`, `paxtype`, `age`
- Optional: `nationality`, `passport`, `emergency contact`

**Response:** Booking confirmation with booking ID

---

### Payment

#### POST /payment.pl
Process payment for booking

**Parameters:**
- `sessionkey`: Session UUID (required)
- `requestid`: Access token (required)
- `cardtype`: Card type code (required)
  - `VIS` - Visa
  - `MSC` - Mastercard
  - `AMX` - American Express
- `cardnumber`: Full card number (required)
- `expirymonth`: MM (required)
- `expiryyear`: YYYY (required)
- `nameoncard`: Cardholder name (required)
- `cvv`: CVV/CVC code (required)
- `amount`: Payment amount (required)
- Billing address fields (required)

**Response:** Transaction result with transaction ID

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response |
| 400 | Bad Request | Check parameters |
| 401 | Unauthorized | Request new token |
| 403 | Forbidden | Check credentials |
| 404 | Not Found | Check endpoint URL |
| 500 | Server Error | Retry with exponential backoff |

### API Error Response Format

```json
{
  "errors": [
    {
      "code": 169,
      "message": "Session has expired"
    }
  ]
}
```

### Common Error Codes

| Code | Message | Solution |
|------|---------|----------|
| 3000 | Invalid authentication token | Request new token |
| 3002 | Token expired | Request new token |
| 110 | Missing required parameter | Check API call parameters |
| 111 | Invalid parameter value | Validate input data |
| 169 | Session expired | Create new session |
| 152 | Item not found in basket | Re-add item to basket |

### Error Handling Strategy

**Token Errors (3000, 3002, 401):**
```typescript
async function apiCall(endpoint, params) {
  let response = await fetch(endpoint, params);
  
  if (response.status === 401 || response.data.errors?.some(e => [3000, 3002].includes(e.code))) {
    // Token expired - refresh
    const newToken = await getAccessToken();
    params.requestid = newToken;
    response = await fetch(endpoint, params);
  }
  
  return response;
}
```

**Session Errors (169):**
```typescript
if (response.data.errors?.some(e => e.code === 169)) {
  // Session expired - cannot recover
  // Redirect user to start over
  throw new Error('Session expired. Please restart booking.');
}
```

**Payment Errors:**
```typescript
if (paymentResponse.status === 'failed') {
  // Allow user to retry with different card
  // Keep booking session alive
  // Show specific error message from API
}
```

**API Timeout:**
```typescript
const timeout = setTimeout(() => {
  throw new Error('API request timed out');
}, 30000); // 30 second timeout

try {
  const response = await fetch(endpoint);
  clearTimeout(timeout);
  return response;
} catch (error) {
  clearTimeout(timeout);
  // Retry with exponential backoff
}
```

---

## Testing Guide

### Test Environment

Traveltek recommends using **production environment** for testing with the following approach:

**Testing Strategy:**
1. Use Royal Caribbean refundable rate cruises
2. Complete real bookings on staging
3. Cancel bookings immediately with Royal Caribbean
4. Verify confirmation emails and admin records
5. Monitor for any errors or issues

**⚠️ IMPORTANT:** Always book refundable rates for testing. Cancel within 24 hours to avoid charges.

### Test Credentials

**Use production credentials for testing:**
```
Username: cruisepassjson
Password: cr11fd75
Base URL: https://fusionapi.traveltek.net/2.1/json
```

### Test Cruise Lines

**Supported for Live Booking:**
- Royal Caribbean (Line ID: 22) ← Use for testing
- Celebrity Cruises (Line ID: 3)

### Test Scenarios

#### 1. Happy Path Test
```typescript
// Test full booking flow
1. Get token
2. Search for RCL cruises (next 3 months)
3. Select first cruise with availability
4. Get cabin grades (2 adults)
5. Select cheapest inside cabin
6. Add to basket
7. Enter test passenger details:
   - First Name: Test
   - Last Name: Booking
   - Email: test@zipsea.com
   - DOB: 1990-01-01
8. Pay deposit (use test card if available)
9. Verify confirmation
10. CANCEL BOOKING with Royal Caribbean
```

#### 2. Children Pricing Test
```typescript
// Test with children
1. Get cabin grades with:
   - adults=2
   - children=2
   - paxtype-1=child&dob-1=2015-06-15
   - paxtype-2=child&dob-2=2017-08-20
2. Verify pricing includes children
3. Complete booking
4. Cancel with Royal Caribbean
```

#### 3. Session Management Test
```typescript
// Test session persistence
1. Start booking
2. Add to basket
3. Wait 30 minutes
4. Continue booking (should still work)
5. Complete booking
6. Cancel with Royal Caribbean
```

#### 4. Error Handling Test
```typescript
// Test error scenarios
1. Try booking with expired token (expect 401)
2. Try booking with invalid cruise ID (expect error)
3. Try booking without required passenger fields (expect validation error)
4. Try payment with declined card (expect payment error)
```

### Verification Checklist

After each test booking:
- [ ] Booking confirmation number received
- [ ] Email confirmation sent
- [ ] Booking appears in database
- [ ] Payment recorded correctly
- [ ] Admin notification sent (email + Slack)
- [ ] No errors in server logs
- [ ] Booking cancelled with Royal Caribbean
- [ ] Refund initiated (if applicable)

---

## Security Considerations

### Credential Protection

**DO:**
- ✅ Store credentials in environment variables
- ✅ Use backend-only API calls
- ✅ Never expose credentials in frontend
- ✅ Use HTTPS only
- ✅ Rotate credentials periodically

**DON'T:**
- ❌ Commit credentials to Git
- ❌ Log credentials to console
- ❌ Send credentials in frontend code
- ❌ Store credentials in localStorage
- ❌ Share credentials in documentation

### Payment Data Handling

**PCI Compliance:**
- Card data should be submitted directly to Traveltek API
- Never store full card numbers in our database
- Only store last 4 digits for reference
- Use HTTPS for all payment requests
- Implement CSP headers to prevent XSS

**Best Practices:**
```typescript
// Good: Direct to Traveltek
const paymentResult = await traveltek.processPayment({
  cardNumber: frontendCardData.cardNumber // Ephemeral
});

// Bad: Storing card data
await database.insert({
  cardNumber: frontendCardData.cardNumber // ❌ Never do this
});

// Good: Store only last 4
await database.insert({
  last4: frontendCardData.cardNumber.slice(-4) // ✅ Safe
});
```

### Session Security

**Token Storage:**
```typescript
// Backend Redis (✅ Secure)
await redis.set(`token:${sessionId}`, accessToken, 'EX', 3600);

// Frontend localStorage (❌ Less secure)
localStorage.setItem('accessToken', token); // Don't do this
```

**Session Validation:**
```typescript
// Always validate session before API calls
const session = await redis.get(`session:${sessionId}`);
if (!session || session.expiresAt < Date.now()) {
  throw new Error('Invalid or expired session');
}
```

### Rate Limiting

**Implement rate limiting to prevent abuse:**
```typescript
// Example with Express
import rateLimit from 'express-rate-limit';

const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 bookings per IP
  message: 'Too many booking attempts, please try again later'
});

app.post('/api/v1/booking/session/create', bookingLimiter, handler);
```

### Input Validation

**Sanitize all inputs:**
```typescript
// Validate passenger data
function validatePassenger(data) {
  return {
    firstName: sanitize(data.firstName),
    lastName: sanitize(data.lastName),
    dob: validateDate(data.dob),
    email: validateEmail(data.email)
  };
}

function sanitize(input) {
  return input.trim().replace(/[<>]/g, '');
}
```

---

## Integration Checklist

### Backend Setup
- [ ] Environment variables configured
- [ ] OAuth token service implemented
- [ ] Session management with Redis
- [ ] Database schema created
- [ ] API service layer built
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Rate limiting enabled

### Frontend Setup
- [ ] Passenger selector component
- [ ] Booking flow pages created
- [ ] Form validation implemented
- [ ] Loading states added
- [ ] Error states added
- [ ] Mobile responsive
- [ ] Analytics events tracking

### Testing
- [ ] Unit tests for API services
- [ ] Integration tests for booking flow
- [ ] End-to-end test completed
- [ ] Mobile testing completed
- [ ] Error scenario testing completed
- [ ] Performance testing completed

### Security
- [ ] Credentials in environment variables
- [ ] PCI compliance verified
- [ ] Input validation implemented
- [ ] Rate limiting configured
- [ ] Logs sanitized (no card data)
- [ ] HTTPS enforced

### Deployment
- [ ] Staging environment tested
- [ ] Production credentials verified
- [ ] Monitoring configured
- [ ] Email notifications working
- [ ] Slack notifications working
- [ ] Rollback plan documented

---

## Support & Resources

### Traveltek Documentation
- Main Docs: https://docs.traveltek.com/FKpitwn16WopwZdCaW17
- Getting Started: https://docs.traveltek.com/FKpitwn16WopwZdCaW17/getting-started/authentication
- FAQ: https://docs.traveltek.com/FKpitwn16WopwZdCaW17/supporting-resources/faq

### Internal Resources
- Zipsea Architecture: `/documentation/DEPLOYMENT-WORKFLOW.md`
- Cruise Data Sync: `/documentation/CRUISE-DATA-SYNC.md`
- PRD: `/documentation/PRD.md`

### Contact
- Traveltek Support: [Contact via their portal]
- Zipsea Team: win@zipsea.com

---

**Last Updated:** October 17, 2025  
**Version:** 1.0  
**Maintained By:** Zipsea Engineering Team
