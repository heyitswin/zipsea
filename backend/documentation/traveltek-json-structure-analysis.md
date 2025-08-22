# Traveltek JSON Structure Analysis
## Based on Actual Sample Data

This document provides the EXACT mapping between Traveltek JSON fields and our database schema.

## 1. ROOT LEVEL FIELDS

### Cruise Identification
- `codetocruiseid` (number) → `cruises.id` (VARCHAR PRIMARY KEY) - **UNIQUE per sailing**
- `cruiseid` (number) → `cruises.cruise_id` (VARCHAR) - **NOT UNIQUE, can have multiple sailings**
- `lineid` (string) → `cruises.cruise_line_id` (INTEGER)
- `shipid` (number) → `cruises.ship_id` (INTEGER)

### Cruise Details
- `name` (string) → `cruises.name`
- `nights` (number) → `cruises.nights`
- `sailnights` (number) → Also maps to `cruises.nights` (fallback)
- `saildate` (string) → `cruises.sailing_date`
- `startdate` (string) → Also maps to `cruises.sailing_date` (fallback)
- `voyagecode` (string) → `cruises.voyage_code`
- `itinerarycode` (string|null) → `cruises.itinerary_code`

### Ports
- `startportid` (string) → `cruises.embarkation_port_id`
- `endportid` (string) → `cruises.disembarkation_port_id`
- `portids` (string) → Comma-separated list of port IDs
- `ports` (object) → `{portId: "Port Name"}` - For populating ports table

### Other Fields
- `regionids` (string) → Comma-separated region IDs
- `regions` (object) → `{regionId: "Region Name"}` - For populating regions table
- `seadays` (number) → Number of days at sea
- `departuk` (string "Y"/"N") → Whether departs from UK
- `nofly` (string "Y"/"N") → Whether it's a no-fly cruise
- `showcruise` (string|null) → Whether to show cruise
- `ownerid` (string) → "system"
- `marketid` (string) → Market identifier
- `lastcached` (number) → Unix timestamp
- `cacheddate` (string) → Human-readable cache date

## 2. LINECONTENT OBJECT

**Path**: `linecontent`

**ACTUAL FIELDS** (from sample):
- `id` (number) → `cruise_lines.id`
- `name` (string) → `cruise_lines.name` 
- `enginename` (string) → Alternative name (fallback for name)
- `niceurl` (string) → URL slug
- `shortname` (string) → Short name abbreviation
- `description` (string) → `cruise_lines.description`
- `logo` (string) → `cruise_lines.logo`
- `code` (string) → Line code

**NOTE**: NO `website` field exists!

## 3. SHIPCONTENT OBJECT

**Path**: `shipcontent`

**ACTUAL FIELDS**:
- `id` (number) → `ships.id`
- `name` (string) → `ships.name`
- `code` (string) → `ships.code`
- `lineid` (number) → Reference to cruise line
- `tonnage` (number) → `ships.tonnage`
- `totalcabins` (number) → `ships.total_cabins`
- `occupancy` (number) → `ships.occupancy` (NOT capacity!)
- `totalcrew` (number) → `ships.total_crew`
- `length` (number) → `ships.length`
- `launched` (string date) → `ships.launched`
- `starrating` (number) → `ships.star_rating`
- `adultsonly` (string "Y"/"N") → `ships.adults_only`
- `shortdescription` (string) → `ships.short_description`
- `highlights` (string|null) → `ships.highlights`
- `shipclass` (string|null) → `ships.ship_class`
- `defaultshipimage` (string) → `ships.default_ship_image`
- `defaultshipimagehd` (string) → `ships.default_ship_image_hd`
- `defaultshipimage2k` (string) → `ships.default_ship_image_2k`
- `niceurl` (string) → `ships.nice_url`

### Ship Images Array
**Path**: `shipcontent.shipimages[]`
- `imageurl` (string) → URL of image
- `imageurlhd` (string) → HD version
- `imageurl2k` (string) → 2K version
- `caption` (string) → Image caption
- `default` (string "Y"/"N") → Is default image

