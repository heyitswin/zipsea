# Traveltek Field Mappings

## Database Schema Mapping

### Cruise Lines Table
| Traveltek Field | Database Column | Type | Notes |
|----------------|-----------------|------|-------|
| lineid | id | INTEGER | Primary key, from Traveltek |
| linecontent | name | VARCHAR(255) | Extract from content, indexed |
| - | logo_url | VARCHAR(500) | Added manually |
| - | description | TEXT | Marketing content |
| - | created_at | TIMESTAMP | Auto-generated |
| - | updated_at | TIMESTAMP | Auto-updated |

### Ships Table
| Traveltek Field | Database Column | Type | Notes |
|----------------|-----------------|------|-------|
| shipid | id | INTEGER | Primary key |
| lineid | cruise_line_id | INTEGER | Foreign key |
| shipcontent.name | name | VARCHAR(255) | Indexed |
| shipcontent.limitof | capacity | INTEGER | Passenger capacity |
| shipcontent.tonnage | tonnage | INTEGER | Ship tonnage |
| shipcontent.totalcabins | total_cabins | INTEGER | Total cabin count |
| shipcontent.shipclass | ship_class | VARCHAR(100) | Ship classification |
| shipcontent.startrating | rating | INTEGER | Star rating |
| shipcontent.shipimages | images | JSONB | Array of image objects |
| shipcontent.highlights | amenities | TEXT | Ship features |
| shipcontent.shortdescription | description | TEXT | Ship description |
| - | created_at | TIMESTAMP | Auto-generated |
| - | updated_at | TIMESTAMP | Auto-updated |

### Cruises Table
| Traveltek Field | Database Column | Type | Notes |
|----------------|-----------------|------|-------|
| cruiseid | id | INTEGER | Primary key |
| codetocruiseid | code_to_cruise_id | VARCHAR(50) | File identifier |
| lineid | cruise_line_id | INTEGER | Foreign key |
| shipid | ship_id | INTEGER | Foreign key |
| name | name | VARCHAR(255) | Cruise name |
| itinerarycode | itinerary_code | VARCHAR(50) | Itinerary identifier |
| voyagecode | voyage_code | VARCHAR(50) | Voyage identifier |
| startdate/saildate | sailing_date | DATE | Indexed |
| nights | duration_nights | INTEGER | Number of nights |
| sailnights | sail_nights | INTEGER | Actual sailing nights |
| seadays | sea_days | INTEGER | Days at sea |
| startportid | embark_port_id | INTEGER | Foreign key |
| endportid | disembark_port_id | INTEGER | Foreign key |
| regionids | region_ids | INTEGER[] | Array of region IDs |
| marketid | market_id | INTEGER | Market identifier |
| ownerid | owner_id | INTEGER | Owner identifier |
| nofly | no_fly | BOOLEAN | Flight not included |
| departuk | depart_uk | BOOLEAN | UK departure |
| showcruise | is_active | BOOLEAN | Show cruise flag |
| flycruiseinfo | fly_cruise_info | TEXT | Fly cruise details |
| - | traveltek_file_path | VARCHAR(500) | FTP path reference |
| lastcached | last_synced | TIMESTAMP | Last cache time |
| - | created_at | TIMESTAMP | Auto-generated |
| - | updated_at | TIMESTAMP | Auto-updated |

### Ports Table
| Traveltek Field | Database Column | Type | Notes |
|----------------|-----------------|------|-------|
| portids array index | id | INTEGER | Primary key |
| ports array value | name | VARCHAR(255) | Port name, indexed |
| - | code | VARCHAR(10) | Port code (manual) |
| - | country | VARCHAR(100) | Country (manual) |
| - | country_code | VARCHAR(2) | ISO code (manual) |
| - | latitude | DECIMAL(10,8) | GPS (manual) |
| - | longitude | DECIMAL(11,8) | GPS (manual) |
| - | timezone | VARCHAR(50) | TZ (manual) |
| - | description | TEXT | Port description |
| - | images | JSONB | Array of URLs |
| - | created_at | TIMESTAMP | Auto-generated |
| - | updated_at | TIMESTAMP | Auto-updated |

