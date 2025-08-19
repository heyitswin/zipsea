# Traveltek Data Schema Documentation

## JSON File Structure

### File Naming Convention
```
[year]/[month]/[lineid]/[shipid]/[codetocruiseid].json
```
- **year**: 4-digit year (e.g., 2025)
- **month**: 2-digit month (e.g., 05 for May)
- **lineid**: Cruise line identifier
- **shipid**: Ship identifier
- **codetocruiseid**: Unique cruise sailing identifier

### Root Object Structure
Each JSON file represents a single cruise sailing with comprehensive data:

```json
{
  "cruiseid": "integer",
  "codetocruiseid": "string",
  "lineid": "integer",
  "shipid": "integer",
  "name": "string",
  "itinerarycode": "string",
  "voyagecode": "string",
  "startdate": "string",
  "saildate": "string",
  "nights": "integer",
  "sailnights": "integer",
  "seadays": "integer",
  "startportid": "integer",
  "endportid": "integer",
  "marketid": "integer",
  "ownerid": "integer",
  "nofly": "boolean",
  "departuk": "boolean",
  "showcruise": "boolean",
  "flycruiseinfo": "string",
  "linecontent": "string",
  "regionids": [],
  "portids": [],
  "ports": [],
  "regions": [],
  "itinerary": [],
  "altsailings": [],
  "shipcontent": {},
  "cabins": {},
  "prices": {},
  "cheapest": {},
  "cheapestinside": {},
  "cheapestoutside": {},
  "cheapestbalcony": {},
  "cheapestsuite": {},
  "cachedprices": {},
  "lastcached": "string",
  "cacheddate": "string"
}
```

## Core Objects

### Cruise Metadata
```json
{
  "cruiseid": 8734921,
  "codetocruiseid": "8734921",
  "lineid": 7,
  "shipid": 231,
  "name": "7 Night Eastern Caribbean Cruise",
  "itinerarycode": "ECRIB7",
  "voyagecode": "GEM2505",
  "startdate": "2025-05-15",
  "saildate": "2025-05-15",
  "nights": 7,
  "sailnights": 7,
  "seadays": 2,
  "startportid": 123,
  "endportid": 123,
  "marketid": 0,
  "ownerid": 1,
  "nofly": false,
  "departuk": false,
  "showcruise": true,
  "regionids": [1, 2, 3]
}
```

### Ports Array
Ordered array of port names visited during the cruise:
```json
["Miami", "Nassau", "Cozumel", "Miami"]
```

### Regions Array
Ordered array of regions visited:
```json
["Caribbean", "Bahamas", "Mexico"]
```

### Port IDs Array
Ordered array of port identifiers:
```json
[123, 456, 789, 123]
```

### Itinerary Array
Detailed day-by-day itinerary information (structure varies by provider):
```json
[
  {
    "day": 1,
    "date": "2025-05-15",
    "port": "Miami",
    "arrive": null,
    "depart": "16:00",
    "description": "Embarkation"
  },
  {
    "day": 2,
    "date": "2025-05-16",
    "port": "At Sea",
    "arrive": null,
    "depart": null,
    "description": "Day at sea"
  },
  {
    "day": 3,
    "date": "2025-05-17",
    "port": "Cozumel",
    "arrive": "08:00",
    "depart": "17:00",
    "description": "Port day"
  }
]
```

### Alternative Sailings Array
Other available sailing dates for the same itinerary:
```json
[
  {
    "date": "2025-05-22",
    "cruiseid": 8734922,
    "price": 899.00
  },
  {
    "date": "2025-05-29",
    "cruiseid": 8734923,
    "price": 949.00
  }
]
```

## Ship Content Object

```json
{
  "shipcontent": {
    "id": 231,
    "name": "Norwegian Gem",
    "code": "GEM",
    "tonnage": 93530,
    "totalcabins": 1154,
    "shipclass": "Jewel",
    "startrating": 4,
    "limitof": 2394,
    "shortdescription": "Norwegian Gem offers freestyle cruising",
    "highlights": "Multiple dining venues, spa, casino",
    "defaultshipimage": "https://example.com/gem.jpg",
    "defaultshipimage2k": "https://example.com/gem-2k.jpg",
    "shipimages": [
      {
        "imageurl": "https://example.com/gem1.jpg",
        "imageurl2k": "https://example.com/gem1-2k.jpg",
        "caption": "Ship exterior",
        "metadata": {}
      }
    ],
    "additsoaly": "Additional ship information"
  }
}
```

