# Traveltek API Complete Field Reference

## Overview
This document provides a complete reference for all fields in the Traveltek cruise JSON export format, based on the official API documentation and actual implementation.

**File Format**: Standalone JSON file per cruise sailing  
**File Path**: `[year]/[month]/[lineid]/[shipid]/[codetocruiseid].json`  
**Currency**: Single market-specific currency per file  
**API Documentation URL**: https://cruisepass.site.traveltek.net/connect/cruise/export/documentation

## Root Level Fields

| Field Name | Type | Description | Example |
|------------|------|-------------|---------|
| `cruiseid` | Integer | Base cruise identifier (can have multiple sailings) | 123456 |
| `codetocruiseid` | String | Unique sailing identifier (primary key) | "789012" |
| `lineid` | Integer | Cruise line identifier | 22 |
| `shipid` | Integer | Ship identifier | 45 |
| `name` | String | Cruise name/title | "7 Night Caribbean Cruise" |
| `itinerarycode` | String | Itinerary code | "CARIB7" |
| `voyagecode` | String | Voyage code | "RC2025" |
| `startdate` | String | Start date (ISO format) | "2025-09-15" |
| `saildate` | String | Sailing date (ISO format) | "2025-09-15" |
| `nights` | Integer | Number of nights | 7 |
| `sailnights` | Integer | Actual sailing nights | 6 |
| `seadays` | Integer | Days at sea | 3 |
| `startportid` | Integer | Embarkation port ID | 101 |
| `endportid` | Integer | Disembarkation port ID | 101 |
| `marketid` | Integer | Market identifier | 1 |
| `ownerid` | Integer | Owner identifier | 5 |
| `nofly` | String | No fly indicator ("Y"/"N") | "N" |
| `departuk` | Boolean | Departs from UK | false |
| `showcruise` | Boolean | Display cruise flag | true |
| `flycruiseinfo` | String | Fly cruise information | "Flights included" |
| `lastcached` | Integer | Unix timestamp of last cache | 1693526400 |
| `cacheddate` | String | Cache date (ISO format) | "2025-09-01" |

## Nested Objects

### `linecontent` - Cruise Line Information
| Field Name | Type | Description |
|------------|------|-------------|
| `name` | String | Cruise line name |
| `shortname` | String | Short name |
| `title` | String | Display title |
| `enginename` | String | Internal engine name |
| `code` | String | Line code |
| `description` | String | Full description |

### `shipcontent` - Ship Information  
| Field Name | Type | Description |
|------------|------|-------------|
| `name` | String | Ship name |
| `nicename` | String | Nice display name |
| `shortname` | String | Short name |
| `code` | String | Ship code |
| `tonnage` | Integer | Ship tonnage |
| `totalcabins` | Integer | Total number of cabins |
| `maxpassengers` | Integer | Maximum passengers |
| `crew` | Integer | Crew size |
| `length` | Number | Ship length (meters) |
| `beam` | Number | Ship width (meters) |
| `draft` | Number | Ship draft (meters) |
| `speed` | Number | Cruising speed (knots) |
| `registry` | String | Ship registry |
| `builtyear` | Integer | Year built |
| `refurbishedyear` | Integer | Year refurbished |
| `description` | String | Ship description |

## Arrays

### `regionids` - Region Identifiers
- **Type**: Array of Integer
- **Description**: List of region IDs the cruise visits
- **Example**: `[1, 5, 12]`

### `portids` - Port Identifiers  
- **Type**: Array of Integer
- **Description**: List of port IDs in the itinerary
- **Example**: `[101, 202, 303, 404]`

### `ports` - Port Names
- **Type**: Array of String
- **Description**: List of port names
- **Example**: `["Miami", "Cozumel", "Jamaica", "Grand Cayman"]`

### `regions` - Region Names
- **Type**: Array of String  
- **Description**: List of region names
- **Example**: `["Caribbean", "Western Caribbean"]`

### `itinerary` - Detailed Itinerary
- **Type**: Array of Objects
- **Description**: Day-by-day itinerary details

#### Itinerary Object Structure:
| Field Name | Type | Description |
|------------|------|-------------|
| `day` | Integer | Day number |
| `date` | String | Date (ISO format) |
| `portid` | Integer | Port ID |
| `port` | String | Port name |
| `arrive` | String | Arrival time |
| `depart` | String | Departure time |
| `description` | String | Day description |
| `seaday` | Boolean | Is it a sea day |

### `altsailings` - Alternative Sailings
- **Type**: Array of Objects
- **Description**: Alternative sailing dates for the same cruise

#### Alternative Sailing Object:
| Field Name | Type | Description |
|------------|------|-------------|
| `date` | String | Sailing date (ISO format) |
| `cruiseid` | Integer | Cruise ID |
| `price` | Number | Starting price |

