# Cruise Detail Page API Implementation

This document outlines the comprehensive cruise detail API implementation that provides SEO-friendly slug-based access and complete database field visibility.

## Overview

We've implemented a complete cruise detail system with the following features:

1. **SEO-Friendly Slug Generation and Parsing**
2. **Comprehensive Data Retrieval** - Shows ALL database fields
3. **Slug-Based Cruise Access** - Direct URL routing to cruise details
4. **Enhanced Search Integration** - Single result redirects
5. **Data Dumping** - Complete raw database field visibility

## Implementation Details

### 1. Slug Utilities (`/src/utils/slug.utils.ts`)

**Slug Format**: `ship-name-YYYY-MM-DD-cruise-id`
**Example**: `symphony-of-the-seas-2025-10-05-2143102`

**Key Functions**:
- `generateCruiseSlug()` - Creates SEO-friendly URLs
- `parseCruiseSlug()` - Extracts data from URLs
- `isValidCruiseSlug()` - Validates slug format
- `generateSlugVariations()` - Handles ship name variations

### 2. Enhanced Cruise Service (`/src/services/cruise.service.ts`)

**New Methods Added**:

#### `getCruiseBySlug(slug: string)`
- Parses slug and retrieves comprehensive cruise data
- Validates slug against actual cruise data
- Returns complete cruise information with SEO data

#### `getComprehensiveCruiseData(cruiseId: number)`
- Fetches ALL database fields from related tables
- Includes raw database objects for debugging
- Provides comprehensive pricing, itinerary, and ship data

#### `findCruiseByShipAndDate(shipName: string, sailingDate: string)`
- Finds cruises for single-result redirects
- Fuzzy matching on ship names
- Returns cruise ID and generated slug

**New Interface**: `ComprehensiveCruiseData`
- Complete cruise information
- Raw database fields included
- SEO metadata
- Statistics and counts
- Cache information

### 3. Enhanced Cruise Controller (`/src/controllers/cruise.controller.ts`)

**New Endpoints Added**:

#### `GET /api/v1/cruises/slug/:slug`
- Access cruise by SEO-friendly slug
- Returns comprehensive data
- Validates slug format and cruise match

#### `GET /api/v1/cruises/:id/comprehensive`
- Get complete cruise data with ALL database fields
- Includes related records from all tables
- Shows pricing, itinerary, cabin details, etc.

#### `GET /api/v1/cruises/:id/dump`
- Developer endpoint showing raw database dumps
- Human-readable format with organized sections
- Includes sample raw records for debugging

#### `GET /api/v1/cruises/find-for-redirect`
- Find cruise by ship name and sailing date
- For single search result redirects
- Returns cruise ID and slug for redirection

#### Enhanced `GET /api/v1/cruises/:id`
- Added `?comprehensive=true` parameter
- Backward compatible with existing clients
- Provides upgrade path to full data

### 4. Updated Routes (`/src/routes/cruise.routes.ts`)

All new endpoints properly configured with documentation:

```
GET /api/v1/cruises/slug/:slug                 # Slug-based access
GET /api/v1/cruises/:id/comprehensive          # Complete data
GET /api/v1/cruises/:id/dump                   # Raw data dump
GET /api/v1/cruises/find-for-redirect          # Search redirects
GET /api/v1/cruises/:id?comprehensive=true     # Enhanced details
```

## API Usage Examples

### 1. Access Cruise by Slug
```bash
GET /api/v1/cruises/slug/symphony-of-the-seas-2025-10-05-2143102
```

**Response**: Complete cruise data with SEO information

### 2. Get Comprehensive Data
```bash
GET /api/v1/cruises/2143102/comprehensive
```

**Response**: ALL database fields including:
- Complete cruise information
- Full pricing breakdown (all options)
- Complete itinerary with port details
- All cabin categories
- Ship details with amenities
- Cruise line information
- Raw database records

### 3. Data Dump for Debugging
```bash
GET /api/v1/cruises/2143102/dump
```

**Response**: Human-readable dump showing:
- Organized sections for each data type
- Sample raw database records
- Field counts and statistics
- Raw JSON objects for debugging

### 4. Find Cruise for Redirect
```bash
GET /api/v1/cruises/find-for-redirect?shipName=Symphony of the Seas&sailingDate=2025-10-05
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 2143102,
    "slug": "symphony-of-the-seas-2025-10-05-2143102",
    "redirectUrl": "/cruise/symphony-of-the-seas-2025-10-05-2143102"
  }
}
```