## Pricing Objects

### Cheapest Price Objects
Multiple cheapest price objects for different cabin categories:

```json
{
  "cheapest": {
    "price": 599.00,
    "taxes": 125.00,
    "ncf": 105.00,
    "gratuity": 101.50,
    "fuel": 0,
    "noncomm": 105.00,
    "cabintype": "Inside"
  },
  "cheapestinside": {
    "price": 599.00,
    "taxes": 125.00,
    "ncf": 105.00,
    "gratuity": 101.50,
    "fuel": 0,
    "noncomm": 105.00
  },
  "cheapestinsidepricecode": "RATECODE1|IB|101",
  "cheapestoutside": {
    "price": 799.00,
    "taxes": 125.00,
    "ncf": 105.00,
    "gratuity": 101.50,
    "fuel": 0,
    "noncomm": 105.00
  },
  "cheapestoutsidepricecode": "RATECODE1|OV|101",
  "cheapestbalcony": {
    "price": 999.00,
    "taxes": 125.00,
    "ncf": 105.00,
    "gratuity": 101.50,
    "fuel": 0,
    "noncomm": 105.00
  },
  "cheapestbalconypricecode": "RATECODE1|BA|101",
  "cheapestsuite": {
    "price": 1999.00,
    "taxes": 125.00,
    "ncf": 105.00,
    "gratuity": 101.50,
    "fuel": 0,
    "noncomm": 105.00
  },
  "cheapestsuitepricecode": "RATECODE1|S1|101"
}
```

### Prices Object
Static pricing structure organized by rate code, cabin code, and occupancy:

```json
{
  "prices": {
    "RATECODE1": {
      "IB": {
        "101": {
          "price": 599.00,
          "adultprice": 599.00,
          "childprice": 299.00,
          "infantprice": 0,
          "thirdadultprice": 299.00,
          "fourthadultprice": 299.00,
          "singleprice": 1198.00,
          "cabintype": "Inside",
          "gratuity": 101.50,
          "taxes": 125.00,
          "ncf": 105.00,
          "fuel": 0,
          "noncomm": 105.00
        },
        "102": {
          "price": 1198.00,
          "adultprice": 599.00,
          "cabintype": "Inside",
          "gratuity": 203.00,
          "taxes": 250.00,
          "ncf": 210.00,
          "fuel": 0,
          "noncomm": 210.00
        }
      },
      "OV": {
        "101": {
          "price": 799.00,
          "adultprice": 799.00,
          "cabintype": "Oceanview",
          "gratuity": 101.50,
          "taxes": 125.00,
          "ncf": 105.00,
          "fuel": 0,
          "noncomm": 105.00
        }
      }
    }
  }
}
```

**Structure Key:**
- First level: Rate code (e.g., "RATECODE1", "BROCHURE")
- Second level: Cabin code (e.g., "IB" for Inside, "OV" for Oceanview)
- Third level: Occupancy code (e.g., "101" for single, "102" for double)

### CachedPrices Object
Live pricing data from cruise line APIs:

```json
{
  "cachedprices": {
    "BESTFARE": {
      "IB": {
        "101": {
          "price": 549.00,
          "adultprice": 549.00,
          "cabintype": "Inside",
          "gratuity": 101.50,
          "taxes": 125.00,
          "ncf": 105.00,
          "fuel": 0,
          "noncomm": 105.00,
          "timestamp": "2025-01-15T08:00:00Z"
        }
      },
      "OV": {
        "101": {
          "price": 749.00,
          "adultprice": 749.00,
          "cabintype": "Oceanview",
          "gratuity": 101.50,
          "taxes": 125.00,
          "ncf": 105.00,
          "fuel": 0,
          "noncomm": 105.00,
          "timestamp": "2025-01-15T08:00:00Z"
        }
      }
    },
    "BROCHURE": {
      "IB": {
        "101": {
          "price": 699.00,
          "adultprice": 699.00,
          "cabintype": "Inside",
          "gratuity": 101.50,
          "taxes": 125.00,
          "ncf": 105.00,
          "fuel": 0,
          "noncomm": 105.00,
          "timestamp": "2025-01-15T08:00:00Z"
        }
      }
    }
  },
  "lastcached": "2025-01-15T08:00:00Z",
  "cacheddate": "2025-01-15"
}
```

**Note:** Cached prices have 1-day TTL and may not be available for all sailings/cabin types

## Cabin Definitions

