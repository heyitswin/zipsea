# Traveltek JSON Field Mapping Analysis

## Executive Summary
Comparison of actual Traveltek JSON structure from sample file with current schema.js implementation.

## Field Type Analysis

### Top-Level Cruise Fields

| Traveltek Field | Type | Schema Table | Schema Column | Type Match | Notes |
|-----------------|------|--------------|---------------|------------|-------|
| `codetocruiseid` | INTEGER | cruises | id | ❌ VARCHAR | **MISMATCH**: Schema uses VARCHAR, JSON has INTEGER |
| `cruiseid` | INTEGER | cruises | cruise_id | ❌ VARCHAR | **MISMATCH**: Schema uses VARCHAR, JSON has INTEGER |
| `lineid` | STRING "1" | cruises | cruise_line_id | ✅ INTEGER | Correct (parsed to INT) |
| `shipid` | INTEGER | cruises | ship_id | ✅ INTEGER | Correct |
| `name` | STRING | cruises | name | ✅ VARCHAR(500) | Correct |
| `voyagecode` | STRING | cruises | voyage_code | ✅ VARCHAR(50) | Correct |
| `itinerarycode` | STRING/NULL | cruises | itinerary_code | ✅ VARCHAR(50) | Correct |
| `nights` | INTEGER | cruises | nights | ✅ INTEGER | Correct |
| `sailnights` | INTEGER | cruise_definitions | sail_nights | ✅ INTEGER | Correct |
| `seadays` | INTEGER | cruises | sea_days | ✅ INTEGER | Correct |
| `startdate` | STRING "2025-10-19" | cruises | sailing_date | ✅ DATE | Correct (parsed) |
| `saildate` | STRING "2025-10-19" | cruises | sailing_date | ✅ DATE | Duplicate field |
| `startportid` | STRING "295" | cruises | embarkation_port_id | ✅ INTEGER | Correct (parsed) |
| `endportid` | STRING "295" | cruises | disembarkation_port_id | ✅ INTEGER | Correct (parsed) |
| `portids` | STRING "295,158,475..." | cruises | port_ids | ✅ VARCHAR(500) | Correct |
| `regionids` | STRING "7,4" | cruises | region_ids | ✅ VARCHAR(200) | Correct |
| `marketid` | STRING "9" | cruises | market_id | ✅ VARCHAR(50) | Correct |
| `ownerid` | STRING "system" | cruises | owner_id | ✅ VARCHAR(50) | Correct |
| `nofly` | STRING "Y" | cruises | no_fly | ✅ BOOLEAN | Correct (parsed) |
| `departuk` | STRING "Y" | cruises | depart_uk | ✅ BOOLEAN | Correct (parsed) |
| `showcruise` | NULL | cruises | show_cruise | ✅ BOOLEAN | Correct |
| `lastcached` | INTEGER (timestamp) | cruises | last_cached | ❌ INTEGER | **Type OK but semantic issue** |
| `cacheddate` | STRING | cruises | cached_date | ❌ VARCHAR(100) | Should be TIMESTAMP |

### Ship Content Fields

