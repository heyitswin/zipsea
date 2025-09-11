# Zipsea Search API Documentation

## Overview
The Zipsea Search API provides endpoints to search for cruises, ships, ports, and related data. The API is RESTful and returns JSON responses.

## Base URL
- Production: `https://api.zipsea.com/api`
- Local Development: `http://localhost:3001/api`

## Endpoints

### 1. Search Cruises
**Endpoint:** `GET /cruises`

Search and filter cruises with various parameters.

**Query Parameters:**
- `shipId` (number, optional): Filter by specific ship ID
- `shipName` (string, optional): Filter by ship name (partial match)
- `departureDate` (string, optional): Filter by departure date (YYYY-MM-DD format)
- `page` (number, optional): Page number for pagination (default: 1)
- `limit` (number, optional): Number of results per page (default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "cruises": [
      {
        "id": "string",
        "name": "string",
        "sailing_date": "YYYY-MM-DD",
        "nights": number,
        "cruise_line_name": "string",
        "ship_name": "string",
        "embark_port_name": "string",
        "disembark_port_name": "string",
        "cheapest_price": "string"
      }
    ],
    "meta": {
      "total": number,
      "limit": number,
      "offset": number,
      "page": number,
      "totalPages": number
    }
  }
}
```

**Example Request:**
```bash
curl "https://api.zipsea.com/api/cruises?shipName=Symphony&limit=10"
```

### 2. Get Cruise by Slug
**Endpoint:** `GET /cruises/slug/{slug}`

Get detailed cruise information by its URL slug.

**Slug Format:** `{ship-name}-{YYYY-MM-DD}-{cruiseId}`
- Ship name in lowercase with spaces replaced by hyphens
- Departure date in YYYY-MM-DD format
- Cruise ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "name": "string",
    "voyageCode": "string",
    "sailingDate": "YYYY-MM-DD",
    "nights": number,
    "embarkDate": "YYYY-MM-DD",
    "disembarkDate": "YYYY-MM-DD",
    "cruiseLine": {
      "id": number,
      "name": "string",
      "logo": "string",
      "website": "string"
    },
    "ship": {
      "id": number,
      "name": "string",
      "code": "string",
      "shipClass": "string",
      "tonnage": number,
      "maxPassengers": number,
      "defaultShipImage": "string",
      "defaultShipImage2k": "string"
    },
    "embarkPort": {
      "id": number,
      "name": "string",
      "city": "string",
      "country": "string",
      "countryCode": "string"
    },
    "disembarkPort": {
      "id": number,
      "name": "string",
      "city": "string",
      "country": "string",
      "countryCode": "string"
    },
    "cabinCategories": [
      {
        "cabinCode": "string",
        "name": "string",
        "description": "string",
        "category": "string",
        "imageUrl": "string",
        "imageUrlHd": "string",
        "maxOccupancy": number,
        "amenities": []
      }
    ],
    "itinerary": [
      {
        "dayNumber": number,
        "date": "YYYY-MM-DD",
        "portName": "string",
        "arrivalTime": "string",
        "departureTime": "string",
        "status": "string"
      }
    ],
    "cheapestPricing": {
      "cheapestPrice": "string",
      "interiorPrice": "string",
      "oceanviewPrice": "string",
      "balconyPrice": "string",
      "suitePrice": "string",
      "currency": "USD"
    }
  }
}
```

**Example Request:**
```bash
curl "https://api.zipsea.com/api/cruises/slug/symphony-of-the-seas-2025-10-05-2143102"
```

### 3. Get Comprehensive Cruise Data
**Endpoint:** `GET /cruises/{cruiseId}/comprehensive`

Get the most detailed cruise information including all pricing options, cabin details, and related data.

**Response:** Similar to slug endpoint but with additional pricing options and alternative sailings.

### 4. List Ships
**Endpoint:** `GET /ships`

Get a list of all available cruise ships.

**Response:**
```json
[
  {
    "id": number,
    "name": "string",
    "cruiseLineName": "string",
    "cruiseLineId": number
  }
]
```

### 5. Get Available Sailing Dates
**Endpoint:** `GET /ships/{shipId}/available-dates`

Get available sailing dates for a specific ship.

**Response:**
```json
[
  {
    "year": number,
    "month": number,
    "sailingDates": ["YYYY-MM-DD"]
  }
]
```

### 6. Search Ports
**Endpoint:** `GET /ports`

Get a list of all ports.

**Response:**
```json
[
  {
    "id": number,
    "name": "string",
    "city": "string",
    "country": "string",
    "countryCode": "string"
  }
]
```

## Error Handling

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": {
    "message": "string",
    "details": "string",
    "statusCode": number
  }
}
```

**Common Error Codes:**
- `400`: Bad Request - Invalid parameters
- `404`: Not Found - Resource doesn't exist
- `500`: Internal Server Error

## Rate Limiting
- API requests are limited to 100 requests per minute per IP
- Exceeded limits return HTTP 429 status

## Authentication
Currently, the search API endpoints are public and don't require authentication. Protected endpoints (admin, booking) require JWT tokens.

## Data Freshness
- Cruise data is synchronized daily from the TravelTek FTP feed
- Pricing updates occur throughout the day via webhooks
- Cache TTL: 5 minutes for search results, 1 minute for individual cruise details

## Notes for Frontend Implementation

### Slug Generation
When generating slugs for cruise detail pages:
```javascript
function createSlugFromCruise(cruise) {
  const shipNameSlug = cruise.shipName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .trim();
  
  return `${shipNameSlug}-${cruise.departureDate}-${cruise.id}`;
}
```

### Handling Missing Data
The API may return null or undefined for optional fields. Always check for data existence:
```javascript
// Check cabin images
const cabinImage = cruise.cabinCategories?.[0]?.imageUrl || '/default-cabin.jpg';

// Check pricing
const price = cruise.cheapestPricing?.cheapestPrice || 'Contact for pricing';
```

### Search Optimization
- Use debouncing for real-time search (recommended: 300ms delay)
- Cache ship lists locally as they change infrequently
- Implement pagination for large result sets

## Example Integration

```javascript
// Search for cruises
async function searchCruises(params) {
  const url = new URL('https://api.zipsea.com/api/cruises');
  
  if (params.shipName) url.searchParams.append('shipName', params.shipName);
  if (params.departureDate) url.searchParams.append('departureDate', params.departureDate);
  url.searchParams.append('limit', params.limit || 20);
  url.searchParams.append('page', params.page || 1);
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error.message);
  }
  
  return data.data;
}

// Get cruise details
async function getCruiseDetails(slug) {
  const response = await fetch(`https://api.zipsea.com/api/cruises/slug/${slug}`);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error.message);
  }
  
  return data.data;
}
```