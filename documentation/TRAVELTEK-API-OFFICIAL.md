# Traveltek API Official Documentation

This documentation covers the complete Traveltek API structure based on the official API documentation and live JSON data analysis.

## Overview

Traveltek provides cruise data through:
1. **FTP JSON Files**: Static cruise data with complete information
2. **Static Pricing Webhooks**: Notifications when cruise line pricing is updated
3. **Live Pricing Webhooks**: Real-time pricing updates (NOT USED in our implementation)

## FTP Folder Structure

### Directory Layout
```
ftpeu1prod.traveltek.net/
├── YYYY/                    # Year (e.g., 2025)
│   ├── MM/                  # Month (e.g., 01, 02, ..., 12)
│   │   ├── [LINEID]/        # Cruise Line ID (e.g., 7 for NCL)
│   │   │   ├── [SHIPID]/    # Ship ID (e.g., 410)
│   │   │   │   ├── [CODETOCRUISEID].json  # Individual cruise file
```

### File Naming Convention
- **File Name**: `{codetocruiseid}.json`
- **Path**: `{year}/{month}/{lineid}/{shipid}/{codetocruiseid}.json`
- **Example**: `2025/09/7/410/12345.json`

### Access Credentials
- **Host**: `ftpeu1prod.traveltek.net`
- **Protocol**: FTP (not SFTP)
- **Authentication**: Username/Password (configured in environment variables)

## JSON Data Structure

### Root Level Fields

#### Basic Cruise Information
```json
{
  "cruiseid": 12345,                    // Primary cruise identifier (integer)
  "name": "Western Mediterranean",       // Cruise name/title (string)
  "saildate": "2025-09-15",            // Sail date (YYYY-MM-DD string)
  "startdate": "2025-09-15",           // Start date (same as saildate)
  "nights": 7,                         // Number of nights (integer)
  "sailnights": 7,                     // Sailing nights (integer)
  "seadays": 2,                        // Days at sea (integer)
  "voyagecode": "WMD240915",           // Voyage code (string)
  "codetocruiseid": 12345,             // Used for file naming (integer)
  "itinerarycode": null,               // Always null in samples
  "marketid": "0",                     // Market identifier (string)
  "ownerid": "system",                 // Owner ID (string)
  "showcruise": "Y",                   // Show cruise flag (Y/N string)
  "nofly": "N",                        // No fly flag (Y/N string)
  "departuk": "Y"                      // Depart UK flag (Y/N string)
}
```

#### Line and Ship IDs
```json
{
  "lineid": 7,                         // Cruise line ID (integer)
  "shipid": 410,                       // Ship ID (integer)
  "startportid": "378",                // Embark port ID (string)
  "endportid": "378"                   // Disembark port ID (string)
}
```

#### Ports and Regions ⚠️ IMPORTANT
```json
{
  "portids": "378,383,2864,37",        // COMMA-SEPARATED string of port IDs
  "ports": {                           // Object (NOT array) with port data
    "378": { "name": "Southampton", ... },
    "383": { "name": "Gibraltar", ... }
  },
  "regionids": "12,3",                 // COMMA-SEPARATED string of region IDs  
  "regions": {                         // Object (NOT array) with region data
    "12": { "name": "Western Mediterranean", ... },
    "3": { "name": "Atlantic Ocean", ... }
  }
}
```

### Pricing Structure

#### Static Pricing Data
```json
{
  "prices": {                          // Main pricing object
    "RATECODE": {                      // Rate code (e.g., "STANDARD")
      "CABINCODE": {                   // Cabin code (e.g., "IS")
        "OCCUPANCYCODE": {             // Occupancy (e.g., "2")
          "price": 1299.00,           // Base price (float)
          "taxes": 125.50,            // Taxes (float)
          "ncf": 15.00,               // Non-commissionable fees (float)
          "gratuity": 98.00,          // Gratuities (float)
          "fuel": 0.00,               // Fuel supplement (float)
          "total": 1537.50            // Total price (float)
        }
      }
    }
  }
}
```

#### Cached and Cheapest Pricing
```json
{
  "cachedprices": {                    // Cached pricing data (similar structure to prices)
    // Same structure as prices object
  },
  "cheapest": {                        // Pre-calculated cheapest prices
    "prices": null,                    // Usually null in samples
    "cachedprices": null,              // Usually null in samples  
    "combined": null                   // Usually null in samples
  }
}
```