| Traveltek Field | Type | Schema Table | Schema Column | Type Match | Notes |
|-----------------|------|--------------|---------------|------------|-------|
| `shipcontent.id` | INTEGER | ships | id | ✅ INTEGER | Correct |
| `shipcontent.lineid` | INTEGER | ships | cruise_line_id | ✅ INTEGER | Correct |
| `shipcontent.name` | STRING | ships | name | ✅ VARCHAR(255) | Correct |
| `shipcontent.code` | STRING | ships | code | ✅ VARCHAR(50) | Correct |
| `shipcontent.tonnage` | INTEGER | ships | tonnage | ✅ INTEGER | Correct |
| `shipcontent.totalcabins` | INTEGER | ships | total_cabins | ✅ INTEGER | Correct |
| `shipcontent.occupancy` | INTEGER | ships | occupancy | ✅ INTEGER | **CORRECT NAME!** |
| `shipcontent.totalcrew` | INTEGER | ships | total_crew | ✅ INTEGER | Correct |
| `shipcontent.length` | INTEGER | ships | length | ✅ INTEGER | Correct |
| `shipcontent.launched` | STRING "2004-06-26" | ships | launched | ✅ DATE | Correct |
| `shipcontent.starrating` | INTEGER | ships | star_rating | ✅ INTEGER | Correct |
| `shipcontent.adultsonly` | STRING "Y" | ships | adults_only | ✅ BOOLEAN | Correct (parsed) |
| `shipcontent.shortdescription` | STRING | ships | short_description | ✅ TEXT | Correct |
| `shipcontent.highlights` | NULL | ships | highlights | ✅ TEXT | Correct |
| `shipcontent.shipclass` | NULL | ships | ship_class | ✅ VARCHAR(100) | Correct |
| `shipcontent.defaultshipimage` | STRING URL | ships | default_ship_image | ✅ VARCHAR(500) | Correct |
| `shipcontent.defaultshipimagehd` | STRING URL | ships | default_ship_image_hd | ✅ VARCHAR(500) | Correct |
| `shipcontent.defaultshipimage2k` | STRING URL | ships | default_ship_image_2k | ✅ VARCHAR(500) | Correct |
| `shipcontent.niceurl` | STRING | ships | nice_url | ✅ VARCHAR(255) | Correct |

### Pricing Fields (Critical)

| Traveltek Field | Type | Schema Location | Notes |
|-----------------|------|-----------------|-------|
| `cheapest` | OBJECT | cruises + pricing | Complex nested structure |
| `cheapest.prices.outside` | NULL | cruises.oceanview_price | Missing in sample |
| `cheapest.combined.balcony` | NULL | cruises.balcony_price | Missing in sample |
| `cheapestinside` | NULL | cruises.interior_price | Missing in sample |
| `cheapestoutside` | NULL | cruises.oceanview_price | Missing in sample |
| `cheapestbalcony` | NULL | cruises.balcony_price | Missing in sample |
| `cheapestsuite` | NULL | cruises.suite_price | Missing in sample |
| `cheapestprice` | NULL | cruises.cheapest_price | Missing in sample |
| `cheapestinsidepricecode` | NULL | - | Not stored |
| `cheapestoutsidepricecode` | NULL | - | Not stored |
| `cheapestbalconypricecode` | NULL | - | Not stored |
| `cheapestsuitepricecode` | NULL | - | Not stored |
| `cachedprices` | OBJECT {} | pricing table | Empty in sample |
| `prices` | OBJECT {} | pricing table | Empty in sample |

### Itinerary Fields

| Traveltek Field | Type | Schema Table | Schema Column | Type Match | Notes |
|-----------------|------|--------------|---------------|------------|-------|
| `itinerary[].id` | INTEGER | itineraries | - | - | Not stored |
| `itinerary[].portid` | INTEGER | itineraries | port_id | ✅ INTEGER | Correct |
| `itinerary[].name` | STRING | itineraries | port_name | ✅ VARCHAR(255) | Correct |
| `itinerary[].day` | STRING "1" | itineraries | day_number | ✅ INTEGER | Correct (parsed) |
| `itinerary[].orderid` | INTEGER | - | - | - | Not stored |
| `itinerary[].arrivedate` | STRING | - | - | - | Not stored |
| `itinerary[].departdate` | STRING | - | - | - | Not stored |
| `itinerary[].arrivetime` | STRING | itineraries | arrival_time | ✅ VARCHAR(10) | Correct |
| `itinerary[].departtime` | STRING | itineraries | departure_time | ✅ VARCHAR(10) | Correct |
| `itinerary[].description` | STRING | itineraries | description | ✅ TEXT | Correct |
| `itinerary[].latitude` | STRING | ports | latitude | ✅ DECIMAL | Stored in ports table |
| `itinerary[].longitude` | STRING | ports | longitude | ✅ DECIMAL | Stored in ports table |

