# Traveltek Data Structure Documentation

Based on comprehensive analysis of actual Traveltek FTP JSON files.

## Critical Field Mappings

### Cruise Basic Information
- `cruiseid` (number) - Primary cruise ID
- `name` (string) - Cruise name/title (NOT `cruisename`)
- `saildate` (string) - Sail date "YYYY-MM-DD"
- `startdate` (string) - Same as saildate
- `nights` (number) - Number of nights
- `sailnights` (number) - Sailing nights
- `seadays` (number) - Days at sea
- `voyagecode` (string) - Voyage identifier
- `codetocruiseid` (number) - Used for file naming
- `itinerarycode` (null) - Always null in samples
- `marketid` (string) - Market identifier
- `ownerid` (string) - Usually "system"
- `showcruise` (string) - "Y" or "N"
- `nofly` (string) - "Y" or "N" 
- `departuk` (string) - "Y" or "N"

### Line and Ship IDs
- `lineid` (number) - Cruise line ID
- `shipid` (number) - Ship ID
- `startportid` (string) - Embark port ID
- `endportid` (string) - Disembark port ID

### Ports and Regions (IMPORTANT: Not Arrays!)
- `portids` (string) - COMMA-SEPARATED string of port IDs (e.g., "378,383,2864,37")
- `ports` (object) - Object with port data (NOT an array)
- `regionids` (string) - COMMA-SEPARATED string of region IDs (e.g., "12,3")
- `regions` (object) - Object with region data (NOT an array)

### Pricing Structure
- `prices` (object) - Main pricing data
  - Structure: `prices[rateCode][cabinCode][occupancyCode]`
  - Contains: price, taxes, ncf, gratuity, fuel, etc.
  - NOTE: May be empty object `{}` for some cruises

- `cachedprices` (object) - Cached pricing data

- `cheapest` (object) - Pre-calculated cheapest prices
  - `cheapest.prices.*` - All null in samples
  - `cheapest.cachedprices.*` - All null in samples
  - `cheapest.combined.*` - All null in samples

### Ship Content (`shipcontent` object)
- `shipcontent.id` (number) - Ship ID
- `shipcontent.name` (string) - Ship name
- `shipcontent.code` (string) - Ship code (may be empty)
- `shipcontent.tonnage` (number) - Ship tonnage
- `shipcontent.totalcabins` (number) - Total cabins
- `shipcontent.occupancy` (number) - Guest capacity
- `shipcontent.totalcrew` (number) - Crew count
- `shipcontent.length` (number) - Ship length
- `shipcontent.launched` (string) - Launch date
- `shipcontent.starrating` (number) - Star rating
- `shipcontent.adultsonly` (string) - "Y" or "N"
- `shipcontent.shortdescription` (string) - Ship description
- `shipcontent.highlights` (null) - Always null in samples
- `shipcontent.shipclass` (null) - Always null in samples
- `shipcontent.defaultshipimage` (string) - Default image URL
- `shipcontent.defaultshipimagehd` (string) - HD image URL
- `shipcontent.defaultshipimage2k` (string) - 2K image URL
- `shipcontent.shipimages` (object) - Ship images collection
- `shipcontent.shipdecks` (object) - Deck information
- `shipcontent.niceurl` (string) - SEO-friendly URL

### Line Content (`linecontent` object)
- `linecontent.id` (number) - Line ID
- `linecontent.name` (string) - Line name
- `linecontent.code` (string) - Line code (may be empty)
- `linecontent.description` (string) - Line description
- `linecontent.enginename` (string) - Engine name
- `linecontent.shortname` (string) - Short name
- `linecontent.niceurl` (string) - SEO-friendly URL
- `linecontent.logo` (string) - Logo URL

### Itinerary (`itinerary` array)
Each day object contains:
- `id` (number) - Itinerary item ID
- `day` (string) - Day number as string
- `orderid` (number) - Order in itinerary
- `portid` (number) - Port ID for this day
- `name` (string) - **Port name (THIS IS THE ACTUAL PORT NAME!)**
- `itineraryname` (string) - Itinerary display name
- `description` (string) - Port description
- `shortdescription` (string) - Short description
- `itinerarydescription` (string) - Itinerary description
- `arrivedate` (string) - Arrival date
- `departdate` (string) - Departure date
- `arrivetime` (string) - Arrival time (24hr format)
- `departtime` (string) - Departure time (24hr format)
- `latitude` (string) - Port latitude
- `longitude` (string) - Port longitude
- `idlcrossed` (null) - International date line crossed
- `supercedes` (null) - Supersedes info

### Other Fields
- `cabins` (object) - Cabin categories and details
- `flycruiseinfo` (object) - Fly cruise information
  - `flycruiseinfo.flycruiseenable` (number) - 0 or 1
- `altsailings` (object/null) - Alternative sailing dates
- `lastcached` (number) - Unix timestamp
- `cacheddate` (string) - Cached date string

## Important Notes

1. **Pricing may be empty**: The `prices` object exists but may be `{}` for some cruises
2. **Port/Region IDs are strings**: Need to be parsed from comma-separated format
3. **Ports/Regions are objects**: Not arrays, need different handling
4. **Use `name` field**: The cruise name is in `name`, not `cruisename`
5. **Itinerary has port names**: Each day's `name` field contains the actual port name
6. **Many cheapest fields are null**: Don't rely on pre-calculated cheapest prices

## Data Parsing Requirements

1. Parse `portids` and `regionids` from comma-separated strings to arrays
2. Handle `ports` and `regions` as objects (may need to map by ID)
3. Check if `prices` object has actual data before processing
4. Use itinerary day's `name` field for port names
5. Handle nullable fields appropriately