### Itineraries Table
| Traveltek Field | Database Column | Type | Notes |
|----------------|-----------------|------|-------|
| - | id | UUID | Primary key |
| cruiseid | cruise_id | INTEGER | Foreign key |
| itinerary[].day | day_number | INTEGER | Day sequence |
| itinerary[].date | date | DATE | Actual date |
| itinerary[].port | port_name | VARCHAR(255) | Port name |
| portids array | port_id | INTEGER | Foreign key, nullable |
| itinerary[].arrive | arrival_time | TIME | Nullable |
| itinerary[].depart | departure_time | TIME | Nullable |
| - | status | VARCHAR(20) | Derived from port/times |
| itinerary[].description | description | TEXT | Day description |
| - | created_at | TIMESTAMP | Auto-generated |

### Cabin Categories Table
| Traveltek Field | Database Column | Type | Notes |
|----------------|-----------------|------|-------|
| cabins.{code}.cabincode | code | VARCHAR(10) | Primary key per ship |
| shipid | ship_id | INTEGER | Foreign key |
| cabins.{code}.name | name | VARCHAR(255) | Display name |
| cabins.{code}.codtype | category | VARCHAR(50) | inside/oceanview/balcony/suite |
| cabins.{code}.description | description | TEXT | Detailed description |
| cabins.{code}.colourcode | color_code | VARCHAR(7) | UI color |
| cabins.{code}.imageurl | image_url | VARCHAR(500) | Primary image |
| cabins.{code}.imageurl2k | image_url_hd | VARCHAR(500) | HD image |
| cabins.{code}.isdefault | is_default | BOOLEAN | Default cabin |
| - | max_occupancy | INTEGER | From pricing data |
| - | amenities | JSONB | Manual entry |
| - | created_at | TIMESTAMP | Auto-generated |
| - | updated_at | TIMESTAMP | Auto-updated |

### Pricing Table
| Traveltek Field | Database Column | Type | Notes |
|----------------|-----------------|------|-------|
| - | id | UUID | Primary key |
| cruiseid | cruise_id | INTEGER | Foreign key |
| prices.{rate}.{cabin} | cabin_code | VARCHAR(10) | Cabin code |
| prices.{rate} | rate_code | VARCHAR(50) | Rate identifier |
| prices.{}.{}.{occ} | occupancy_code | VARCHAR(10) | 101, 102, etc |
| prices.{}.{}.{}.price | base_price | DECIMAL(10,2) | Base fare |
| prices.{}.{}.{}.adultprice | adult_price | DECIMAL(10,2) | Per adult |
| prices.{}.{}.{}.childprice | child_price | DECIMAL(10,2) | Per child |
| prices.{}.{}.{}.infantprice | infant_price | DECIMAL(10,2) | Per infant |
| prices.{}.{}.{}.singleprice | single_price | DECIMAL(10,2) | Single occupancy |
| prices.{}.{}.{}.taxes | taxes | DECIMAL(10,2) | Tax amount |
| prices.{}.{}.{}.ncf | ncf | DECIMAL(10,2) | Non-commissionable fees |
| prices.{}.{}.{}.gratuity | gratuities | DECIMAL(10,2) | Tips |
| prices.{}.{}.{}.fuel | fuel_surcharge | DECIMAL(10,2) | Fuel charge |
| prices.{}.{}.{}.noncomm | non_comm_total | DECIMAL(10,2) | Total non-comm |
| prices.{}.{}.{}.cabintype | cabin_type | VARCHAR(50) | Cabin category |
| - | currency | VARCHAR(3) | From cruise record |
| - | is_available | BOOLEAN | Derived |
| - | price_type | VARCHAR(10) | 'static' |
| - | created_at | TIMESTAMP | Auto-generated |
| - | updated_at | TIMESTAMP | Auto-updated |

### Cheapest Pricing Table (Denormalized for Performance)
| Traveltek Field | Database Column | Type | Notes |
|----------------|-----------------|------|-------|
| - | id | UUID | Primary key |
| cruiseid | cruise_id | INTEGER | Foreign key, indexed |
| cheapest.price | cheapest_price | DECIMAL(10,2) | Overall cheapest |
| cheapest.cabintype | cheapest_cabin_type | VARCHAR(50) | Cabin type |
| cheapestinside.price | interior_price | DECIMAL(10,2) | Lowest interior |
| cheapestinside.taxes | interior_taxes | DECIMAL(10,2) | Interior taxes |
| cheapestinside.ncf | interior_ncf | DECIMAL(10,2) | Interior NCF |
| cheapestinside.gratuity | interior_gratuity | DECIMAL(10,2) | Interior tips |
| cheapestinsidepricecode | interior_price_code | VARCHAR(50) | Rate|Cabin|Occ |
| cheapestoutside.price | oceanview_price | DECIMAL(10,2) | Lowest oceanview |
| cheapestoutsidepricecode | oceanview_price_code | VARCHAR(50) | Rate|Cabin|Occ |
| cheapestbalcony.price | balcony_price | DECIMAL(10,2) | Lowest balcony |
| cheapestbalconypricecode | balcony_price_code | VARCHAR(50) | Rate|Cabin|Occ |
| cheapestsuite.price | suite_price | DECIMAL(10,2) | Lowest suite |
| cheapestsuitepricecode | suite_price_code | VARCHAR(50) | Rate|Cabin|Occ |
| - | currency | VARCHAR(3) | From cruise record |
| lastcached | last_updated | TIMESTAMP | Cache timestamp |