### Cabin Categories

| Traveltek Field | Type | Schema Table | Schema Column | Type Match | Notes |
|-----------------|------|--------------|---------------|------------|-------|
| `cabins[id].id` | STRING "20080" | cabin_categories | cabin_id | ✅ VARCHAR(20) | Correct |
| `cabins[id].cabincode` | STRING | cabin_categories | cabin_code | ✅ VARCHAR(10) | Correct |
| `cabins[id].cabincode2` | STRING | cabin_categories | cabin_code_alt | ✅ VARCHAR(10) | Correct |
| `cabins[id].name` | STRING | cabin_categories | name | ✅ VARCHAR(255) | Correct |
| `cabins[id].description` | STRING | cabin_categories | description | ✅ TEXT | Correct |
| `cabins[id].codtype` | STRING "balcony" | cabin_categories | category | ✅ VARCHAR(50) | Correct mapping |
| `cabins[id].colourcode` | STRING | cabin_categories | color_code | ✅ VARCHAR(7) | Correct |
| `cabins[id].imageurl` | STRING | cabin_categories | image_url | ✅ VARCHAR(500) | Correct |
| `cabins[id].imageurlhd` | STRING | cabin_categories | image_url_hd | ✅ VARCHAR(500) | Correct |
| `cabins[id].imageurl2k` | STRING | cabin_categories | image_url_2k | ✅ VARCHAR(500) | Correct |
| `cabins[id].isdefault` | STRING "N" | cabin_categories | is_default | ✅ BOOLEAN | Correct (parsed) |
| `cabins[id].validfrom` | STRING | cabin_categories | valid_from | ✅ DATE | Correct |
| `cabins[id].validto` | STRING | cabin_categories | valid_to | ✅ DATE | Correct |

## Critical Issues Found

### 1. **ID Type Mismatch** 🔴
- **Problem**: `codetocruiseid` and `cruiseid` are INTEGERs in JSON but stored as VARCHAR in schema
- **Impact**: Type conversion overhead, potential for data integrity issues
- **Recommendation**: Keep as VARCHAR since we're using it as primary key and need string operations

### 2. **Missing Pricing Data** 🔴
- **Problem**: Sample shows empty `prices` and `cachedprices` objects
- **Impact**: Line 5 (Cunard) has 756 cruises with NO pricing data
- **Current Status**: This is why webhooks are failing - no pricing to update

### 3. **Timestamp Handling** 🟡
- **Problem**: `cacheddate` stored as VARCHAR instead of proper TIMESTAMP
- **Impact**: Cannot perform date operations efficiently
- **Recommendation**: Convert to TIMESTAMP in schema

### 4. **Ship Occupancy Field** ✅
- **Confirmed**: Field is correctly named `occupancy` not `capacity`
- **Schema**: Correctly uses `occupancy` column name

## Pricing Structure Deep Dive

Based on the JSON structure, pricing comes in multiple forms:

1. **cheapest** object - Top-level cheapest prices by cabin type
2. **cachedprices** object - Detailed pricing by rate code and cabin
3. **prices** object - Static pricing information

The sample file has NO pricing data, which explains the Cunard webhook failures.

## Recommendations

1. ✅ **Schema is mostly correct** - Field mappings align well with JSON structure
2. ⚠️ **ID fields** - Keep as VARCHAR for flexibility despite type mismatch
3. 🔧 **Fix cacheddate** - Convert from VARCHAR to TIMESTAMP
4. 📊 **Handle empty pricing** - Add validation for cruises without pricing data
5. 🔄 **Webhook processing** - Skip price updates for cruises with no initial pricing

## Next Steps

1. Run initial sync for Line 5 (Cunard) to populate missing pricing
2. Add pricing validation in webhook processing
3. Consider converting `cached_date` to TIMESTAMP type
4. Monitor webhook success rates after initial pricing population