## Maps/Dictionaries

### `ports` - Port Information Map
- **Type**: Object (Map)
- **Key**: Port ID (String)
- **Value**: Port details object

### `regions` - Region Information Map  
- **Type**: Object (Map)
- **Key**: Region ID (String)
- **Value**: Region details object

### `cabins` - Cabin Information Map
- **Type**: Object (Map)
- **Key**: Cabin code (String)
- **Value**: Cabin details object

## Pricing Structures

### `prices` - Static Pricing Data
- **Type**: Nested Object
- **Structure**: `prices[ratecode][cabincode][occupancy]`
- **Description**: Static pricing from cruise lines

#### Price Object Fields:
| Field Name | Type | Description |
|------------|------|-------------|
| `price` | Number | Base price |
| `tax` | Number | Tax amount |
| `ncf` | Number | Non-commissionable fees |
| `gratuities` | Number | Gratuities |
| `total` | Number | Total price |
| `commission` | Number | Commission amount |
| `netprice` | Number | Net price |
| `currency` | String | Currency code |

### `cachedprices` - Live Cached Pricing
- **Type**: Nested Object  
- **Structure**: `cachedprices[ratecode][cabincode][occupancy]`
- **Description**: Cached live pricing data

### `cheapest` - Aggregated Cheapest Pricing
- **Type**: Object
- **Description**: Pre-calculated cheapest prices across all categories

| Field Name | Type | Description |
|------------|------|-------------|
| `inside` | Number | Cheapest inside cabin price |
| `outside` | Number | Cheapest outside cabin price |
| `balcony` | Number | Cheapest balcony cabin price |
| `suite` | Number | Cheapest suite price |
| `insidepricecode` | String | Rate code for cheapest inside |
| `outsidepricecode` | String | Rate code for cheapest outside |
| `balconypricecode` | String | Rate code for cheapest balcony |
| `suitepricecode` | String | Rate code for cheapest suite |

### Additional Cheapest Pricing Fields
| Field Name | Type | Description |
|------------|------|-------------|
| `cheapestinside` | Object | Detailed cheapest inside cabin pricing |
| `cheapestoutside` | Object | Detailed cheapest outside cabin pricing |
| `cheapestbalcony` | Object | Detailed cheapest balcony cabin pricing |
| `cheapestsuite` | Object | Detailed cheapest suite pricing |
| `cheapestinsidepricecode` | String | Rate code for cheapest inside |
| `cheapestoutsidepricecode` | String | Rate code for cheapest outside |
| `cheapestbalconypricecode` | String | Rate code for cheapest balcony |
| `cheapestsuitepricecode` | String | Rate code for cheapest suite |

## Webhook Payloads

### Static Pricing Update Webhook
**Event**: `cruiseline_pricing_updated`

| Field Name | Type | Description |
|------------|------|-------------|
| `event` | String | Event type identifier |
| `lineid` | Integer | Cruise line ID |
| `currency` | String | Currency code |
| `marketid` | Integer | Market ID |
| `source` | String | Update source |
| `description` | String | Update description |
| `timestamp` | Integer | Unix timestamp |

### Live Pricing Update Webhook  
**Event**: `cruises_live_pricing_updated`

| Field Name | Type | Description |
|------------|------|-------------|
| `event` | String | Event type identifier |
| `lineid` | Integer | Cruise line ID |
| `currency` | String | Currency code |
| `marketid` | Integer | Market ID |
| `source` | String | Update source |
| `description` | String | Update description |
| `timestamp` | Integer | Unix timestamp |
| `paths` | Array[String] | Array of file paths updated |

## Database Schema Mapping

