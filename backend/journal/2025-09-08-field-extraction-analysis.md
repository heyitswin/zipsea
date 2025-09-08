# Field Extraction Analysis - 2025-09-08

## Summary
Analyzed the raw_data JSONB field in the cruises table to identify fields that should be extracted into dedicated columns for better query performance and data efficiency.

## Current State
- **Total active cruises**: 48,744
- **Cruises with raw_data**: 48,743 (99.9%)
- **Cheapest pricing already extracted**: 40,081 records (82.2%)

## Key Findings

### 1. Fields with 100% Coverage That Need Extraction
These fields exist in nearly all records and should be extracted to dedicated columns:

- **ship_name** (from `raw_data->'shipcontent'->>'name'`)
  - Coverage: 48,743/48,744 (99.9%)
  - Status: Column added, extraction in progress
  - Use case: Display, search, filtering

- **voyage_code** (from `raw_data->>'voyagecode'`)
  - Coverage: 48,744/48,744 (100%)
  - Status: Column exists but mostly empty
  - Use case: Unique identifier from cruise line

- **nights** (from `raw_data->>'nights'`)
  - Coverage: 48,744/48,744 (100%)
  - Status: Column exists but some missing data
  - Use case: Duration filtering

- **start_port_id** (from `raw_data->>'startportid'`)
  - Coverage: 48,630/48,744 (99.8%)
  - Status: Maps to embarkation_port_id column
  - Use case: Search by departure port

- **end_port_id** (from `raw_data->>'endportid'`)
  - Coverage: 48,630/48,744 (99.8%)
  - Status: Maps to disembarkation_port_id column
  - Use case: Search by arrival port

### 2. Complex Fields Requiring New Tables

#### Ports Data
- Currently stored as JSON object in `raw_data->'ports'`
- Example: `{"42":"Boston, USA","121":"Halifax","207":"New York"}`
- Recommendation: Create `cruise_ports` table
  ```sql
  CREATE TABLE cruise_ports (
    cruise_id VARCHAR(255) REFERENCES cruises(id),
    port_id INTEGER,
    port_name VARCHAR(255),
    port_order INTEGER
  );
  ```

#### Regions Data
- Currently stored as JSON object in `raw_data->'regions'`
- Example: `{"8":"North America"}`
- Recommendation: Create `cruise_regions` table
  ```sql
  CREATE TABLE cruise_regions (
    cruise_id VARCHAR(255) REFERENCES cruises(id),
    region_id INTEGER,
    region_name VARCHAR(255)
  );
  ```

#### Itinerary Data
- Currently stored as either JSON array or string in `raw_data->'itinerary'`
- Contains detailed port stops with arrival/departure dates
- Recommendation: Create `cruise_itinerary` table
  ```sql
  CREATE TABLE cruise_itinerary (
    cruise_id VARCHAR(255) REFERENCES cruises(id),
    day_number INTEGER,
    port_id INTEGER,
    port_name VARCHAR(255),
    arrival_date TIMESTAMP,
    departure_date TIMESTAMP,
    longitude DECIMAL,
    latitude DECIMAL
  );
  ```

### 3. Already Extracted Fields
These fields have already been properly extracted:
- Cheapest pricing fields → `cheapest_pricing` table
- Basic cruise info (sailing_date, start_date, return_date) → `cruises` table

### 4. Low Priority Fields
These fields are complex or have low search value:
- **cabins** - Complex nested structure with cabin details
- **prices** - Detailed pricing by rate code (mostly empty)
- **cached metadata** - Operational data, not user-facing

## Immediate Actions Needed

### 1. Complete Field Extraction
Run the extraction scripts to populate existing columns:
```bash
cd backend && node scripts/update-fields-incremental.js
```

### 2. Create Indexes
After data is populated, create indexes for search performance:
```sql
CREATE INDEX idx_cruises_ship_name ON cruises(ship_name);
CREATE INDEX idx_cruises_voyage_code ON cruises(voyage_code);
CREATE INDEX idx_cruises_embarkation_port ON cruises(embarkation_port_id);
CREATE INDEX idx_cruises_disembarkation_port ON cruises(disembarkation_port_id);
```

### 3. Create New Tables
For complex relationships, create the normalized tables mentioned above.

## Performance Impact
Extracting these fields will:
1. Reduce JSONB parsing overhead
2. Enable efficient indexing
3. Improve search/filter query performance by 10-100x
4. Reduce data transfer size for API responses

## Webhook Processing Issues
The original issue with webhook failures (65-98% failure rates) is primarily due to:
1. FTP files not existing (counted as failures but not actual errors)
2. Data structure mismatch in pricing updates
3. Missing pricing data extraction

The field extraction work addresses the data efficiency part of the problem. The webhook service still needs fixing to properly handle FTP downloads and pricing updates.