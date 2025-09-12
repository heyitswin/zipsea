# Search and Filtering System Documentation

## Overview
The Zipsea search and filtering system allows users to find cruises based on various criteria including cruise lines, dates, ports, ships, regions, and more. This document details the system architecture, known issues that were resolved, and important considerations for future development.

## Architecture

### Frontend Components

#### 1. CruisesContent Component (`/frontend/app/cruises/CruisesContent.tsx`)
The main component handling cruise search and filtering.

**Key Features:**
- URL parameter synchronization for shareable/bookmarkable searches
- Multi-select filters for all categories
- Real-time search with debouncing
- Pagination support
- Sort functionality (by date, price, duration)

**State Management:**
```typescript
// Filter states - support multi-select
const [selectedCruiseLines, setSelectedCruiseLines] = useState<number[]>([]);
const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
const [selectedNightRanges, setSelectedNightRanges] = useState<string[]>([]);
const [selectedDeparturePorts, setSelectedDeparturePorts] = useState<number[]>([]);
const [selectedShips, setSelectedShips] = useState<number[]>([]);
const [selectedRegions, setSelectedRegions] = useState<number[]>([]);
```

### Backend Services

#### 1. Search Comprehensive Controller (`/backend/src/controllers/search-comprehensive.controller.ts`)
Handles all search API requests with comprehensive filtering capabilities.

**Endpoints:**
- `GET /api/v1/search/comprehensive` - Main search endpoint
- `GET /api/v1/search/comprehensive/facets` - Get filter options
- `GET /api/v1/search/comprehensive/popular` - Get popular cruises
- `GET /api/v1/search/comprehensive/suggestions` - Search suggestions

#### 2. Search Comprehensive Service (`/backend/src/services/search-comprehensive.service.ts`)
Core business logic for search operations.

**Key Features:**
- Database query building with Drizzle ORM
- Price filtering (excludes cruises ≤ $99)
- Date filtering (excludes past cruises)
- Multi-criteria filtering support
- Result pagination

## Critical Issues and Solutions

### 1. Persistent Filter State Bug

**Problem:** 
Filters were persisting across navigation, showing filtered results even when users navigated to `/cruises` with no URL parameters.

**Root Causes:**
1. Backend cache was returning stale results
2. Filter state wasn't properly resetting on URL changes
3. Race conditions between API requests

**Solutions Implemented:**

#### a. Backend Cache Disabled
```typescript
// /backend/src/services/search-comprehensive.service.ts
// DISABLED: Cache is causing stale results to be returned
// The cache key might collide or the cache isn't being invalidated properly
// TODO: Fix cache key generation or implement proper cache invalidation
/*
const cached = await cacheManager.get<any>(cacheKey);
if (cached && !filters.includeUnavailable) {
  return { ...cached };
}
*/

// Also disabled cache storage after query
// await cacheManager.set(cacheKey, response, { ttl: 300 });
```

#### b. Frontend State Reset on URL Changes
```typescript
// Always reset all filters first, then apply from URL
// This ensures we don't have stale filter state
console.log("Resetting all filters to empty");
setSelectedCruiseLines([]);
setSelectedMonths([]);
setSelectedNightRanges([]);
setSelectedDeparturePorts([]);
setSelectedShips([]);
setSelectedRegions([]);
setPage(1);
setSortBy("soonest");

// Now apply filters from URL if they exist
```

#### c. Request Tracking with AbortController
```typescript
// Track requests to prevent race conditions
const abortControllerRef = useRef<AbortController | null>(null);
const requestCounterRef = useRef(0);

// Cancel any ongoing request
if (abortControllerRef.current) {
  console.log("=== CANCELLING PREVIOUS REQUEST ===");
  abortControllerRef.current.abort();
}

// Create new abort controller for this request
const abortController = new AbortController();
abortControllerRef.current = abortController;

// Increment request counter and save the current request ID
const currentRequestId = ++requestCounterRef.current;

// Check if this is still the current request before updating state
if (currentRequestId !== requestCounterRef.current) {
  console.log(`=== IGNORING STALE RESPONSE #${currentRequestId} ===`);
  return;
}
```

### 2. CORS Header Issues

**Problem:**
Adding cache prevention headers (`Expires`, `Pragma`) in the frontend caused CORS errors.

**Error Message:**
```
Request header field expires is not allowed by Access-Control-Allow-Headers in preflight response.
```

**Solution:**
Removed problematic headers from frontend fetch requests. Cache prevention is now handled entirely by the backend response headers.

```typescript
// Before (causing CORS errors):
const response = await fetch(url, {
  headers: {
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Expires": "0"
  }
});

