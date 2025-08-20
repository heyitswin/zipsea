# Search API Documentation

The Zipsea Search API provides powerful, fast, and flexible cruise search capabilities with advanced filtering, sorting, and faceted search features.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Endpoints](#endpoints)
- [Data Types](#data-types)
- [Examples](#examples)
- [Performance](#performance)
- [Error Handling](#error-handling)

## Overview

The Search API is designed to handle millions of cruise searches with sub-200ms response times. It supports:

- **Full-text search** across cruise names, destinations, ports, and cruise lines
- **Advanced filtering** by price, duration, dates, cabin types, and more
- **Faceted search** with counts for each filter option
- **Intelligent sorting** by price, date, popularity, and deals
- **Autocomplete suggestions** for better user experience
- **Personalized recommendations** based on search patterns

### Base URL
```
https://api.zipsea.com/api/v1/search
```

## Authentication

Most search endpoints are public and don't require authentication. However, for personalized features and higher rate limits, include your API key:

```http
Authorization: Bearer YOUR_API_KEY
```

## Rate Limiting

- **Anonymous users**: 100 requests per 15 minutes
- **Authenticated users**: 1000 requests per 15 minutes
- **Premium accounts**: 5000 requests per 15 minutes

Rate limit headers are included in all responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642680000
```

## Endpoints

### 1. Search Cruises

Search for cruises with advanced filtering and sorting options.

#### GET /api/v1/search

**Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `q` | string | General search query | `caribbean` |
| `minPrice` | number | Minimum price per person | `500` |
| `maxPrice` | number | Maximum price per person | `2000` |
| `priceCurrency` | string | Price currency (default: USD) | `USD` |
| `minNights` | number | Minimum cruise duration | `7` |
| `maxNights` | number | Maximum cruise duration | `14` |
| `sailingDateFrom` | string | Earliest sailing date (YYYY-MM-DD) | `2025-09-01` |
| `sailingDateTo` | string | Latest sailing date (YYYY-MM-DD) | `2025-12-31` |
| `cruiseLine` | number\|number[] | Cruise line ID(s) | `1` or `[1,2,3]` |
| `ship` | number\|number[] | Ship ID(s) | `10` or `[10,20]` |
| `departurePort` | string\|number | Departure port name or ID | `Miami` or `123` |
| `cabinType` | string\|string[] | Cabin type(s) | `balcony` or `["interior","balcony"]` |
| `regions` | number[] | Region ID(s) | `[1,2,3]` |
| `ports` | number[] | Port ID(s) to visit | `[10,20,30]` |
| `duration` | string | Duration shortcut | `weekend`, `week`, `extended` |
| `includeDeals` | boolean | Include special deals only | `true` |
| `minRating` | number | Minimum ship rating (1-5) | `4` |
| `passengers` | number | Number of passengers | `2` |
| `page` | number | Page number (1-based) | `1` |
| `limit` | number | Results per page (1-100) | `20` |
| `sortBy` | string | Sort field | `price`, `date`, `nights`, `name`, `rating`, `popularity`, `deals` |
| `sortOrder` | string | Sort direction | `asc`, `desc` |
| `facets` | boolean | Include faceted search data | `true` |
| `fast` | boolean | Optimize for speed (skip cache) | `true` |

**Example Request:**
```http
GET /api/v1/search?q=caribbean&minPrice=800&maxPrice=2000&minNights=7&sortBy=price&facets=true&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cruises": [
      {
        "id": 12345,
        "name": "Caribbean Adventure",
        "cruiseLine": {
          "id": 1,
          "name": "Royal Caribbean",
          "code": "RC",
          "logoUrl": "https://..."
        },
        "ship": {
          "id": 100,
          "name": "Harmony of the Seas",
          "tonnage": 226963,
          "passengerCapacity": 5400,
          "starRating": 4.5,
          "defaultImageUrl": "https://..."
        },
        "itinerary": {
          "nights": 7,
          "sailingDate": "2025-10-15",
          "returnDate": "2025-10-22",
          "embarkPort": {
            "id": 123,
            "name": "Miami, Florida"
          },
          "disembarkPort": {
            "id": 123,
            "name": "Miami, Florida"
          },
          "ports": ["Cozumel", "Jamaica", "Haiti"],
          "regions": ["Caribbean", "Western Caribbean"]
        },
        "pricing": {
          "from": 899,
          "currency": "USD",
          "cabinTypes": {
            "interior": 899,
            "oceanview": 1299,
            "balcony": 1599,
            "suite": 2999
          }
        },
        "images": ["https://...", "https://..."]
      }
    ],
    "filters": {
      "cruiseLines": [
        {
          "id": 1,
          "name": "Royal Caribbean",
          "code": "RC",
          "logoUrl": "https://...",
          "count": 156
        }
      ],
      "ships": [
        {
          "id": 100,
          "name": "Harmony of the Seas",
          "cruiseLineId": 1,
          "count": 24
        }
      ],
      "destinations": [
        {
          "name": "Caribbean",
          "type": "region",
          "id": 1,
          "count": 234
        }
      ],
      "departurePorts": [
        {
          "id": 123,
          "name": "Miami",
          "city": "Miami",
          "country": "United States",
          "count": 89
        }
      ],
      "cabinTypes": [
        {
          "type": "interior",
          "name": "Interior",
          "count": 345
        },
        {
          "type": "balcony",
          "name": "Balcony",
          "count": 298
        }
      ],
      "nightsRange": {
        "min": 3,
        "max": 21
      },
      "priceRange": {
        "min": 299,
        "max": 9999,
        "currency": "USD"
      },
      "sailingDateRange": {
        "min": "2025-01-15",
        "max": "2026-12-31"
      },
      "ratingRange": {
        "min": 3.0,
        "max": 5.0
      }
    },
    "facets": {
      "cruiseLines": [
        {
          "id": 1,
          "name": "Royal Caribbean",
          "count": 156,
          "selected": false
        }
      ],
      "cabinTypes": [
        {
          "type": "interior",
          "name": "Interior",
          "count": 345,
          "selected": false
        }
      ],
      "priceRanges": [
        {
          "min": 0,
          "max": 500,
          "label": "Under $500",
          "count": 23,
          "selected": false
        }
      ],
      "durationRanges": [
        {
          "min": 1,
          "max": 4,
          "label": "Short (1-4 nights)",
          "count": 45,
          "selected": false
        }
      ],
      "popularDestinations": [
        {
          "name": "Caribbean",
          "type": "region",
          "count": 234,
          "selected": false
        }
      ],
      "sailingMonths": [
        {
          "month": "October",
          "year": 2025,
          "count": 67,
          "selected": false
        }
      ]
    },
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 1247,
      "totalPages": 125,
      "searchTime": 89,
      "cacheHit": false
    }
  }
}
```

### 2. Search Suggestions

Get autocomplete suggestions for search queries.

#### GET /api/v1/search/suggestions

**Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `q` | string | **Required.** Search query (2-100 chars) | `royal` |
| `limit` | number | Max suggestions (1-20) | `10` |

**Example Request:**
```http
GET /api/v1/search/suggestions?q=royal&limit=5
```

**Response:**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "type": "cruise-line",
        "value": "1",
        "label": "Royal Caribbean",
        "count": 156,
        "metadata": {
          "code": "RC",
          "logoUrl": "https://..."
        }
      },
      {
        "type": "ship",
        "value": "100",
        "label": "Royal Princess",
        "count": 24,
        "metadata": {
          "cruiseLineId": 2
        }
      },
      {
        "type": "port",
        "value": "456",
        "label": "Port Royal, Jamaica",
        "count": 45,
        "metadata": {
          "city": "Port Royal",
          "country": "Jamaica"
        }
      }
    ],
    "query": "royal",
    "count": 3
  }
}
```

**Suggestion Types:**
- `cruise-line`: Cruise line companies
- `ship`: Individual ships
- `port`: Ports and destinations
- `region`: Geographic regions
- `cruise`: Specific cruise names

### 3. Search Filters

Get available filter options with counts.

#### GET /api/v1/search/filters

**Example Request:**
```http
GET /api/v1/search/filters
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cruiseLines": [
      {
        "id": 1,
        "name": "Royal Caribbean",
        "code": "RC",
        "logoUrl": "https://...",
        "count": 156
      }
    ],
    "ships": [
      {
        "id": 100,
        "name": "Harmony of the Seas",
        "cruiseLineId": 1,
        "count": 24
      }
    ],
    "destinations": [
      {
        "name": "Caribbean",
        "type": "region",
        "id": 1,
        "count": 234
      }
    ],
    "departurePorts": [
      {
        "id": 123,
        "name": "Miami",
        "city": "Miami",
        "country": "United States",
        "count": 89
      }
    ],
    "cabinTypes": [
      {
        "type": "interior",
        "name": "Interior",
        "count": 345
      }
    ],
    "nightsRange": {
      "min": 3,
      "max": 21
    },
    "priceRange": {
      "min": 299,
      "max": 9999,
      "currency": "USD"
    },
    "sailingDateRange": {
      "min": "2025-01-15",
      "max": "2026-12-31"
    },
    "ratingRange": {
      "min": 3.0,
      "max": 5.0
    }
  }
}
```

### 4. Popular Cruises

Get popular and trending cruises.

#### GET /api/v1/search/popular

**Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `limit` | number | Max results (1-50) | `10` |

**Example Request:**
```http
GET /api/v1/search/popular?limit=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cruises": [
      {
        "id": 12345,
        "name": "Caribbean Adventure",
        // ... (same structure as search results)
      }
    ],
    "count": 10,
    "meta": {
      "limit": 10,
      "cached": true
    }
  }
}
```

### 5. Recommendations

Get personalized cruise recommendations.

#### GET /api/v1/search/recommendations

**Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `limit` | number | Max results (1-20) | `5` |
| `cruiseLine` | number | Preferred cruise line | `1` |
| `departurePort` | string | Preferred departure port | `Miami` |
| `maxPrice` | number | Budget limit | `2000` |
| `minNights` | number | Minimum duration | `7` |
| `maxNights` | number | Maximum duration | `14` |

**Example Request:**
```http
GET /api/v1/search/recommendations?limit=5&maxPrice=2000&departurePort=Miami
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cruises": [
      {
        "id": 12345,
        "name": "Caribbean Adventure",
        // ... (same structure as search results)
      }
    ],
    "count": 5,
    "filters": {
      "maxPrice": 2000,
      "departurePort": "Miami"
    },
    "meta": {
      "limit": 5,
      "algorithm": "score-based",
      "factors": ["rating", "price", "duration", "sailing_date"]
    }
  }
}
```

## Data Types

### Cruise Object
```typescript
interface Cruise {
  id: number;
  name: string;
  cruiseLine: {
    id: number;
    name: string;
    code?: string;
    logoUrl?: string;
  };
  ship: {
    id: number;
    name: string;
    tonnage?: number;
    passengerCapacity?: number;
    starRating?: number;
    defaultImageUrl?: string;
  };
  itinerary: {
    nights: number;
    sailingDate: string; // ISO date
    returnDate?: string; // ISO date
    embarkPort?: {
      id: number;
      name: string;
    };
    disembarkPort?: {
      id: number;
      name: string;
    };
    ports: string[];
    regions: string[];
  };
  pricing: {
    from: number;
    currency: string;
    cabinTypes: {
      interior?: number;
      oceanview?: number;
      balcony?: number;
      suite?: number;
    };
  };
  images?: string[];
}
```

### Search Filters
```typescript
interface SearchFilters {
  q?: string; // General search query
  destination?: string;
  departurePort?: string;
  cruiseLine?: number | number[];
  ship?: number | number[];
  nights?: {
    min?: number;
    max?: number;
  };
  price?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  sailingDate?: {
    from?: string; // YYYY-MM-DD
    to?: string; // YYYY-MM-DD
  };
  cabinType?: string | string[];
  passengers?: number;
  regions?: number[];
  ports?: number[];
  includeDeals?: boolean;
  minRating?: number;
  duration?: 'weekend' | 'week' | 'extended';
}
```

### Cabin Types
- `interior` / `inside`: Interior cabins (no windows)
- `oceanview` / `outside`: Oceanview cabins (with windows)
- `balcony`: Balcony cabins (with private balcony)
- `suite`: Suite cabins (larger luxury accommodations)

### Duration Shortcuts
- `weekend`: 2-4 nights
- `week`: 5-9 nights  
- `extended`: 10+ nights

## Examples

### Basic Search
```bash
curl "https://api.zipsea.com/api/v1/search?q=caribbean&limit=5"
```

### Advanced Filtering
```bash
curl "https://api.zipsea.com/api/v1/search?minPrice=800&maxPrice=2000&minNights=7&cruiseLine=1&cabinType=balcony&sortBy=price&limit=10"
```

### Faceted Search
```bash
curl "https://api.zipsea.com/api/v1/search?q=mediterranean&facets=true&limit=20"
```

### Multiple Filters
```bash
curl "https://api.zipsea.com/api/v1/search?cruiseLine=1&cruiseLine=2&cabinType=interior&cabinType=balcony&sailingDateFrom=2025-09-01&sailingDateTo=2025-12-31"
```

### Search Suggestions
```bash
curl "https://api.zipsea.com/api/v1/search/suggestions?q=royal"
```

### Get Available Filters
```bash
curl "https://api.zipsea.com/api/v1/search/filters"
```

## Performance

The Search API is optimized for high performance:

- **Response Time**: < 200ms for most queries
- **Throughput**: 1000+ requests per second
- **Caching**: Intelligent caching with 15-minute to 4-hour TTL
- **Database**: Optimized indexes and query plans
- **Full-text Search**: PostgreSQL text search with GIN indexes

### Performance Tips

1. **Use specific filters** to reduce result sets
2. **Enable caching** by avoiding the `fast=true` parameter
3. **Limit results** appropriately (default: 20, max: 100)
4. **Use faceted search** sparingly for better performance
5. **Implement client-side caching** for filter options

### Monitoring

Response includes performance metadata:
```json
{
  "meta": {
    "searchTime": 89,    // Total search time in ms
    "cacheHit": false,   // Whether result was cached
    "query": {
      "filters": 3,      // Number of filters applied
      "options": 2       // Number of options specified
    }
  }
}
```

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request (invalid parameters) |
| 401 | Unauthorized (invalid API key) |
| 403 | Forbidden (rate limit exceeded) |
| 404 | Not Found |
| 422 | Validation Error |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid parameter value",
    "details": "minPrice must be a positive number",
    "field": "minPrice"
  }
}
```

### Common Errors

#### Validation Errors
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Query too short",
    "details": "Search query must be at least 2 characters"
  }
}
```

#### Rate Limit Exceeded
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "details": "Rate limit of 100 requests per 15 minutes exceeded",
    "retryAfter": 300
  }
}
```

#### Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "details": "Please try again later or contact support"
  }
}
```

### Error Handling Best Practices

1. **Always check the `success` field** before processing data
2. **Implement exponential backoff** for retries
3. **Handle rate limits gracefully** with retry-after delays
4. **Log errors with request IDs** for debugging
5. **Provide user-friendly error messages** based on error codes

## Changelog

### v1.2.0 (2025-01-20)
- Added faceted search with counts
- Improved full-text search with PostgreSQL FTS
- Added personalized recommendations endpoint
- Enhanced autocomplete with metadata
- Performance optimizations and new indexes

### v1.1.0 (2025-01-15)
- Added multi-value filter support
- Enhanced sorting options (popularity, deals, rating)
- Improved error handling and validation
- Added performance monitoring

### v1.0.0 (2025-01-10)
- Initial release
- Basic search functionality
- Filter and sorting support
- Autocomplete suggestions

## Support

For API support, please contact:
- **Email**: api-support@zipsea.com
- **Documentation**: https://docs.zipsea.com
- **Status Page**: https://status.zipsea.com

---

*Last updated: January 20, 2025*