### Cabins Object
```json
{
  "cabins": {
    "IB": {
      "id": 1,
      "name": "Inside Cabin",
      "description": "Comfortable inside stateroom",
      "cabincode": "IB",
      "cabincode2": "IA",
      "codtype": "inside",
      "codtype2": "interior",
      "colourcode": "#8B4513",
      "colourcode2": "#654321",
      "imageurl": "https://example.com/cabin-ib.jpg",
      "imageurl2k": "https://example.com/cabin-ib-2k.jpg",
      "isdefault": true,
      "validfrom": "2025-01-01",
      "validto": "2025-12-31"
    },
    "OV": {
      "id": 2,
      "name": "Ocean View Cabin",
      "description": "Ocean View Cabin with window",
      "cabincode": "OV",
      "cabincode2": "OV02",
      "codtype": "oceanview",
      "codtype2": "outside",
      "colourcode": "#4169E1",
      "colourcode2": "#1E90FF",
      "imageurl": "https://example.com/cabin-ov.jpg",
      "imageurl2k": "https://example.com/cabin-ov-2k.jpg",
      "isdefault": false,
      "validfrom": "2025-01-01",
      "validto": "2025-12-31"
    },
    "BA": {
      "id": 3,
      "name": "Balcony Cabin",
      "description": "Balcony stateroom with private balcony",
      "cabincode": "BA",
      "cabincode2": "BB",
      "codtype": "balcony",
      "codtype2": "verandah",
      "colourcode": "#32CD32",
      "colourcode2": "#228B22",
      "imageurl": "https://example.com/cabin-ba.jpg",
      "imageurl2k": "https://example.com/cabin-ba-2k.jpg",
      "isdefault": false,
      "validfrom": "2025-01-01",
      "validto": "2025-12-31"
    },
    "S1": {
      "id": 4,
      "name": "Suite",
      "description": "Luxury suite with separate living area",
      "cabincode": "S1",
      "cabincode2": "JS",
      "codtype": "suite",
      "codtype2": "junior_suite",
      "colourcode": "#FFD700",
      "colourcode2": "#FFA500",
      "imageurl": "https://example.com/cabin-s1.jpg",
      "imageurl2k": "https://example.com/cabin-s1-2k.jpg",
      "isdefault": false,
      "validfrom": "2025-01-01",
      "validto": "2025-12-31"
    }
  }
}
```

## Data Types and Field Definitions

### Core Fields
| Field | Type | Description |
|-------|------|-------------|
| `cruiseid` | integer | Unique cruise identifier |
| `codetocruiseid` | string | String version of cruise ID for file naming |
| `lineid` | integer | Cruise line identifier |
| `shipid` | integer | Ship identifier |
| `startportid` | integer | Starting port ID |
| `endportid` | integer | Ending port ID |
| `nights` | integer | Number of nights |
| `sailnights` | integer | Actual sailing nights |
| `seadays` | integer | Number of days at sea |
| `marketid` | integer | Market identifier |
| `ownerid` | integer | Owner identifier |

### Pricing Fields
| Field | Type | Description |
|-------|------|-------------|
| `price` | number | Base cruise fare |
| `adultprice` | number | Per adult price |
| `childprice` | number | Per child price |
| `infantprice` | number | Per infant price |
| `thirdadultprice` | number | Third adult in cabin price |
| `fourthadultprice` | number | Fourth adult in cabin price |
| `singleprice` | number | Single occupancy price |
| `taxes` | number | Tax amount |
| `ncf` | number | Non-commissionable fees |
| `gratuity` | number | Gratuity amount |
| `fuel` | number | Fuel surcharge |
| `noncomm` | number | Total non-commissionable amount |

### Occupancy Codes
- `101`: Single occupancy (1 adult)
- `102`: Double occupancy (2 adults)
- `103`: Triple occupancy (3 adults)
- `104`: Quad occupancy (4 adults)
- `201`: 2 adults + 1 child
- `202`: 2 adults + 2 children
- `301`: 3 adults + 1 child

### Cabin Type Codes
- `IB`, `IA`, `IC`: Inside cabins
- `OV`, `OA`, `OB`: Ocean view cabins
- `BA`, `BB`, `BC`: Balcony cabins
- `S1`, `S2`, `JS`: Suite categories

### Special Considerations
- Prices in single market-specific currency per file
- Live pricing (cachedprices) has 1-day TTL
- Live pricing may not cover all sailings/cabin types
- Static pricing updated daily
- Webhook delivery not guaranteed - implement fallback polling
- Files organized by year/month for efficient retrieval