## Data Type Conversions

### String to Enum Mappings
```typescript
// Cabin Categories (from codtype field)
const CABIN_CATEGORY_MAP = {
  'inside': 'INTERIOR',
  'interior': 'INTERIOR',
  'oceanview': 'OCEANVIEW',
  'outside': 'OCEANVIEW',
  'balcony': 'BALCONY',
  'verandah': 'BALCONY',
  'suite': 'SUITE',
  'junior_suite': 'SUITE'
};

// Occupancy Code Mappings
const OCCUPANCY_MAP = {
  '101': { adults: 1, children: 0 },
  '102': { adults: 2, children: 0 },
  '103': { adults: 3, children: 0 },
  '104': { adults: 4, children: 0 },
  '201': { adults: 2, children: 1 },
  '202': { adults: 2, children: 2 },
  '301': { adults: 3, children: 1 }
};

// Price Type
const PRICE_TYPE_MAP = {
  'prices': 'STATIC',
  'cachedprices': 'LIVE'
};
```

### Date/Time Conversions
```typescript
// Start date: "2025-05-15" -> DATE
// Sail date: "2025-05-15" -> DATE
// Time: "16:00" -> TIME (from itinerary arrive/depart)
// Last cached: "2025-01-15T08:00:00Z" -> TIMESTAMP
// Cached date: "2025-01-15" -> DATE
```

### Numeric Conversions
```typescript
// IDs: lineid (7) -> INTEGER
// IDs: shipid (231) -> INTEGER
// IDs: cruiseid (8734921) -> INTEGER
// Nights: 7 -> INTEGER
// Prices: 899.00 -> DECIMAL(10,2)
// Occupancy codes: "101" -> Parse to adults/children
```

## Validation Rules

### Required Fields
- cruiseId (must be unique)
- lineId (must exist in cruise_lines)
- shipId (must exist in ships)
- sailingDate (must be future date for new cruises)
- duration (must be positive integer)
- At least one pricing record

### Data Integrity
- Foreign key constraints on all relationships
- Check constraints on dates (sailing < return)
- Price validations (base_price >= 0)
- Occupancy limits (1-8 typically)
- Currency validation (valid ISO codes)

### Business Rules
- Historical pricing preserved (soft deletes)
- Audit trail for price changes
- Inventory tracking with thresholds
- OBC calculations based on total price
- Commission calculations from base price

## Redis Cache Mappings

### Cache Keys
```typescript
// Cruise search results
`cruise:search:${region}:${startDate}:${endDate}:${duration}`

// Individual cruise
`cruise:detail:${cruiseId}`

// Cheapest prices
`cruise:cheapest:${cruiseId}`

// Live pricing (1-day TTL)
`cruise:live:${cruiseId}:${cabinCode}:${occupancy}`

// Ship details
`ship:${shipId}`

// Port information
`port:${portId}`
```

### Cache TTLs
- Search results: 1 hour
- Cruise details: 6 hours
- Static pricing: 24 hours
- Live pricing: 24 hours (from Traveltek)
- Ship/Port data: 7 days

## Index Strategy

### Primary Indexes
- cruises.sailing_date
- cruises.region
- cruises.duration_days
- cruises.cruise_line_id + sailing_date
- pricing.cruise_id + cabin_category_id
- cheapest_pricing.cruise_id

### Composite Indexes
- (sailing_date, region, duration_days)
- (cruise_line_id, ship_id, sailing_date)
- (cruise_id, is_available, cabin_category)

### Full-Text Search
- ships.name
- ports.name
- cruises.region + sub_region