### 5. Enhanced Standard Endpoint
```bash
GET /api/v1/cruises/2143102?comprehensive=true
```

**Response**: Same as comprehensive endpoint but through standard route

## Data Structure

### Comprehensive Cruise Data Includes:

1. **Basic Cruise Info** - All fields from cruises table
2. **Cruise Line** - Complete line information with branding
3. **Ship Details** - All ship specifications, amenities, images
4. **Port Information** - Embark/disembark ports with full details
5. **Regions** - All cruise regions with descriptions
6. **Ports Visited** - Complete port list with coordinates
7. **Pricing** - ALL pricing options with full breakdown
   - Individual pricing records
   - Summary statistics
   - Price ranges by cabin type
8. **Itinerary** - Day-by-day schedule with port details
9. **Cabin Categories** - All cabin types with specifications
10. **Alternative Sailings** - Related cruise options
11. **SEO Data** - Meta tags, breadcrumbs, URLs
12. **Raw Data** - Original database records for debugging

## SEO and URL Structure

### Slug Components:
- **Ship Name**: Normalized (spaces → hyphens, special chars removed)
- **Departure Date**: YYYY-MM-DD format
- **Cruise ID**: Unique identifier

### SEO Benefits:
- Search engine friendly URLs
- Descriptive path structure
- Canonical URL generation
- Meta title and description generation
- Breadcrumb navigation structure

## Caching Strategy

- **Comprehensive Data**: 30-minute TTL
- **Standard Data**: 6-hour TTL
- **Cache Keys**: Unique per cruise and data type
- **Cache Status**: Included in response metadata

## Error Handling

### Slug Validation:
- Format validation
- Date validation
- Cruise existence check
- Ship name matching

### Comprehensive Responses:
- Detailed error messages
- Suggestion for correct format
- Alternative endpoints mentioned
- Development-friendly error details

## Frontend Integration Notes

While this is a backend API, here's how a frontend would integrate:

### Single Search Results:
```javascript
// When search returns exactly 1 result
const response = await fetch(`/api/v1/cruises/find-for-redirect?shipName=${shipName}&sailingDate=${date}`);
const { data } = await response.json();

// Redirect to cruise detail page
window.location.href = data.redirectUrl;
```

### Display All Data:
```javascript
// Get comprehensive cruise data
const response = await fetch(`/api/v1/cruises/slug/${slug}`);
const { data } = await response.json();

// Data includes everything: pricing, itinerary, ship details, etc.
console.log('Complete cruise data:', data);
```

## Database Requirements

The implementation assumes access to these tables:
- `cruises` - Main cruise records
- `cruise_lines` - Cruise line information
- `ships` - Ship specifications
- `ports` - Port details
- `regions` - Geographic regions
- `pricing` - Pricing options
- `cheapest_pricing` - Price summaries
- `itineraries` - Day-by-day schedules
- `cabin_categories` - Cabin specifications
- `alternative_sailings` - Related cruises

## Performance Considerations

1. **Parallel Data Fetching** - All related data fetched simultaneously
2. **Comprehensive Caching** - Reduces database load
3. **Optimized Queries** - Uses joins where appropriate
4. **Raw Data Inclusion** - For debugging without extra queries

## Testing the Implementation

### Test Slug Generation:
```bash
curl "http://localhost:3000/api/v1/cruises/1/comprehensive"
# Look for seoData.slug in response
```

### Test Slug Access:
```bash
curl "http://localhost:3000/api/v1/cruises/slug/symphony-of-the-seas-2025-10-05-1"
```

### Test Data Dump:
```bash
curl "http://localhost:3000/api/v1/cruises/1/dump" | jq '.'
```

### Test Find for Redirect:
```bash
curl "http://localhost:3000/api/v1/cruises/find-for-redirect?shipName=Symphony&sailingDate=2025-10-05"
```

## Summary

This implementation provides:

✅ **SEO-friendly cruise URLs** with descriptive slugs
✅ **Complete database visibility** - see ALL fields
✅ **Enhanced search integration** - single result redirects
✅ **Developer-friendly debugging** - raw data dumps
✅ **Backward compatibility** - existing endpoints enhanced
✅ **Performance optimized** - caching and parallel fetching
✅ **Production ready** - comprehensive error handling

The system allows you to see exactly what data is available in your database and provides multiple ways to access cruise information, from user-friendly URLs to complete data dumps for development purposes.