### Cruises Table
| Database Field | JSON Field | Type | Notes |
|---------------|------------|------|-------|
| `id` | `codetocruiseid` | VARCHAR | Primary key |
| `cruise_id` | `cruiseid` | VARCHAR | Can duplicate across sailings |
| `cruise_line_id` | `lineid` | INTEGER | Foreign key to cruise_lines |
| `ship_id` | `shipid` | INTEGER | Foreign key to ships |
| `name` | `name` | VARCHAR(500) | |
| `voyage_code` | `voyagecode` | VARCHAR(50) | |
| `itinerary_code` | `itinerarycode` | VARCHAR(50) | |
| `sailing_date` | `saildate` | DATE | |
| `return_date` | Calculated | DATE | saildate + nights |
| `nights` | `nights` | INTEGER | |
| `sea_days` | `seadays` | INTEGER | |
| `embarkation_port_id` | `startportid` | INTEGER | Foreign key to ports |
| `disembarkation_port_id` | `endportid` | INTEGER | Foreign key to ports |
| `port_ids` | `portids` | VARCHAR(500) | Comma-separated |
| `region_ids` | `regionids` | VARCHAR(200) | Comma-separated |
| `market_id` | `marketid` | VARCHAR(50) | |
| `owner_id` | `ownerid` | VARCHAR(50) | |
| `no_fly` | `nofly` | BOOLEAN | "Y" → true, "N" → false |
| `depart_uk` | `departuk` | BOOLEAN | |
| `show_cruise` | `showcruise` | BOOLEAN | |
| `last_cached` | `lastcached` | INTEGER | Unix timestamp |
| `cached_date` | `cacheddate` | VARCHAR(100) | |
| `interior_price` | `cheapest.inside` | DECIMAL(10,2) | |
| `oceanview_price` | `cheapest.outside` | DECIMAL(10,2) | |
| `balcony_price` | `cheapest.balcony` | DECIMAL(10,2) | |
| `suite_price` | `cheapest.suite` | DECIMAL(10,2) | |
| `cheapest_price` | Calculated | DECIMAL(10,2) | MIN of all prices |

### Cruise Lines Table
| Database Field | JSON Field | Type | Notes |
|---------------|------------|------|-------|
| `id` | `lineid` | INTEGER | Primary key |
| `name` | `linecontent.name` | VARCHAR(255) | Falls back to shortname, title |
| `code` | Generated | VARCHAR(50) | Format: CL{lineid} |
| `description` | `linecontent.description` | TEXT | |

### Ships Table  
| Database Field | JSON Field | Type | Notes |
|---------------|------------|------|-------|
| `id` | `shipid` | INTEGER | Primary key |
| `cruise_line_id` | `lineid` | INTEGER | Foreign key |
| `name` | `shipcontent.name` | VARCHAR(255) | Falls back to nicename, shortname |
| `code` | `shipcontent.code` | VARCHAR(50) | |
| `tonnage` | `shipcontent.tonnage` | INTEGER | |
| `total_cabins` | `shipcontent.totalcabins` | INTEGER | |
| `max_passengers` | `shipcontent.maxpassengers` | INTEGER | |
| `crew` | `shipcontent.crew` | INTEGER | |

### Ports Table
| Database Field | JSON Field | Type | Notes |
|---------------|------------|------|-------|
| `id` | Port ID from array | INTEGER | Primary key |
| `name` | Port name from array | VARCHAR(255) | |
| `code` | Generated | VARCHAR(50) | Format: P{portid} |
| `country` | From port details | VARCHAR(100) | |
| `region` | From region mapping | VARCHAR(100) | |

### Itineraries Table
| Database Field | JSON Field | Type | Notes |
|---------------|------------|------|-------|
| `cruise_id` | `codetocruiseid` | VARCHAR | Foreign key |
| `day` | `itinerary[].day` | INTEGER | |
| `date` | `itinerary[].date` | DATE | |
| `port_id` | `itinerary[].portid` | INTEGER | Foreign key |
| `port_name` | `itinerary[].port` | VARCHAR(255) | |
| `arrival_time` | `itinerary[].arrive` | TIME | |
| `departure_time` | `itinerary[].depart` | TIME | |
| `description` | `itinerary[].description` | TEXT | |
| `is_sea_day` | `itinerary[].seaday` | BOOLEAN | |

## Data Processing Notes

### FTP File Structure
```
/YYYY/MM/LINEID/SHIPID/CODETOCRUISEID.json
```
- YYYY: 4-digit year
- MM: 2-digit month (zero-padded)
- LINEID: Cruise line ID (webhook line ID, not database line ID)
- SHIPID: Ship ID
- CODETOCRUISEID: Unique sailing identifier

### Important Mappings
1. **Line ID Mapping**: Webhook line IDs may differ from database line IDs
2. **Currency**: Each file contains prices in a single currency
3. **Date Formats**: ISO 8601 format (YYYY-MM-DD)
4. **Boolean Conversion**: "Y"/"N" strings → true/false
5. **Price Aggregation**: `cheapest` object contains pre-calculated lowest prices

### Data Sync Priorities
1. Cruise line and ship must exist before cruise
2. Ports and regions must exist before itinerary
3. Price history snapshot before updating prices
4. Calculate price changes after updates

### Webhook Processing
1. Receive webhook notification
2. Extract line ID and currency
3. Queue for processing via Redis/BullMQ
4. Download relevant JSON files from FTP
5. Process in batches (50 cruises at a time)
6. Update database with new pricing
7. Send success/failure notification to Slack

## Version History
- **v1.0** (2025-09-04): Initial comprehensive documentation based on API specs and implementation