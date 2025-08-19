# Traveltek API Detailed Documentation

## JSON Export Structure

### File Organization
Files are organized in a hierarchical directory structure on the FTP server:
```
/[year]/[month]/[lineId]/[shipId]/[cruiseId].json
```

Example:
```
/2025/05/7/231/8734921.json
```

Where:
- `year`: 4-digit year (e.g., 2025)
- `month`: Month without leading zero (e.g., 5 for May)
- `lineId`: Cruise line identifier
- `shipId`: Ship identifier  
- `cruiseId`: Unique cruise identifier (matches codetocruiseid)

## JSON Schema Structure

### Root Object
```json
{
  "version": "string",
  "exportDate": "ISO8601",
  "cruise": {
    // Main cruise object
  }
}
```

### Cruise Object
```json
{
  "cruiseId": "string",
  "lineId": "string",
  "lineName": "string",
  "shipId": "string",
  "shipName": "string",
  "sailingDate": "YYYY-MM-DD",
  "returnDate": "YYYY-MM-DD",
  "duration": "integer",
  "currency": "string (ISO 4217)",
  "market": "string",
  "region": "string",
  "subRegion": "string",
  "cruiseType": "string",
  "embarkPort": {
    // Port object
  },
  "disembarkPort": {
    // Port object
  },
  "itinerary": [],
  "cabins": [],
  "decks": [],
  "cheapest": {},
  "cachedPrices": {},
  "metadata": {}
}
```

### Port Object
```json
{
  "portId": "string",
  "portName": "string",
  "portCode": "string (IATA/port code)",
  "country": "string",
  "countryCode": "string (ISO 3166)",
  "state": "string (optional)",
  "city": "string",
  "latitude": "number",
  "longitude": "number",
  "timezone": "string (IANA timezone)",
  "terminal": "string (optional)"
}
```

### Itinerary Array
Each day of the cruise itinerary:
```json
[
  {
    "day": "integer",
    "date": "YYYY-MM-DD",
    "port": {
      // Port object or null for sea days
    },
    "arrivalTime": "HH:MM or null",
    "departureTime": "HH:MM or null",
    "status": "string", // embark, port, at_sea, disembark
    "overnight": "boolean",
    "description": "string (optional)"
  }
]
```

### Cabin Categories Array
```json
[
  {
    "cabinCode": "string",
    "cabinName": "string",
    "cabinCategory": "string", // interior, oceanview, balcony, suite
    "cabinSubCategory": "string (optional)",
    "description": "string",
    "amenities": ["string"],
    "size": "string (e.g., '250 sq ft')",
    "maxOccupancy": "integer",
    "minOccupancy": "integer",
    "bedConfiguration": "string",
    "deckLocations": ["string"],
    "images": ["string (URLs)"],
    "accessible": "boolean"
  }
]
```

### Deck Plans Array
```json
[
  {
    "deckNumber": "integer",
    "deckName": "string",
    "deckPlan": "string (URL)",
    "facilities": ["string"],
    "cabinRanges": [
      {
        "cabinCode": "string",
        "fromCabin": "string",
        "toCabin": "string"
      }
    ]
  }
]
```

### Cheapest Object
Aggregated lowest prices by cabin category:
```json
{
  "interior": {
    "available": "boolean",
    "price": "number",
    "pricePerPerson": "number",
    "taxes": "number",
    "ncf": "number",
    "gratuities": "number",
    "portCharges": "number",
    "total": "number",
    "cabinCode": "string",
    "rateCode": "string",
    "occupancy": "string",
    "commission": "number (optional)",
    "inventory": "integer (optional)"
  },
  "oceanview": {
    // Same structure as interior
  },
  "balcony": {
    // Same structure as interior
  },
  "suite": {
    // Same structure as interior
  }
}
```

### CachedPrices Object
Comprehensive pricing for all cabin/rate combinations:
```json
{
  "rates": [
    {
      "rateCode": "string",
      "rateName": "string",
      "rateDescription": "string",
      "rateCategory": "string", // standard, promotional, group
      "bookingCode": "string (optional)",
      "cabins": [
        {
          "cabinCode": "string",
          "cabinName": "string",
          "cabinCategory": "string",
          "deckLocations": ["string"],
          "maxOccupancy": "integer",
          "pricing": [
            {
              "occupancy": "string", // "1", "2", "3", "4"
              "adults": "integer",
              "children": "integer (optional)",
              "price": "number",
              "pricePerPerson": "number",
              "taxes": "number",
              "ncf": "number", // Non-Commissionable Fees
              "gratuities": "number",
              "portCharges": "number",
              "governmentFees": "number (optional)",
              "total": "number",
              "commission": "number (optional)",
              "available": "boolean",
              "inventory": "integer (optional)",
              "waitlist": "boolean (optional)",
              "guarantee": "boolean (optional)"
            }
          ]
        }
      ],
      "inclusions": ["string"],
      "restrictions": ["string"],
      "depositRequired": "number (optional)",
      "finalPaymentDue": "YYYY-MM-DD (optional)"
    }
  ],
  "lastCached": "ISO8601",
  "ttl": "integer (seconds)",
  "priceType": "string" // static, live
}
```