### Ship Decks Object
**Path**: `shipcontent.shipdecks`
- Object with deck IDs as keys
- Each deck has:
  - `id` (number)
  - `deckname` (string)
  - `description` (string)
  - `planimage` (string) → Deck plan image URL
  - `validfrom` (string date)
  - `validto` (string date)

## 4. PRICES OBJECT (STATIC PRICING)

**Path**: `prices`

In the sample, this is EMPTY `{}` but structure should be:
```
prices: {
  "RATECODE1": {
    "IB": {  // Cabin code
      "101": {  // Occupancy code
        price: 1000,
        adultprice: 1000,
        childprice: 800,
        taxes: 100,
        ncf: 50,
        gratuity: 80,
        fuel: 20
      }
    }
  }
}
```

## 5. CABINS OBJECT

**Path**: `cabins`

Object with cabin IDs as keys. Each cabin:
- `id` (string)
- `cabincode` (string) → `cabin_categories.cabin_code`
- `cabincode2` (string) → `cabin_categories.cabin_code_alt`
- `name` (string) → `cabin_categories.name`
- `description` (string) → `cabin_categories.description`
- `codtype` (string) → `cabin_categories.category` (interior/oceanview/balcony/suite)
- `colourcode` (string) → `cabin_categories.color_code`
- `imageurl` (string) → `cabin_categories.image_url`
- `imageurlhd` (string)
- `imageurl2k` (string) → `cabin_categories.image_url_hd`
- `isdefault` (string "Y"/"N") → `cabin_categories.is_default`
- `validfrom` (string date) → `cabin_categories.valid_from`
- `validto` (string date) → `cabin_categories.valid_to`

## 6. ITINERARY ARRAY

**Path**: `itinerary[]`

Each day object:
- `id` (number) → Internal ID
- `day` (string) → Day number
- `orderid` (number) → Order in itinerary
- `portid` (number) → `itineraries.port_id`
- `name` (string) → `itineraries.port_name`
- `itineraryname` (string) → Alternative port name
- `description` (string) → `itineraries.description`
- `shortdescription` (string)
- `arrivedate` (string date)
- `departdate` (string date)
- `arrivetime` (string) → `itineraries.arrival_time`
- `departtime` (string) → `itineraries.departure_time`
- `latitude` (string) → For ports table
- `longitude` (string) → For ports table

## 7. CHEAPEST PRICING (PRE-CALCULATED)

**Path**: `cheapest`, `cheapestinside`, `cheapestoutside`, `cheapestbalcony`, `cheapestsuite`

These are typically NULL in static data (need live pricing).

## 8. ALTERNATIVE SAILINGS

**Path**: `altsailings`

Object with sailing IDs as keys:
- `id` (string) → Alternative cruise ID
- `startdate` (string) → Departure date
- `saildate` (string) → Also departure date
- `leadprice` (string) → Lead-in price
- `voyagecode` (string)
- `shipid` (number)

## DATABASE SCHEMA CORRECTIONS NEEDED

Based on this analysis, our database needs:

1. **cruise_lines table**:
   - Remove `website` column (doesn't exist in data)
   
2. **ships table**:
   - Ensure `occupancy` not `capacity`
   - Ensure `star_rating` not `rating`
   - Ensure `short_description` not `description`

3. **cruises table**:
   - `id` should be VARCHAR (for codetocruiseid)
   - `cruise_id` should be VARCHAR (for original cruiseid)
   - Add fields for voyage_code, itinerary_code

4. **pricing table**:
   - `cruise_id` should be VARCHAR to match cruises.id

5. **cabin_categories table**:
   - Properly handle the cabin structure from JSON

## SYNC SCRIPT CORRECTIONS NEEDED

1. Remove `website` from cruise_lines insert ✅ DONE
2. Handle empty `prices` object gracefully
3. Parse `cabins` object correctly (it's an object, not array)
4. Parse `shipdecks` correctly (it's an object with deck IDs as keys)
5. Parse `itinerary` array properly
6. Handle `altsailings` object structure