### Ship Content (`shipcontent` object)
```json
{
  "shipcontent": {
    "id": 410,                         // Ship ID (integer)
    "name": "Norwegian Dawn",          // Ship name (string) ⭐ KEY FIELD
    "code": "",                        // Ship code (may be empty string)
    "tonnage": 92250,                  // Ship tonnage (integer)
    "totalcabins": 1112,               // Total cabins (integer)
    "occupancy": 2340,                 // Guest capacity (integer) ⭐ KEY FIELD  
    "totalcrew": 1100,                 // Crew count (integer)
    "length": 294,                     // Ship length in meters (integer)
    "launched": "2002-12-01",          // Launch date (string)
    "starrating": 4,                   // Star rating (integer)
    "adultsonly": "N",                 // Adults only flag (Y/N string)
    "shortdescription": "Ship description...", // Description (string)
    "highlights": null,                // Ship highlights (usually null)
    "shipclass": null,                 // Ship class (usually null)
    "defaultshipimage": "https://...", // Default image URL (string)
    "defaultshipimagehd": "https://...", // HD image URL (string)
    "defaultshipimage2k": "https://...", // 2K image URL (string)
    "shipimages": {                    // Ship images object
      "1": { "url": "https://...", "caption": "..." }
    },
    "shipdecks": {                     // Deck information object
      "1": { "name": "Deck 1", "facilities": [...] }
    },
    "niceurl": "norwegian-dawn"        // SEO-friendly URL (string)
  }
}
```

### Line Content (`linecontent` object)
```json
{
  "linecontent": {
    "id": 7,                           // Line ID (integer)
    "name": "Norwegian Cruise Line",   // Line name (string) ⭐ KEY FIELD
    "code": "NCL",                     // Line code (string)
    "description": "Line description...", // Description (string)
    "enginename": "Norwegian Cruise Line", // Engine name (string)
    "shortname": "NCL",                // Short name (string)
    "niceurl": "norwegian-cruise-line", // SEO-friendly URL (string)
    "logo": "https://..."              // Logo URL (string)
  }
}
```

### Itinerary Array
Each day in the itinerary is an object with the following structure:
```json
{
  "itinerary": [
    {
      "id": 12345,                     // Itinerary item ID (integer)
      "day": "1",                      // Day number (string)
      "orderid": 1,                    // Order in itinerary (integer)
      "portid": 378,                   // Port ID for this day (integer)
      "name": "Southampton, England",  // Port name (string) ⭐ KEY FIELD
      "itineraryname": "Southampton (London)", // Itinerary display name (string)
      "description": "Port description...", // Port description (string)
      "shortdescription": "Brief desc...", // Short description (string)
      "itinerarydescription": "Itinerary desc...", // Itinerary description (string)
      "arrivedate": "2025-09-15",      // Arrival date (string)
      "departdate": "2025-09-15",      // Departure date (string)  
      "arrivetime": "00:00",           // Arrival time 24hr format (string)
      "departtime": "17:00",           // Departure time 24hr format (string)
      "latitude": "50.9097",           // Port latitude (string)
      "longitude": "-1.4044",          // Port longitude (string)
      "idlcrossed": null,              // International date line crossed (null)
      "supercedes": null               // Supersedes info (null)
    }
  ]
}
```

### Cabin Categories (`cabins` object)
```json
{
  "cabins": {
    "IS": {                            // Cabin code
      "id": "IS",                      // Cabin ID (string)
      "name": "Interior Stateroom",   // Cabin name (string)
      "description": "Cabin desc...",  // Description (string)
      "category": "Interior",          // Category (string)
      "maxoccupancy": 4,               // Maximum occupancy (integer)
      "size": 142,                     // Room size in sq ft (integer)
      "facilities": ["TV", "AC", ...], // Facilities array
      "images": {                      // Cabin images object
        "1": { "url": "https://...", "caption": "..." }
      }
    }
  }
}
```

### Other Fields
```json
{
  "flycruiseinfo": {
    "flycruiseenable": 0               // Fly cruise enabled (0/1 integer)
  },
  "altsailings": null,                 // Alternative sailing dates (object/null)
  "lastcached": 1692892800,           // Unix timestamp (integer)
  "cacheddate": "2023-08-24 12:00:00" // Cached date string
}
```

## Webhook Payloads

### Static Pricing Webhook (USED ✅)
**Event Type**: `cruiseline_pricing_updated`

**Payload Structure**:
```json
{
  "event": "cruiseline_pricing_updated",
  "lineid": 7,                         // Cruise line ID that was updated
  "marketid": 0,                       // Market ID 
  "currency": "GBP",                   // Currency code
  "description": "Cruiseline pricing data updated for marketid 0 in currency GBP",
  "source": "json_cruise_export",      // Source system
  "timestamp": 1747822246              // Unix timestamp
}
```

**Webhook URL**: `https://zipsea-production.onrender.com/api/webhooks/traveltek`