### Metadata Object
```json
{
  "lastUpdated": "ISO8601",
  "dataSource": "string",
  "fileVersion": "string",
  "schemaVersion": "string",
  "exportType": "string", // full, incremental
  "market": "string",
  "currency": "string",
  "language": "string (ISO 639-1)"
}
```

## Additional Data Elements

### Promotions Array (optional)
```json
{
  "promotions": [
    {
      "promotionId": "string",
      "promotionName": "string",
      "description": "string",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "discount": {
        "type": "string", // percentage, fixed
        "value": "number"
      },
      "applicableCabins": ["string"],
      "applicableRates": ["string"],
      "terms": "string"
    }
  ]
}
```

### Dining Options (optional)
```json
{
  "dining": [
    {
      "restaurantId": "string",
      "name": "string",
      "type": "string", // main, specialty, buffet, cafe
      "cuisine": "string",
      "fee": "number (optional)",
      "reservationRequired": "boolean",
      "deck": "string",
      "hours": "string"
    }
  ]
}
```

### Entertainment (optional)
```json
{
  "entertainment": [
    {
      "type": "string", // show, activity, facility
      "name": "string",
      "description": "string",
      "venue": "string",
      "schedule": "string",
      "fee": "number (optional)"
    }
  ]
}
```

## Webhook Payloads

### Static Pricing Update
```json
{
  "event": "cruiseline_pricing_updated",
  "timestamp": "ISO8601",
  "data": {
    "lineIds": ["string"],
    "updateType": "full", // full, partial
    "affectedDates": {
      "from": "YYYY-MM-DD",
      "to": "YYYY-MM-DD"
    }
  }
}
```

### Live Pricing Update
```json
{
  "event": "cruises_live_pricing_updated",
  "timestamp": "ISO8601",
  "data": {
    "cruises": [
      {
        "cruiseId": "string",
        "lineId": "string",
        "shipId": "string",
        "sailingDate": "YYYY-MM-DD"
      }
    ],
    "priceType": "live"
  }
}
```

## Data Validation Rules

### Required Fields
- cruiseId
- lineId
- shipId
- sailingDate
- returnDate
- duration
- currency
- embarkPort
- disembarkPort
- itinerary (non-empty array)
- At least one pricing record

### Business Rules
1. sailingDate must be <= returnDate
2. duration must match date difference
3. itinerary array length should match duration + 1
4. All prices must be >= 0
5. occupancy must be between minOccupancy and maxOccupancy
6. Currency must be valid ISO 4217 code
7. Dates must be in YYYY-MM-DD format
8. Times must be in HH:MM format (24-hour)

### Data Consistency
- All prices in a file use the same currency
- Port IDs must be consistent across embark/disembark/itinerary
- Cabin codes must be consistent between cabins array and pricing
- Rate codes must be unique within a cruise

## FTP Directory Structure

### Root Directory
```
/
├── 2024/
│   ├── 1/
│   ├── 2/
│   └── ...
├── 2025/
│   ├── 1/
│   │   ├── 1/  (lineId)
│   │   │   ├── 101/ (shipId)
│   │   │   │   ├── 12345.json
│   │   │   │   └── 12346.json
│   │   │   └── 102/
│   │   └── 2/
│   └── ...
└── metadata/
    └── exportdefinition.json
```

## Error Handling

### Common Error Scenarios
1. **Missing Required Fields**: Validate against schema before import
2. **Invalid Date Formats**: Parse and validate all date fields
3. **Currency Mismatches**: Ensure single currency per file
4. **Pricing Inconsistencies**: Validate total = base + taxes + fees
5. **Invalid Port References**: Check port IDs exist
6. **Malformed JSON**: Implement robust JSON parsing with fallbacks

### Retry Strategy
- FTP connection failures: Exponential backoff (1s, 2s, 4s, 8s, 16s)
- File download failures: 3 retries with 5s delay
- JSON parsing failures: Log and skip file, continue with others
- Database write failures: Transaction rollback and retry

## Performance Considerations

### Caching Strategy
- Live pricing: 24-hour TTL (as specified by Traveltek)
- Static pricing: Until next webhook update
- Ship/Port data: 7-day cache
- Search results: 1-hour cache

### Batch Processing
- Process files in batches of 100
- Use database bulk inserts
- Implement parallel FTP downloads (max 5 concurrent)
- Queue webhook notifications for async processing

### Indexing
- Index on cruiseId for quick lookups
- Composite index on (sailingDate, region, duration)
- Index on lineId + shipId for filtering
- Full-text index on port names for search