// After (fixed):
const response = await fetch(url, {
  signal: abortController.signal,
  cache: "no-store", // Prevent caching
  // Removed headers that cause CORS issues
  // The backend now handles cache prevention
});
```

Backend now sets proper cache prevention headers:
```typescript
res.set({
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store'
});
```

### 3. Cache Busting

To ensure fresh data on every request, a timestamp parameter is added:
```typescript
// Add timestamp to prevent any caching
params.append("_t", Date.now().toString());
```

## Filter System Details

### URL Parameter Mapping

| Filter | URL Parameter | Type | Example |
|--------|--------------|------|---------|
| Cruise Lines | `cruiseLines` | Comma-separated IDs | `cruiseLines=1,2,3` |
| Months | `months` | Comma-separated YYYY-MM | `months=2025-09,2025-10` |
| Night Ranges | `nights` | Comma-separated ranges | `nights=7-10,14-21` |
| Departure Ports | `ports` | Comma-separated IDs | `ports=1,5,8` |
| Ships | `ships` | Comma-separated IDs | `ships=12,15` |
| Regions | `regions` | Comma-separated IDs | `regions=3,4` |
| Page | `page` | Number | `page=2` |
| Sort | `sort` | String | `sort=lowest_price` |

### Month Filtering

Months are handled specially to account for full month ranges:
```typescript
// Backend converts month string to date range
const [year, month] = monthStr.split('-');
const startOfMonth = `${year}-${month}-01`;
// JavaScript months are 0-indexed, but our month string is 1-indexed
const endOfMonth = new Date(parseInt(year), parseInt(month), 0)
  .toISOString()
  .split('T')[0];
```

### Night Range Filtering

Night ranges are parsed from strings like "7-10" or "21+":
```typescript
if (range.includes('+')) {
  const min = parseInt(range.replace('+', ''));
  // Set minimum nights filter
} else if (range.includes('-')) {
  const [min, max] = range.split('-').map(Number);
  // Set min and max nights filters
}
```

### Price Filtering

The backend automatically filters out:
1. Cruises with no valid prices
2. Cruises with all prices ≤ $99

```sql
LEAST(
  COALESCE(interior_price, 999999),
  COALESCE(oceanview_price, 999999),
  COALESCE(balcony_price, 999999),
  COALESCE(suite_price, 999999)
) > 99
```

## Database Schema Considerations

### Pricing Fields
Each cruise has four price fields:
- `interior_price` (cheapest inside cabin)
- `oceanview_price` (cheapest outside cabin)
- `balcony_price` (cheapest balcony cabin)
- `suite_price` (cheapest suite)

### Region Storage
Regions are stored as comma-separated IDs in a single field, requiring special SQL handling:
```sql
region_ids = '1' OR
region_ids LIKE '1,%' OR
region_ids LIKE '%,1,%' OR
region_ids LIKE '%,1'
```

## Performance Considerations

### 1. Caching Strategy
Currently disabled due to stale data issues. When re-implementing:
- Ensure unique cache keys for different filter combinations
- Implement proper cache invalidation on data updates
- Consider shorter TTL for dynamic search results (< 5 minutes)

### 2. Query Optimization
- Database queries use indexes on frequently filtered fields
- JOINs are optimized with proper foreign key relationships
- LIMIT and OFFSET used for pagination

### 3. Frontend Optimization
- AbortController prevents unnecessary requests
- Request deduplication with request IDs
- Component cleanup cancels pending requests on unmount

## Testing Checklist

When modifying the search/filter system, test:

1. **Filter Reset**
   - Navigate to `/cruises` with filters applied
   - Navigate away and back with no URL params
   - Verify all filters are cleared

2. **URL Synchronization**
   - Apply filters and verify URL updates
   - Copy URL to new tab and verify filters apply
   - Use browser back/forward and verify filters sync

3. **Race Conditions**
   - Rapidly change filters
   - Verify only the latest results display
   - Check console for "IGNORING STALE RESPONSE" messages

4. **CORS Headers**
   - Verify no CORS errors in console
   - Check network tab for proper response headers

5. **Cache Behavior**
   - Apply filters and note results
   - Clear filters and verify different results
   - Reapply same filters and verify fresh data

## Common Pitfalls

1. **Don't add custom headers to frontend fetch** - Can cause CORS issues
2. **Always reset state before applying URL params** - Prevents stale state
3. **Use request tracking** - Prevents race conditions
4. **Test cache thoroughly** - Cache bugs can be subtle
5. **Handle array parameters correctly** - Backend expects arrays for multi-select

## Future Improvements

1. **Re-implement Caching**
   - Use more specific cache keys
   - Implement cache tags for invalidation
   - Consider Redis for distributed caching

2. **Search Performance**
   - Add Elasticsearch for text search
   - Implement faceted search counts
   - Add search result highlighting

3. **User Experience**
   - Add loading skeletons
   - Implement infinite scroll option
   - Add filter count badges
   - Save user's filter preferences

4. **Code Quality**
   - Add comprehensive test coverage
   - Implement E2E tests for filter scenarios
   - Add performance monitoring

## Debugging Tips

### Console Logging
The system includes extensive logging:
- `=== URL PARAMS SYNC ===` - URL parameter processing
- `=== STARTING REQUEST #X ===` - New search request
- `=== CANCELLING PREVIOUS REQUEST ===` - Request abortion
- `=== UPDATING CRUISES FROM REQUEST #X ===` - Results received
- `=== IGNORING STALE RESPONSE ===` - Old request ignored

### Network Debugging
1. Check for `_t` timestamp parameter in requests
2. Verify response headers include cache prevention
3. Look for aborted requests (red in Network tab)
4. Check response `X-Request-ID` header

### Common Issues
- **No results showing**: Check console for CORS errors
- **Old results showing**: Cache might be enabled, check backend
- **Filters not applying**: Verify URL params are being set
- **Slow performance**: Check for request loops or missing AbortController

## Contact

For questions about this system, refer to:
- Frontend filtering logic: `/frontend/app/cruises/CruisesContent.tsx`
- Backend search service: `/backend/src/services/search-comprehensive.service.ts`
- API routes: `/backend/src/routes/search-comprehensive.routes.ts`