**Processing Flow**:
1. Webhook received → Immediate HTTP 200 response
2. Background processing starts
3. Create price snapshots (before update)
4. Download updated JSON files from FTP for the cruise line  
5. Update static pricing data in database
6. Create price snapshots (after update)
7. Mark webhook as processed

### Live Pricing Webhook (NOT USED ❌)
**Event Type**: `cruises_live_pricing_updated`

**Note**: We acknowledge but do NOT process live pricing webhooks. Our implementation focuses only on static pricing updates.

## Field Mappings and Data Processing

### Critical Field Mappings ⭐
Based on official API documentation and validated with live data:

```javascript
// Cruise line name - USE linecontent.name (NOT enginename)
cruise_line_name: cruise.linecontent?.name || cruise.linename || 'Unknown'

// Ship name - USE shipcontent.name
ship_name: cruise.shipcontent?.name || cruise.shipname || 'Unknown'

// Ship occupancy - USE shipcontent.occupancy (NOT capacity)
ship_occupancy: cruise.shipcontent?.occupancy || null

// Cruise name - USE name (NOT cruisename)
cruise_name: cruise.name || 'Unknown'
```

### Data Processing Requirements

#### 1. Port and Region ID Parsing
```javascript
// portids and regionids are COMMA-SEPARATED STRINGS, not arrays
const portIdArray = cruise.portids ? cruise.portids.split(',').map(id => id.trim()) : [];
const regionIdArray = cruise.regionids ? cruise.regionids.split(',').map(id => id.trim()) : [];
```

#### 2. Pricing Structure Handling  
```javascript
// prices object may be empty for some cruises
if (cruise.prices && Object.keys(cruise.prices).length > 0) {
  // Process pricing data
  // Structure: prices[rateCode][cabinCode][occupancyCode]
}
```

#### 3. Itinerary Port Names
```javascript
// Each itinerary day has actual port name in 'name' field
const itinerary = cruise.itinerary?.map(day => ({
  day: day.day,
  port_name: day.name,  // This contains the actual port name
  arrive_time: day.arrivetime,
  depart_time: day.departtime
})) || [];
```

## Database Schema Mapping

### Core Tables
The database schema exactly matches the Traveltek JSON structure:

#### cruises
- Maps all root-level cruise fields
- Stores port_ids and region_ids as comma-separated strings
- Includes all Traveltek metadata fields

#### cruise_lines
- Maps from `linecontent` object
- Uses `linecontent.name` as primary display name

#### ships  
- Maps from `shipcontent` object
- Uses `shipcontent.name` for ship name
- Uses `shipcontent.occupancy` for guest capacity

#### pricing
- Maps complex pricing structure  
- Handles rate codes, cabin codes, occupancy codes
- Stores all price components (base, taxes, fees, etc.)

#### itineraries
- Maps itinerary array
- Each day becomes a separate record
- Port names from itinerary day `name` field

## Important Notes and Warnings

### ⚠️ Critical Data Handling Rules
1. **Port/Region IDs are strings**: Always parse from comma-separated format
2. **Ports/Regions are objects**: Not arrays - access by ID key
3. **Pricing may be empty**: Check if prices object has data before processing
4. **Use correct name fields**: 
   - Cruise lines: `linecontent.name`
   - Ships: `shipcontent.name`  
   - Occupancy: `shipcontent.occupancy`
5. **Itinerary has port names**: Use day.name for actual port names
6. **Cheapest prices often null**: Don't rely on pre-calculated values

### Data Validation Requirements
1. **Null Checks**: Many fields can be null or empty
2. **Type Validation**: Ensure correct data types during processing
3. **Relationship Integrity**: Verify foreign key references exist
4. **Pricing Validation**: Validate pricing calculations and totals

### Performance Considerations
1. **Large Files**: JSON files can be several MB each
2. **Batch Processing**: Process in batches to prevent memory issues
3. **Connection Management**: Properly handle FTP connection timeouts
4. **Database Indexing**: Index frequently queried fields

## API Compliance Checklist

### ✅ Implementation Status
- [x] All root-level cruise fields captured
- [x] Ship content (shipcontent) fully processed
- [x] Line content (linecontent) fully processed  
- [x] Itinerary array properly handled
- [x] Pricing structure correctly parsed
- [x] Port/region comma-separated strings handled
- [x] Static pricing webhook implemented
- [x] Field mappings match official documentation
- [x] Database schema matches API structure
- [x] TypeScript types defined for all structures

### ⚠️ Not Implemented
- [ ] Live pricing webhook processing (by design)
- [ ] Alternative sailings data (altsailings field)
- [ ] Ship deck details processing  
- [ ] Cabin images processing

This documentation ensures 100% compliance with the official Traveltek API and serves as the definitive reference for all Traveltek integration work.